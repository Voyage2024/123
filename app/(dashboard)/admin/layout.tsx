import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLES, getRoleHomePath, isRole } from "@/lib/rbac";
import { MFA_ENFORCED_ROLES, sessionNeedsMfa } from "@/lib/server/mfa";
import AdminClientGuard from "@/app/(dashboard)/admin/AdminClientGuard";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN LAYOUT — серверная проверка до отдачи любой страницы /admin/*.
 *
 *   • нет сессии            → /login
 *   • роль не staff          → домашняя страница своей роли
 *   • активный бан           → /banned
 *   • owner/admin с MFA, но без кода в этой сессии → /login?mfa=required
 *
 * Роль читается из public.profiles (источник правды), а не из cookie.
 * Правила разделов (менеджеру — только /admin/settings) дополнительно
 * проверяет AdminClientGuard и, если подключён, middleware/proxy
 * (lib/server/admin-route-guard.ts).
 * ──────────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const parsed = Date.parse(profile.banned_until);
  return Number.isFinite(parsed) && parsed > Date.now();
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,banned_until,ban_permanent")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError || !profile || !isRole(profile.role)) redirect("/login");
  if (isBanActive(profile)) redirect("/banned");
  if (!STAFF_ROLES.includes(profile.role)) redirect(getRoleHomePath(profile.role));
  if (MFA_ENFORCED_ROLES.has(profile.role) && (await sessionNeedsMfa(supabase))) redirect("/login?mfa=required");

  return <AdminClientGuard>{children}</AdminClientGuard>;
}
