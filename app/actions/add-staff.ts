"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

export type NewStaffRole = "manager" | "admin";

export type AddStaffErrorCode =
  | "not_authenticated"
  | "owner_only"
  | "invalid_name"
  | "invalid_email"
  | "invalid_role"
  | "email_already_exists"
  | "create_failed"
  | "role_assign_failed"
  | "profile_update_failed"
  | "token_create_failed"
  | "server_error";

export type AddStaffResult =
  | {
      ok: true;
      link: string;
      token: string;
      expiresAt: string;
      profileId: string;
      fullName: string;
      email: string;
      role: NewStaffRole;
    }
  | { ok: false; error: AddStaffErrorCode };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

/**
 * Creates staff accounts exclusively on behalf of the current owner.
 * The bootstrap password only exists in this invocation: it is never returned,
 * logged, or written to public.profiles. Supabase Auth stores its own password hash.
 */
export async function addStaff(input: {
  full_name?: unknown;
  email?: unknown;
  role?: unknown;
}): Promise<AddStaffResult> {
  const sessionClient = await createClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  const actorUser = authData.user;
  if (authError || !actorUser) return { ok: false, error: "not_authenticated" };

  const { data: actorProfile, error: actorProfileError } = await sessionClient
    .from("profiles")
    .select("role,banned_until,ban_permanent")
    .eq("id", actorUser.id)
    .maybeSingle();

  if (actorProfileError || !actorProfile) return { ok: false, error: "owner_only" };
  const actorBannedUntil = typeof actorProfile.banned_until === "string"
    ? Date.parse(actorProfile.banned_until)
    : Number.NaN;
  if (
    actorProfile.ban_permanent === true ||
    actorProfile.banned_until === "infinity" ||
    (Number.isFinite(actorBannedUntil) && actorBannedUntil > Date.now())
  ) {
    return { ok: false, error: "owner_only" };
  }
  if (String(actorProfile.role) !== "owner") return { ok: false, error: "owner_only" };

  const fullName = cleanText(input?.full_name, 100);
  const email = cleanText(input?.email, 254).toLowerCase();
  const role = input?.role;

  if (fullName.length < 2) return { ok: false, error: "invalid_name" };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: "invalid_email" };
  if (role !== "manager" && role !== "admin") return { ok: false, error: "invalid_role" };

  const botUsername = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(botUsername)) {
    console.error("[add-staff] NEXT_PUBLIC_BOT_USERNAME is missing or invalid");
    return { ok: false, error: "server_error" };
  }

  const service = getTelegramServiceClient();
  // This random bootstrap password is never returned or stored in application tables.
  let bootstrapPassword = randomBytes(48).toString("base64url");
  let createdUserId: string | null = null;

  const rollbackCreatedUser = async () => {
    if (!createdUserId) return;
    const { error } = await service.auth.admin.deleteUser(createdUserId);
    if (error) {
      // Do not log credentials or token material. The ID is enough for server-side cleanup.
      console.error("[add-staff] cleanup after failed provisioning failed", {
        userId: createdUserId,
        code: error.code ?? "unknown",
      });
    }
  };

  try {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password: bootstrapPassword,
      email_confirm: true,
      user_metadata: { name: fullName, full_name: fullName, created_by: "owner_staff_invitation" },
    });
    // The randomly generated bootstrap password must not be retained by app code.
    bootstrapPassword = "";

    if (createError || !created.user) {
      const duplicate = /already|registered|exists|duplicate/i.test(createError?.message ?? "");
      console.warn("[add-staff] Auth user creation failed", { code: createError?.code ?? "unknown" });
      return { ok: false, error: duplicate ? "email_already_exists" : "create_failed" };
    }
    createdUserId = created.user.id;

    if (!UUID_RE.test(createdUserId)) {
      await rollbackCreatedUser();
      return { ok: false, error: "create_failed" };
    }

    // The database trigger creates public.profiles as a resident. Promote it through
    // the existing owner-only audited RPC, not a client-supplied role update.
    const { error: roleError } = await sessionClient.rpc("admin_change_staff_role", {
      p_target: createdUserId,
      p_new_role: role,
    });
    if (roleError) {
      console.error("[add-staff] role assignment failed", { code: roleError.code ?? "unknown" });
      await rollbackCreatedUser();
      return { ok: false, error: "role_assign_failed" };
    }

    const { data: updatedProfile, error: profileError } = await service
      .from("profiles")
      .update({
        full_name: fullName,
        name: fullName,
        email,
        status: "approved",
        registration_source: "staff_created",
      })
      .eq("id", createdUserId)
      .select("id")
      .maybeSingle();

    if (profileError || !updatedProfile) {
      console.error("[add-staff] profile update failed", { code: profileError?.code ?? "missing_profile" });
      await rollbackCreatedUser();
      return { ok: false, error: "profile_update_failed" };
    }

    // The current grammY handler accepts start=recover_<43-char-token>, hashes only
    // the raw token, and consumes it through consume_telegram_identity_recovery.
    const rawToken = randomBytes(32).toString("base64url");
    const token = `recover_${rawToken}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);

    const { error: tokenError } = await service.from("telegram_identity_recovery_tokens").insert({
      token_hash: tokenHash,
      profile_id: createdUserId,
      created_by: actorUser.id,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (tokenError) {
      console.error("[add-staff] recovery token creation failed", { code: tokenError.code ?? "unknown" });
      await rollbackCreatedUser();
      return { ok: false, error: "token_create_failed" };
    }

    revalidatePath("/admin/roles");
    revalidatePath("/admin/database");
    revalidatePath("/admin");

    return {
      ok: true,
      token,
      link: `https://t.me/${botUsername}?start=${token}`,
      expiresAt: expiresAt.toISOString(),
      profileId: createdUserId,
      fullName,
      email,
      role,
    };
  } catch (error) {
    console.error("[add-staff] unexpected provisioning error", error instanceof Error ? error.name : "unknown");
    await rollbackCreatedUser();
    return { ok: false, error: "server_error" };
  } finally {
    // Best-effort reference drop. The password was never returned, logged or persisted.
    bootstrapPassword = "";
  }
}
