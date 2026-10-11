"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
};

export type ResidentRecord = {
  id: string;
  full_name: string | null;
  name: string | null;
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
    .select("id, full_name, email, role, status, banned_until, ban_reason, ban_permanent, ban_set_at")
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
      "id, full_name, name, email, telegram_id, usdt_wallet, tour_points, influence_index, reliability, segment, role, circle, kyc_level, status, location, citizenship, banned_until, ban_reason, ban_permanent, ban_set_at, created_at",
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
  return {
    ok: true,
    rows: (data ?? []) as ResidentRecord[],
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
