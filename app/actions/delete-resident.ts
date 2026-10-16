"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const CONFIRMATION_PHRASE = "Я ТРЕЗВ, ЭТО НЕ ТЕСТОВАЯ БАЗА";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DeleteResult =
  | { ok: false; reason: "invalid" | "unauthenticated" | "forbidden" | "not_found" | "not_resident" | "server_error" };

type ProfileForDeletion = {
  id: string;
  user_id: string | null;
  role: string;
  telegram_id: string | null;
  telegram_username: string | null;
  email: string | null;
  avatar_url: string | null;
  photo_urls: string[] | null;
};

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const until = Date.parse(profile.banned_until);
  return Number.isFinite(until) && until > Date.now();
}

function throwOnError(error: { code?: string | null; message?: string | null } | null, operation: string): void {
  if (!error) return;
  // Keep PII and raw SQL/error text out of application logs.
  console.error("[delete-resident] operation failed", {
    operation,
    code: error.code ?? "unknown",
  });
  throw new Error(operation);
}

function toStoragePath(value: unknown, bucket: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  let path = raw;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/i);
      if (!match || match[1] !== bucket) return null;
      path = decodeURIComponent(match[2]);
    } catch {
      return null;
    }
  }

  path = path.replace(/^\/+/, "");
  if (path.startsWith(`${bucket}/`)) path = path.slice(bucket.length + 1);
  if (!path || path.split("/").some((part) => part === ".." || part === ".")) return null;
  return path;
}

async function listStorageFilesRecursively(
  admin: ReturnType<typeof createSupabaseClient>,
  bucket: string,
  prefix: string,
  files: Set<string>,
  depth = 0,
): Promise<void> {
  if (depth > 8) throw new Error(`storage_depth_${bucket}`);
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  throwOnError(error, `storage_list_${bucket}`);

  for (const item of data ?? []) {
    if (!item?.name || item.name === "." || item.name === "..") continue;
    const fullPath = `${prefix}/${item.name}`.replace(/\/+/g, "/");
    const entry = item as { id?: string | null; metadata?: Record<string, unknown> | null };
    const isFolder = entry.id == null && entry.metadata == null;
    if (isFolder) {
      await listStorageFilesRecursively(admin, bucket, fullPath, files, depth + 1);
    } else {
      files.add(fullPath);
    }
  }
}

async function removeStorageFiles(
  admin: ReturnType<typeof createSupabaseClient>,
  bucket: string,
  paths: Set<string>,
): Promise<void> {
  const allPaths = [...paths].filter(Boolean);
  // Supabase Storage accepts path arrays. Batching avoids oversized requests.
  for (let index = 0; index < allPaths.length; index += 100) {
    const { error } = await admin.storage.from(bucket).remove(allPaths.slice(index, index + 100));
    throwOnError(error, `storage_remove_${bucket}`);
  }
}

async function deleteResidentStorage(
  admin: ReturnType<typeof createSupabaseClient>,
  profile: ProfileForDeletion,
  kycPaths: string[],
): Promise<void> {
  const identityPrefixes = [...new Set([profile.id, profile.user_id].filter((value): value is string => Boolean(value)))];
  const photoPaths = new Set<string>();
  const kycFilePaths = new Set<string>();

  for (const value of [profile.avatar_url, ...(profile.photo_urls ?? [])]) {
    const path = toStoragePath(value, "user-uploads");
    if (path) photoPaths.add(path);
  }

  for (const value of kycPaths) {
    const path = toStoragePath(value, "kyc-vault");
    if (path) kycFilePaths.add(path);
  }

  // Also remove orphan files: KYC uploads can succeed even if their DB insert fails.
  for (const prefix of identityPrefixes) {
    await listStorageFilesRecursively(admin, "user-uploads", prefix, photoPaths);
    await listStorageFilesRecursively(admin, "kyc-vault", prefix, kycFilePaths);
  }

  await removeStorageFiles(admin, "kyc-vault", kycFilePaths);
  await removeStorageFiles(admin, "user-uploads", photoPaths);
}

async function deleteProfileBlockingRelations(
  admin: ReturnType<typeof createSupabaseClient>,
  profileId: string,
): Promise<void> {
  // Nullable foreign keys without ON DELETE SET NULL must be cleared explicitly.
  const nullableReferences: Array<{ table: string; column: string }> = [
    { table: "gamification_transactions", column: "created_by" },
    { table: "manager_locations", column: "assigned_by" },
    { table: "partner_blacklist", column: "created_by" },
    { table: "resident_applications", column: "reviewed_by" },
    { table: "role_audit_log", column: "changed_by" },
    { table: "tours", column: "created_by" },
  ];

  for (const reference of nullableReferences) {
    const { error } = await admin
      .from(reference.table)
      .update({ [reference.column]: null })
      .eq(reference.column, profileId);
    throwOnError(error, `clear_${reference.table}_${reference.column}`);
  }

  // These records are owned by or directly describe the resident. Several of their
  // FKs are RESTRICT/NO ACTION in the current dump, so remove them before their parent.
  const { data: castings, error: castingsError } = await admin
    .from("partner_castings")
    .select("id")
    .eq("manager_id", profileId);
  throwOnError(castingsError, "load_resident_castings");
  const castingIds = (castings ?? []).map((row: { id: string }) => row.id);

  const { data: tours, error: toursError } = await admin
    .from("partner_tours")
    .select("id")
    .eq("manager_id", profileId);
  throwOnError(toursError, "load_resident_partner_tours");
  const tourIds = (tours ?? []).map((row: { id: string }) => row.id);

  const { data: contracts, error: contractsError } = await admin
    .from("partner_contracts")
    .select("id")
    .eq("created_by", profileId);
  throwOnError(contractsError, "load_resident_contracts");
  const contractIds = new Set<string>((contracts ?? []).map((row: { id: string }) => row.id));

  if (tourIds.length) {
    const { data: tourContracts, error: tourContractsError } = await admin
      .from("partner_contracts")
      .select("id")
      .in("tour_id", tourIds);
    throwOnError(tourContractsError, "load_tour_contracts");
    for (const row of tourContracts ?? []) contractIds.add((row as { id: string }).id);

    // partner_events.tour_id is ON DELETE RESTRICT, so clear events before tours.
    const { error } = await admin.from("partner_events").delete().in("tour_id", tourIds);
    throwOnError(error, "delete_tour_events");
  }

  // Remove events whose actor/subject was the resident, even if another manager owns the tour.
  const { error: identityEventsError } = await admin
    .from("partner_events")
    .delete()
    .or(`actor_id.eq.${profileId},subject_id.eq.${profileId}`);
  throwOnError(identityEventsError, "delete_resident_events");

  // partner_contract_signatures has NO ACTION on signer_id and contract_id.
  const { error: signerSignaturesError } = await admin
    .from("partner_contract_signatures")
    .delete()
    .eq("signer_id", profileId);
  throwOnError(signerSignaturesError, "delete_resident_signatures");

  if (contractIds.size) {
    const ids = [...contractIds];
    const { error } = await admin.from("partner_contract_signatures").delete().in("contract_id", ids);
    throwOnError(error, "delete_contract_signatures");

    // partner_contracts.created_by is NOT NULL and has no ON DELETE action.
    const { error: contractsDeleteError } = await admin.from("partner_contracts").delete().in("id", ids);
    throwOnError(contractsDeleteError, "delete_resident_contracts");
  }

  if (tourIds.length) {
    const { error } = await admin.from("partner_tours").delete().in("id", tourIds);
    throwOnError(error, "delete_resident_partner_tours");
  }

  if (castingIds.length) {
    const { error: responsesError } = await admin.from("partner_casting_responses").delete().in("casting_id", castingIds);
    throwOnError(responsesError, "delete_casting_responses");
    const { error: castingsDeleteError } = await admin.from("partner_castings").delete().in("id", castingIds);
    throwOnError(castingsDeleteError, "delete_resident_castings");
  }

  // resident_id is NOT NULL and has no ON DELETE action on these rows.
  const { error: membersError } = await admin
    .from("partner_tour_members")
    .delete()
    .eq("resident_id", profileId);
  throwOnError(membersError, "delete_resident_tour_members");

  // A normalized activity references applications without ON DELETE CASCADE.
  // Delete those activity rows before deleting the resident's application rows.
  const { error: residentActivitiesError } = await admin
    .from("resident_activities")
    .delete()
    .eq("profile_id", profileId);
  throwOnError(residentActivitiesError, "delete_resident_activities");

  const { data: applications, error: applicationsError } = await admin
    .from("applications")
    .select("id")
    .eq("user_id", profileId);
  throwOnError(applicationsError, "load_resident_applications");
  const applicationIds = (applications ?? []).map((row: { id: string }) => row.id);
  if (applicationIds.length) {
    const { error } = await admin.from("resident_activities").delete().in("source_application_id", applicationIds);
    throwOnError(error, "delete_application_activities");
  }

  const { data: eventApplications, error: eventApplicationsError } = await admin
    .from("event_applications")
    .select("id")
    .eq("user_id", profileId);
  throwOnError(eventApplicationsError, "load_resident_event_applications");
  const eventApplicationIds = (eventApplications ?? []).map((row: { id: string }) => row.id);
  if (eventApplicationIds.length) {
    const { error } = await admin.from("resident_activities").delete().in("source_event_application_id", eventApplicationIds);
    throwOnError(error, "delete_event_application_activities");
  }
}

/**
 * Permanently deletes a resident. The session client authenticates the caller;
 * all privileged reads/writes and Auth administration use service_role only.
 * A successful call redirects to /admin/database.
 */
export async function deleteResidentCompletely(
  profileId: string,
  typedConfirmationPhrase: string,
): Promise<DeleteResult> {
  if (!UUID_RE.test(profileId) || typedConfirmationPhrase?.trim() !== CONFIRMATION_PHRASE) {
    return { ok: false, reason: "invalid" };
  }

  const session = await createSessionClient();
  const { data: authData, error: authError } = await session.auth.getUser();
  if (authError || !authData.user) return { ok: false, reason: "unauthenticated" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[delete-resident] service-role configuration is missing");
    return { ok: false, reason: "server_error" };
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "voyage-owner-resident-deletion" } },
  });

  try {
    let actor: { id: string; role: string; banned_until?: string | null; ban_permanent?: boolean | null } | null = null;
    const { data: actorByUserId, error: actorByUserIdError } = await admin
      .from("profiles")
      .select("id,role,banned_until,ban_permanent")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    throwOnError(actorByUserIdError, "load_actor_by_user_id");
    actor = actorByUserId;

    if (!actor) {
      const { data: legacyActor, error: legacyActorError } = await admin
        .from("profiles")
        .select("id,role,banned_until,ban_permanent")
        .eq("id", authData.user.id)
        .maybeSingle();
      throwOnError(legacyActorError, "load_legacy_actor");
      actor = legacyActor;
    }

    if (!actor || actor.role !== "owner" || isBanActive(actor)) {
      return { ok: false, reason: "forbidden" };
    }

    const { data: rawProfile, error: profileError } = await admin
      .from("profiles")
      .select("id,user_id,role,telegram_id,telegram_username,email,avatar_url,photo_urls")
      .eq("id", profileId)
      .maybeSingle();
    throwOnError(profileError, "load_target_profile");
    if (!rawProfile) return { ok: false, reason: "not_found" };
    const profile = rawProfile as ProfileForDeletion;
    if (profile.role !== "resident") return { ok: false, reason: "not_resident" };
    if (profile.user_id && !UUID_RE.test(profile.user_id)) return { ok: false, reason: "server_error" };

    const telegramId = typeof profile.telegram_id === "string" && /^\d{4,20}$/.test(profile.telegram_id)
      ? profile.telegram_id
      : null;

    const { data: kycRows, error: kycError } = await admin
      .from("kyc_submissions")
      .select("file_path")
      .eq("profile_id", profileId);
    throwOnError(kycError, "load_kyc_files");
    const kycPaths = (kycRows ?? []).map((row: { file_path: string }) => row.file_path).filter(Boolean);

    // Remove original KYC and portfolio objects, including orphan uploads, before deleting metadata.
    await deleteResidentStorage(admin, profile, kycPaths);

    // Telegram registration must start from a genuinely clean state on /start.
    if (telegramId) {
      const { error: conversationError } = await admin.from("telegram_conversations").delete().eq("telegram_id", telegramId);
      throwOnError(conversationError, "delete_telegram_conversation");
      const { error: preferencesError } = await admin.from("telegram_preferences").delete().eq("telegram_id", telegramId);
      throwOnError(preferencesError, "delete_telegram_preferences");
      const { error: guestByTelegramError } = await admin.from("guest_applications").delete().eq("telegram_id", telegramId);
      throwOnError(guestByTelegramError, "delete_telegram_guest_applications");
      const { error: recoveryByTelegramError } = await admin.from("telegram_identity_recovery_tokens").delete().eq("used_by_telegram_id", telegramId);
      throwOnError(recoveryByTelegramError, "delete_telegram_recovery_traces");
    }

    const { error: guestByProfileError } = await admin.from("guest_applications").delete().eq("linked_profile_id", profileId);
    throwOnError(guestByProfileError, "delete_linked_guest_applications");

    // Handle every NO ACTION / RESTRICT relationship found in the supplied SQL dump.
    await deleteProfileBlockingRelations(admin, profileId);

    // profile_id / resident_id cascades now remove KYC rows, stamps, score events,
    // achievements, metrics, resident requests, history, and Telegram delivery records.
    if (profile.user_id) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(profile.user_id);
      throwOnError(authDeleteError, "delete_auth_user");
    }

    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", profileId);
    throwOnError(profileDeleteError, "delete_profile_row");
  } catch {
    // Non-transactional resources (Storage + Auth Admin API) may already have been
    // processed. Report this honestly so the operator checks the server log before retrying.
    return { ok: false, reason: "server_error" };
  }

  revalidatePath("/admin/database");
  revalidatePath(`/admin/database/${profileId}`);
  redirect("/admin/database");
}
