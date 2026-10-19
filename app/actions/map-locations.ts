"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

type AssignmentRole = "manager" | "admin";
type TelegramLang = "EN" | "RU" | "ES" | "PT";
type ActionError = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "server_error";

export type MapHubStaff = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "manager";
  telegram_id: string | null;
};

export type MapHubApplication = {
  id: string;
  user_id: string;
  hub_id: string;
  status: "pending" | "approved" | "rejected" | "completed" | string;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    photo_urls: string[] | null;
    resolved_avatar_url: string | null;
    segment: string | null;
    level: number | null;
    reliability: number | string | null;
    location: string | null;
    citizenship: string | null;
    birth_date: string | null;
    height: number | string | null;
    weight: number | string | null;
    measurements: string | null;
    smoking: boolean | null;
    alcohol: boolean | null;
    about: string | null;
    status: string | null;
    kyc_level: number | null;
    telegram_id: string | null;
  } | null;
};

export type MapHubAssignment = {
  hub_id: string;
  assignment_role: AssignmentRole;
  profile_id: string;
  assigned_by: string | null;
  created_at: string;
};

export type MapHubManagementData = {
  ok: true;
  notificationsEnabled: boolean;
  applications: MapHubApplication[];
  assignments: MapHubAssignment[];
  staff: MapHubStaff[];
  actorRole: "owner" | "admin";
};

async function getActor(allowedRoles: readonly string[]) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false as const, reason: "unauthenticated" as const };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,banned_until,ban_permanent")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile) return { ok: false as const, reason: "server_error" as const };

  const isBanned = profile.ban_permanent === true ||
    (typeof profile.banned_until === "string" &&
      (profile.banned_until === "infinity" || Date.parse(profile.banned_until) > Date.now()));
  if (isBanned || !allowedRoles.includes(String(profile.role))) {
    return { ok: false as const, reason: "forbidden" as const };
  }

  return { ok: true as const, supabase, userId: auth.user.id, role: String(profile.role) as "owner" | "admin" | "manager" | "resident" };
}

function cleanHubId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const safe = value.trim();
  return safe.length > 0 && safe.length <= 120 ? safe : null;
}

function normalizeLang(value: unknown): TelegramLang {
  const lang = String(value ?? "").toUpperCase();
  return (["EN", "RU", "ES", "PT"].includes(lang) ? lang : "EN") as TelegramLang;
}

function localized(value: unknown, lang: TelegramLang): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const selected = record[lang] ?? record.EN ?? record.RU;
    if (typeof selected === "string" && selected.trim()) return selected.trim();
  }
  return typeof value === "string" && value.trim() ? value.trim() : "VOYAGE";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] ?? char));
}

const APPLICATION_COPY: Record<TelegramLang, { title: string; location: string; model: string; status: string; pending: string }> = {
  EN: { title: "New map location application", location: "Location", model: "Model", status: "Status", pending: "Pending review" },
  RU: { title: "Новый отклик по локации", location: "Локация", model: "Модель", status: "Статус", pending: "Ожидает рассмотрения" },
  ES: { title: "Nueva solicitud para una ubicación", location: "Ubicación", model: "Modelo", status: "Estado", pending: "Pendiente de revisión" },
  PT: { title: "Nova candidatura para localização", location: "Localização", model: "Modelo", status: "Estado", pending: "Aguardando análise" },
};
const TEST_COPY: Record<TelegramLang, { title: string; location: string; body: string }> = {
  EN: { title: "VOYAGE location notification test", location: "Location", body: "Telegram notifications are connected for this location." },
  RU: { title: "Проверка Telegram-оповещений VOYAGE", location: "Локация", body: "Telegram-оповещения для этой локации подключены." },
  ES: { title: "Prueba de notificaciones VOYAGE", location: "Ubicación", body: "Las notificaciones de Telegram están conectadas para esta ubicación." },
  PT: { title: "Teste de notificações VOYAGE", location: "Localização", body: "As notificações do Telegram estão conectadas para esta localização." },
};

async function notifyHubResponsibles(hubId: string, modelName: string | null, test = false): Promise<number> {
  try {
    const db = getTelegramServiceClient();
    const { data: hub, error: hubError } = await db.from("map_hubs")
      .select("id,name,notify_responsibles")
      .eq("id", hubId)
      .maybeSingle();
    if (hubError || !hub) throw hubError ?? new Error("map_hub_not_found");
    if (!test && hub.notify_responsibles === false) return 0;

    const { data: assignments, error: assignmentError } = await db.from("map_hub_assignments")
      .select("profile_id,assignment_role")
      .eq("hub_id", hubId);
    if (assignmentError) throw assignmentError;
    const profileIds = Array.from(new Set((assignments ?? []).map((row) => String(row.profile_id)).filter(Boolean)));
    if (!profileIds.length) return 0;

    const { data: profiles, error: profileError } = await db.from("profiles")
      .select("id,full_name,name,role,telegram_id,telegram_language")
      .in("id", profileIds);
    if (profileError) throw profileError;

    const eligible = (profiles ?? []).filter((profile) =>
      ["owner", "admin", "manager"].includes(String(profile.role)) &&
      typeof profile.telegram_id === "string" && /^\d{4,20}$/.test(profile.telegram_id),
    );
    const chatIds = Array.from(new Set(eligible.map((profile) => String(profile.telegram_id))));
    const languageByChatId = new Map<string, TelegramLang>();
    eligible.forEach((profile) => {
      const chatId = String(profile.telegram_id);
      if (!languageByChatId.has(chatId)) languageByChatId.set(chatId, normalizeLang(profile.telegram_language));
    });

    // Respect the separately stored Telegram language preference when it exists.
    if (chatIds.length) {
      const { data: preferences, error: preferenceError } = await db.from("telegram_preferences")
        .select("telegram_id,language")
        .in("telegram_id", chatIds);
      if (preferenceError) console.warn("[map-hub-telegram] preferences unavailable", preferenceError.code);
      for (const preference of preferences ?? []) {
        if (chatIds.includes(String(preference.telegram_id))) {
          languageByChatId.set(String(preference.telegram_id), normalizeLang(preference.language));
        }
      }
    }

    if (!chatIds.length) return 0;
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    const bot = getVoyageTelegramBot();
    const delivered = new Set<string>();
    let sent = 0;
    for (const profile of eligible) {
      const chatId = String(profile.telegram_id);
      // A user assigned in both slots receives a single message per new application.
      if (delivered.has(chatId)) continue;
      delivered.add(chatId);
      const lang = languageByChatId.get(chatId) ?? "EN";
      const hubName = localized(hub.name, lang);
      const lines: string[] = [];
      if (test) {
        const copy = TEST_COPY[lang];
        lines.push(`<b>${escapeHtml(copy.title)}</b>`, `${escapeHtml(copy.location)}: <b>${escapeHtml(hubName)}</b>`, escapeHtml(copy.body));
      } else {
        const copy = APPLICATION_COPY[lang];
        lines.push(`<b>${escapeHtml(copy.title)}</b>`, `${escapeHtml(copy.location)}: <b>${escapeHtml(hubName)}</b>`, `${escapeHtml(copy.model)}: <b>${escapeHtml(modelName || "VOYAGE Resident")}</b>`, `${escapeHtml(copy.status)}: ${escapeHtml(copy.pending)}`);
      }
      try {
        await bot.api.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
        sent += 1;
      } catch (error) {
        console.error("[map-hub-telegram] delivery failed", { hubId, chatId, reason: error instanceof Error ? error.message : "unknown" });
      }
    }
    return sent;
  } catch (error) {
    // Telegram failures must never turn a successful application into a failed submit.
    console.error("[map-hub-telegram] notification failed", { hubId, reason: error instanceof Error ? error.message : "unknown" });
    return 0;
  }
}

export async function submitMapHubApplication(hubIdInput: string): Promise<{ ok: true } | { ok: false; reason: ActionError | "duplicate" }> {
  const hubId = cleanHubId(hubIdInput);
  if (!hubId) return { ok: false, reason: "invalid" };
  const actor = await getActor(["resident"]);
  if (!actor.ok) return actor;

  const db = getTelegramServiceClient();
  const { data: hub, error: hubError } = await db.from("map_hubs")
    .select("id,is_active,notify_responsibles")
    .eq("id", hubId)
    .maybeSingle();
  if (hubError || !hub) return { ok: false, reason: hubError ? "server_error" : "not_found" };
  if (hub.is_active === false) return { ok: false, reason: "forbidden" };

  const { data: existing, error: existingError } = await db.from("applications")
    .select("id,status,created_at")
    .eq("user_id", actor.userId)
    .eq("hub_id", hubId)
    .in("status", ["pending", "approved"])
    .limit(1)
    .maybeSingle();
  if (existingError) return { ok: false, reason: "server_error" };
  if (existing) return { ok: false, reason: "duplicate" };

  // Application rows reference public.profiles(id), which in this project is the auth UUID.
  // Use the already-authorized server client so insertion is not blocked by client RLS policies.
  const { error: insertError } = await db.from("applications").insert({
    user_id: actor.userId,
    hub_id: hubId,
    status: "pending",
  });
  if (insertError) {
    if (insertError.code === "23505") return { ok: false, reason: "duplicate" };
    console.error("[map-hub-application] insert failed", { code: insertError.code, message: insertError.message });
    return { ok: false, reason: "server_error" };
  }

  const { data: model } = await db.from("profiles").select("full_name,name").eq("id", actor.userId).maybeSingle();
  await notifyHubResponsibles(hubId, model?.full_name?.trim() || model?.name?.trim() || null, false);
  revalidatePath("/admin/map-locations");
  revalidatePath("/admin/applications");
  return { ok: true };
}

export async function getMapHubManagementData(hubIdInput: string): Promise<MapHubManagementData | { ok: false; reason: ActionError }> {
  const hubId = cleanHubId(hubIdInput);
  if (!hubId) return { ok: false, reason: "invalid" };
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;
  const db = getTelegramServiceClient();

  const [{ data: hub, error: hubError }, { data: appRows, error: appError }, { data: assignments, error: assignmentError }, { data: staff, error: staffError }] = await Promise.all([
    db.from("map_hubs").select("id,notify_responsibles").eq("id", hubId).maybeSingle(),
    db.from("applications").select("id,user_id,hub_id,status,created_at").eq("hub_id", hubId).order("created_at", { ascending: false }),
    db.from("map_hub_assignments").select("hub_id,assignment_role,profile_id,assigned_by,created_at").eq("hub_id", hubId),
    db.from("profiles").select("id,full_name,name,email,role,telegram_id").in("role", ["owner", "admin", "manager"]).order("full_name", { ascending: true }),
  ]);
  if (hubError || appError || assignmentError || staffError || !hub) {
    console.error("[map-hub-management] load failed", { hubError: hubError?.code, appError: appError?.code, assignmentError: assignmentError?.code, staffError: staffError?.code });
    return { ok: false, reason: hub ? "server_error" : "not_found" };
  }

  const rows = appRows ?? [];
  const profileIds = Array.from(new Set(rows.map((row) => String(row.user_id)).filter(Boolean)));
  const profileMap = new Map<string, MapHubApplication["profile"]>();
  if (profileIds.length) {
    const { data: profiles, error: profilesError } = await db.from("profiles")
      .select("id,full_name,name,email,avatar_url,photo_urls,segment,level,reliability,location,citizenship,birth_date,height,weight,measurements,smoking,alcohol,about,status,kyc_level,telegram_id")
      .in("id", profileIds);
    if (profilesError) {
      console.error("[map-hub-management] profiles load failed", profilesError.code);
      return { ok: false, reason: "server_error" };
    }
    const profileRows = profiles ?? [];
    const candidateById = new Map<string, string[]>();
    const storagePaths = new Set<string>();
    for (const profile of profileRows) {
      const candidates = [profile.avatar_url, ...(Array.isArray(profile.photo_urls) ? profile.photo_urls : [])]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim());
      candidateById.set(String(profile.id), candidates);
      for (const candidate of candidates) if (!/^https?:\/\//i.test(candidate)) storagePaths.add(candidate);
    }
    const signedUrlByPath = new Map<string, string>();
    if (storagePaths.size) {
      const paths = Array.from(storagePaths);
      const { data: signedRows, error: signedError } = await db.storage.from("user-uploads").createSignedUrls(paths, 3600);
      if (signedError) console.warn("[map-hub-management] photo signing failed", { code: signedError.name });
      signedRows?.forEach((entry, index) => { if (entry.signedUrl) signedUrlByPath.set(paths[index], entry.signedUrl); });
    }
    for (const profile of profileRows) {
      const candidates = candidateById.get(String(profile.id)) ?? [];
      const resolvedAvatar = candidates.map((candidate) => /^https?:\/\//i.test(candidate) ? candidate : signedUrlByPath.get(candidate) ?? null).find((value) => Boolean(value)) ?? null;
      profileMap.set(String(profile.id), {
        ...profile,
        resolved_avatar_url: resolvedAvatar,
      } as MapHubApplication["profile"]);
    }
  }

  return {
    ok: true,
    notificationsEnabled: hub.notify_responsibles !== false,
    applications: rows.map((row) => ({ ...row, profile: profileMap.get(String(row.user_id)) ?? null })) as MapHubApplication[],
    assignments: (assignments ?? []) as MapHubAssignment[],
    staff: (staff ?? []).map((row) => ({
      id: String(row.id), full_name: row.full_name ?? null, name: row.name ?? null,
      email: row.email ?? null, role: String(row.role) as MapHubStaff["role"], telegram_id: row.telegram_id ?? null,
    })),
    actorRole: actor.role as "owner" | "admin",
  };
}

export async function updateMapHubApplicationStatus(
  applicationId: string,
  status: "approved" | "rejected",
): Promise<{ ok: true } | { ok: false; reason: ActionError }> {
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;
  if (!/^[0-9a-f-]{36}$/i.test(applicationId) || !["approved", "rejected"].includes(status)) return { ok: false, reason: "invalid" };
  const db = getTelegramServiceClient();
  const { data, error } = await db.from("applications").update({ status }).eq("id", applicationId).select("id,hub_id").maybeSingle();
  if (error || !data) return { ok: false, reason: error ? "server_error" : "not_found" };
  revalidatePath("/admin/map-locations");
  revalidatePath("/admin/applications");
  return { ok: true };
}

export async function setMapHubResponsibility(input: {
  hubId: string;
  assignmentRole: AssignmentRole;
  profileId: string | null;
}): Promise<{ ok: true } | { ok: false; reason: ActionError }> {
  const actor = await getActor(["owner"]);
  if (!actor.ok) return actor;
  const hubId = cleanHubId(input?.hubId);
  const slot = input?.assignmentRole;
  if (!hubId || !["manager", "admin"].includes(String(slot))) return { ok: false, reason: "invalid" };
  const db = getTelegramServiceClient();
  if (input.profileId === null) {
    const { error } = await db.from("map_hub_assignments").delete().eq("hub_id", hubId).eq("assignment_role", slot);
    if (error) return { ok: false, reason: "server_error" };
  } else {
    if (typeof input.profileId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.profileId)) return { ok: false, reason: "invalid" };
    const { data: target, error: targetError } = await db.from("profiles").select("id,role").eq("id", input.profileId).maybeSingle();
    if (targetError || !target) return { ok: false, reason: targetError ? "server_error" : "not_found" };
    const allowed = slot === "manager" ? ["manager", "owner"] : ["admin", "owner"];
    if (!allowed.includes(String(target.role))) return { ok: false, reason: "invalid" };
    const { error } = await db.from("map_hub_assignments").upsert({
      hub_id: hubId, assignment_role: slot, profile_id: input.profileId,
      assigned_by: actor.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "hub_id,assignment_role" });
    if (error) return { ok: false, reason: "server_error" };
  }
  revalidatePath("/admin/map-locations");
  revalidatePath("/admin/roles");
  return { ok: true };
}

export async function setMapHubNotifications(input: {
  hubId: string;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; reason: ActionError }> {
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;
  const hubId = cleanHubId(input?.hubId);
  if (!hubId || typeof input.enabled !== "boolean") return { ok: false, reason: "invalid" };
  const db = getTelegramServiceClient();
  const { data, error } = await db.from("map_hubs").update({ notify_responsibles: input.enabled }).eq("id", hubId).select("id").maybeSingle();
  if (error || !data) return { ok: false, reason: error ? "server_error" : "not_found" };
  revalidatePath("/admin/map-locations");
  return { ok: true };
}

export async function sendMapHubTestNotification(hubIdInput: string): Promise<{ ok: true } | { ok: false; reason: ActionError | "no_recipients" }> {
  const hubId = cleanHubId(hubIdInput);
  if (!hubId) return { ok: false, reason: "invalid" };
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;
  const db = getTelegramServiceClient();
  const { data: assignments, error } = await db.from("map_hub_assignments").select("profile_id").eq("hub_id", hubId);
  if (error) return { ok: false, reason: "server_error" };
  if (!(assignments ?? []).length) return { ok: false, reason: "no_recipients" };
  const profileIds = Array.from(new Set(assignments.map((row) => String(row.profile_id))));
  const { data: profiles, error: profilesError } = await db.from("profiles").select("id,telegram_id").in("id", profileIds);
  if (profilesError) return { ok: false, reason: "server_error" };
  if (!(profiles ?? []).some((row) => typeof row.telegram_id === "string" && /^\d{4,20}$/.test(row.telegram_id))) return { ok: false, reason: "no_recipients" };
  const delivered = await notifyHubResponsibles(hubId, null, true);
  if (!delivered) return { ok: false, reason: "server_error" };
  return { ok: true };
}

export type StaffMapHub = { id: string; name: Record<string, string> | string | null; region: string | null };
export type StaffAssignment = { hub_id: string; assignment_role: AssignmentRole; profile_id: string };
export async function getStaffMapHubAssignments(): Promise<
  | { ok: true; hubs: StaffMapHub[]; assignments: StaffAssignment[] }
  | { ok: false; reason: ActionError }
> {
  const actor = await getActor(["owner"]);
  if (!actor.ok) return actor;
  const db = getTelegramServiceClient();
  const [{ data: hubs, error: hubsError }, { data: assignments, error: assignmentError }] = await Promise.all([
    db.from("map_hubs").select("id,name,region").order("region", { ascending: true }).order("id", { ascending: true }),
    db.from("map_hub_assignments").select("hub_id,assignment_role,profile_id"),
  ]);
  if (hubsError || assignmentError) return { ok: false, reason: "server_error" };
  return { ok: true, hubs: (hubs ?? []) as StaffMapHub[], assignments: (assignments ?? []) as StaffAssignment[] };
}

export async function updateResidentLifestylePreference(input: {
  smoking?: boolean;
  alcohol?: boolean;
}): Promise<{ ok: true; smoking: boolean; alcohol: boolean } | { ok: false; reason: ActionError }> {
  const actor = await getActor(["resident"]);
  if (!actor.ok) return actor;
  if (!input || (input.smoking !== undefined && typeof input.smoking !== "boolean") || (input.alcohol !== undefined && typeof input.alcohol !== "boolean") || (input.smoking === undefined && input.alcohol === undefined)) {
    return { ok: false, reason: "invalid" };
  }
  const db = getTelegramServiceClient();
  let profileQuery = await db.from("profiles").select("id").eq("id", actor.userId).maybeSingle();
  if (profileQuery.error) return { ok: false, reason: "server_error" };
  let profileId = profileQuery.data?.id ?? null;
  // Legacy profile records may have a separate profile PK and auth user_id.
  if (!profileId) {
    profileQuery = await db.from("profiles").select("id").eq("user_id", actor.userId).maybeSingle();
    if (profileQuery.error) return { ok: false, reason: "server_error" };
    profileId = profileQuery.data?.id ?? null;
  }
  if (!profileId) return { ok: false, reason: "not_found" };

  const { data, error } = await db.from("profiles").update({
    ...(input.smoking !== undefined ? { smoking: input.smoking } : {}),
    ...(input.alcohol !== undefined ? { alcohol: input.alcohol } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", profileId).select("smoking,alcohol").maybeSingle();
  if (error || !data) return { ok: false, reason: error ? "server_error" : "not_found" };
  revalidatePath("/dashboard");
  return { ok: true, smoking: Boolean(data.smoking), alcohol: Boolean(data.alcohol) };
}
