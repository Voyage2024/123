import "server-only";

import { createClient } from "@/lib/supabase/server";

/* ──────────────────────────────────────────────────────────────────────
 * Допуск в личный бункер (/bunker).
 *
 * Пускаем строго:
 *   • user_id из BUNKER_OWNER_IDS (через запятую, серверная env), ИЛИ
 *   • пользователя с ролью owner в profiles (и без активного бана).
 * Всем остальным — notFound(): раздел для них просто не существует.
 *
 * Тот же список проверяет middleware (lib/bunker/middleware.ts),
 * а в базе — RLS через public.bunker_has_access().
 * ──────────────────────────────────────────────────────────────────── */

export function bunkerOwnerIds(): string[] {
  return (process.env.BUNKER_OWNER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const parsed = Date.parse(profile.banned_until);
  return Number.isFinite(parsed) && parsed > Date.now();
}

export type BunkerViewer = { userId: string; email: string | null; name: string | null };

/** null — доступа нет (вызывающий отдаёт 404). */
export async function getBunkerViewer(): Promise<BunkerViewer | null> {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,full_name,banned_until,ban_permanent")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile && isBanActive(profile)) return null;

  const byId = bunkerOwnerIds().includes(auth.user.id.toLowerCase());
  const byRole = profile?.role === "owner";
  if (!byId && !byRole) return null;

  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    name: (typeof profile?.full_name === "string" && profile.full_name.trim()) || null,
  };
}

/** Для server actions бункера: бросает ошибку вместо 404. */
export async function requireBunkerViewer(): Promise<BunkerViewer> {
  const viewer = await getBunkerViewer();
  if (!viewer) throw new Error("Not found");
  return viewer;
}
