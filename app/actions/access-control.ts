"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

export type BanDuration = "24_hours" | "1_week" | "1_month" | "forever";
export type StaffRole = "admin" | "manager" | "resident";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

export type StaffRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "manager";
  status: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  ban_permanent: boolean;
  ban_set_at: string | null;
  last_seen_at: string | null;
};

export type ResidentRecord = {
  id: string;
  full_name: string | null;
  name: string | null;
  avatar_url: string | null;
  photo_urls: string[] | null;
  resolved_avatar_url?: string | null;
  email: string | null;
  telegram_id: string | null;
  usdt_wallet: string | null;
  tour_points: number | null;
  influence_index: number | null;
  reliability: number | null;
  segment: "working" | "elite" | string;
  role: string;
  circle: string | null;
  kyc_level: number | null;
  status: string | null;
  location: string | null;
  citizenship: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  ban_permanent: boolean;
  ban_set_at: string | null;
  created_at: string | null;
  last_seen_at: string | null;
};

async function getActor(allowedRoles: readonly string[]) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;

  if (authError || !user) {
    return { ok: false as const, error: "Необходима авторизация." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, banned_until, ban_permanent")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false as const, error: "Не удалось проверить права доступа. Обновите страницу или обратитесь к администратору." };
  }

  const activeBan =
    profile.ban_permanent === true ||
    (typeof profile.banned_until === "string" &&
      (profile.banned_until === "infinity" || Date.parse(profile.banned_until) > Date.now()));

  if (activeBan) return { ok: false as const, error: "Аккаунт заблокирован." };
  if (!allowedRoles.includes(String(profile.role))) {
    return { ok: false as const, error: "Недостаточно прав для этого действия." };
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    role: String(profile.role),
  };
}

export async function getStaffUsers(): Promise<
  | { ok: true; rows: StaffRecord[] }
  | { ok: false; error: string }
> {
  const actor = await getActor(["owner"]);
  if (!actor.ok) return actor;

  const { data, error } = await actor.supabase
    .from("profiles")
    .select("id, full_name, email, role, status, banned_until, ban_reason, ban_permanent, ban_set_at, last_seen_at")
    .in("role", ["admin", "manager"])
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as StaffRecord[] };
}

export async function getResidentRegistry(
  page = 0,
  rawSearch = "",
): Promise<
  | { ok: true; rows: ResidentRecord[]; count: number; page: number }
  | { ok: false; error: string }
> {
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;

  const pageSize = 50;
  const safePage = Number.isInteger(page) ? Math.max(0, Math.min(page, 100_000)) : 0;
  const search = rawSearch
    .replace(/[^a-zA-Z0-9@._\-\s\u00C0-\u024F\u0400-\u04FF]/g, "")
    .trim()
    .slice(0, 80);

  let query = actor.supabase
    .from("profiles")
    .select(
      "id, full_name, name, avatar_url, photo_urls, email, telegram_id, usdt_wallet, tour_points, influence_index, reliability, segment, role, circle, kyc_level, status, location, citizenship, banned_until, ban_reason, ban_permanent, ban_set_at, created_at, last_seen_at",
      { count: "exact" },
    )
    .eq("role", "resident")
    .order("created_at", { ascending: false })
    .range(safePage * pageSize, safePage * pageSize + pageSize - 1);

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,email.ilike.%${search}%,telegram_id.ilike.%${search}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as ResidentRecord[];
  const candidates = rows.map((row) => row.avatar_url?.trim() || row.photo_urls?.find((value) => Boolean(value?.trim())) || null);
  const paths = Array.from(new Set(candidates.filter((value): value is string => typeof value === "string" && value.length > 0 && !/^https?:\/\//i.test(value))));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: signedRows, error: signedError } = await actor.supabase.storage.from("user-uploads").createSignedUrls(paths, 3600);
    if (signedError) console.error("[resident-registry] avatar signing failed", { code: signedError.name });
    signedRows?.forEach((entry, index) => { if (entry.signedUrl) signed.set(paths[index], entry.signedUrl); });
  }
  const resolvedRows = rows.map((row, index) => {
    const value = candidates[index];
    return { ...row, resolved_avatar_url: !value ? null : /^https?:\/\//i.test(value) ? value : signed.get(value) ?? null };
  });
  return {
    ok: true,
    rows: resolvedRows,
    count: count ?? 0,
    page: safePage,
  };
}

export async function setAccountBan(
  targetId: string,
  duration: BanDuration,
  reason: string,
): Promise<ActionResult> {
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;

  const safeReason = reason.trim();
  if (!targetId || !["24_hours", "1_week", "1_month", "forever"].includes(duration)) {
    return { ok: false, error: "Некорректный получатель или срок блокировки." };
  }
  if (!safeReason || safeReason.length > 500) {
    return { ok: false, error: "Укажите причину блокировки (до 500 символов)." };
  }

  const { error } = await actor.supabase.rpc("admin_set_user_ban", {
    p_target: targetId,
    p_duration: duration,
    p_reason: safeReason,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/roles");
  revalidatePath("/admin/database");
  return { ok: true, message: "Блокировка установлена." };
}

export async function clearAccountBan(targetId: string): Promise<ActionResult> {
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;
  if (!targetId) return { ok: false, error: "Не указан профиль." };

  const { error } = await actor.supabase.rpc("admin_clear_user_ban", {
    p_target: targetId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/roles");
  revalidatePath("/admin/database");
  return { ok: true, message: "Блокировка снята." };
}

export async function changeStaffRole(
  targetId: string,
  role: StaffRole,
): Promise<ActionResult> {
  const actor = await getActor(["owner"]);
  if (!actor.ok) return actor;

  if (!targetId || !["admin", "manager", "resident"].includes(role)) {
    return { ok: false, error: "Недопустимая роль." };
  }

  const { error } = await actor.supabase.rpc("admin_change_staff_role", {
    p_target: targetId,
    p_new_role: role,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/roles");
  return { ok: true, message: "Роль обновлена." };
}


export type TelegramRecoveryLinkResult =
  | { ok: true; link: string; expiresAt: string; profileName: string }
  | { ok: false; error: string };

/** Issue a short-lived one-time Telegram identity rebind link. Raw tokens are never stored. */
export async function createTelegramRecoveryLink(targetId: string): Promise<TelegramRecoveryLinkResult> {
  const actor = await getActor(["owner", "admin"]);
  if (!actor.ok) return actor;
  if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
    return { ok: false, error: "Некорректный ID профиля." };
  }

  const { data: profile, error: profileError } = await actor.supabase
    .from("profiles")
    .select("id,full_name,email,role,status,banned_until,ban_permanent")
    .eq("id", targetId)
    .maybeSingle();
  if (profileError || !profile) return { ok: false, error: "Профиль не найден." };

  const targetRole = String(profile.role ?? "");
  if (!["resident", "admin", "manager"].includes(targetRole)) {
    return { ok: false, error: "Перепривязка для этой роли запрещена." };
  }
  if (actor.role === "admin" && targetRole !== "resident") {
    return { ok: false, error: "Администратор может выпускать ссылки только для резидентов." };
  }
  if (targetRole === "resident" && profile.status !== "approved") {
    return { ok: false, error: "Сначала профиль должен пройти Face Control." };
  }
  const bannedUntil = typeof profile.banned_until === "string" ? Date.parse(profile.banned_until) : NaN;
  if (profile.ban_permanent === true || profile.banned_until === "infinity" || (Number.isFinite(bannedUntil) && bannedUntil > Date.now())) {
    return { ok: false, error: "Нельзя перепривязать заблокированный профиль. Сначала снимите блокировку." };
  }

  const botUsername = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(botUsername)) {
    return { ok: false, error: "Не задан корректный NEXT_PUBLIC_BOT_USERNAME." };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
  const service = getTelegramServiceClient();

  // Older links stop working as soon as a new one is issued for the same profile.
  const { error: revokeError } = await service
    .from("telegram_identity_recovery_tokens")
    .update({ revoked_at: createdAt.toISOString() })
    .eq("profile_id", targetId)
    .is("used_at", null)
    .is("revoked_at", null);
  if (revokeError) {
    console.error("[identity-recovery] token revocation failed", revokeError.code ?? "unknown");
    return { ok: false, error: "Не удалось подготовить ссылку восстановления. Повторите попытку." };
  }

  const { error: insertError } = await service.from("telegram_identity_recovery_tokens").insert({
    token_hash: tokenHash,
    profile_id: targetId,
    created_by: actor.userId,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) {
    console.error("[identity-recovery] token insert failed", insertError.code ?? "unknown");
    return { ok: false, error: "Не удалось сохранить ссылку восстановления. Повторите попытку." };
  }

  revalidatePath("/admin/database");
  revalidatePath("/admin/roles");
  return {
    ok: true,
    link: `https://t.me/${botUsername}?start=recover_${rawToken}`,
    expiresAt: expiresAt.toISOString(),
    profileName: profile.full_name?.trim() || profile.email || targetId,
  };
}
