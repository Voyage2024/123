"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GamificationActionResult =
  | { ok: true; data?: Record<string, unknown> }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdminOrOwner() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false as const, error: "Требуется авторизация." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || (profile.role !== "admin" && profile.role !== "owner")) {
    return { ok: false as const, error: "Действие доступно только ролям admin и owner." };
  }

  return { ok: true as const, supabase };
}

function errorMessage(error: { code?: string; message?: string } | null): string {
  if (error?.code === "42501" || /admin_only|permission denied|row-level security/i.test(error?.message ?? "")) {
    return "Действие доступно только ролям admin и owner.";
  }
  if (error?.code === "23505" || /already_exists/i.test(error?.message ?? "")) {
    return "Такая запись уже существует.";
  }
  if (error?.code === "P0002" || /not_found/i.test(error?.message ?? "")) {
    return "Запись не найдена или больше недоступна.";
  }
  if (/invalid_points|invalid_achievement|destination_required/i.test(error?.message ?? "")) {
    return "Проверьте название, ключ и количество баллов.";
  }
  return "Не удалось выполнить действие. Проверьте данные и повторите попытку.";
}

function revalidateGamification() {
  revalidatePath("/admin/gamification");
  revalidatePath("/dashboard/gamification");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/leaderboard");
}

export async function issueGameStamp(input: {
  profileId: string;
  destinationId: string;
  points?: number | null;
}): Promise<GamificationActionResult> {
  if (!UUID_RE.test(input.profileId) || !input.destinationId.trim()) {
    return { ok: false, error: "Некорректный идентификатор резидента или направления." };
  }
  if (input.points != null && (!Number.isInteger(input.points) || input.points < 0 || input.points > 1_000_000)) {
    return { ok: false, error: "Количество баллов должно быть целым числом от 0 до 1 000 000." };
  }

  const auth = await requireAdminOrOwner();
  if (!auth.ok) return auth;

  const { data, error } = await (auth.supabase as any).rpc("admin_issue_game_stamp", {
    p_profile_id: input.profileId,
    p_destination_id: input.destinationId,
    p_points: input.points ?? null,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateGamification();
  return { ok: true, data: (data ?? {}) as Record<string, unknown> };
}

export async function revokeGameStamp(attendanceId: string): Promise<GamificationActionResult> {
  if (!UUID_RE.test(attendanceId)) return { ok: false, error: "Некорректный идентификатор штампа." };
  const auth = await requireAdminOrOwner();
  if (!auth.ok) return auth;

  const { data, error } = await (auth.supabase as any).rpc("admin_revoke_game_stamp", {
    p_attendance_id: attendanceId,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateGamification();
  return { ok: true, data: (data ?? {}) as Record<string, unknown> };
}

export async function issueResidentAchievement(input: {
  profileId: string;
  achievementKey: string;
  title: string;
  points: number;
}): Promise<GamificationActionResult> {
  if (!UUID_RE.test(input.profileId)) return { ok: false, error: "Некорректный идентификатор резидента." };
  if (!Number.isInteger(input.points) || input.points < 0 || input.points > 1_000_000) {
    return { ok: false, error: "Баллы должны быть целым числом от 0 до 1 000 000." };
  }
  if (!input.achievementKey.trim() || !input.title.trim()) {
    return { ok: false, error: "Укажите ключ и название достижения." };
  }

  const auth = await requireAdminOrOwner();
  if (!auth.ok) return auth;

  const { data, error } = await (auth.supabase as any).rpc("admin_issue_resident_achievement", {
    p_profile_id: input.profileId,
    p_achievement_key: input.achievementKey.trim(),
    p_title: input.title.trim(),
    p_points: input.points,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateGamification();
  return { ok: true, data: (data ?? {}) as Record<string, unknown> };
}

export async function revokeResidentAchievement(achievementId: string): Promise<GamificationActionResult> {
  if (!UUID_RE.test(achievementId)) return { ok: false, error: "Некорректный идентификатор достижения." };
  const auth = await requireAdminOrOwner();
  if (!auth.ok) return auth;

  const { data, error } = await (auth.supabase as any).rpc("admin_revoke_resident_achievement", {
    p_achievement_id: achievementId,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidateGamification();
  return { ok: true, data: (data ?? {}) as Record<string, unknown> };
}
