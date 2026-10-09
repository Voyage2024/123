/* ──────────────────────────────────────────────────────────────────────
 * RBAC — единый источник правды о ролях и доступе к разделам.
 *
 * Используется и на сервере (middleware), и на клиенте (admin/layout.tsx),
 * поэтому здесь нет "use client" и нет зависимостей от React.
 * Права должны совпадать с NAV_SECTIONS в Sidebar.tsx и RLS в базе.
 * ──────────────────────────────────────────────────────────────────── */

export const ROLES = ["owner", "admin", "manager", "resident"] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = "resident";

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

export const STAFF_ROLES: readonly Role[] = ["manager", "admin", "owner"];
export const ADMIN_ROLES: readonly Role[] = ["admin", "owner"];
export const OWNER_ROLES: readonly Role[] = ["owner"];

type RouteRule = { prefix: string; roles: readonly Role[] };

/** Разделы /admin, которым нужна роль выше manager. Всё остальное в /admin — STAFF_ROLES. */
export const ADMIN_ROUTE_RULES: RouteRule[] = [
  // ── Admin + Owner ─────────────────────────────
  { prefix: "/admin/face-control", roles: ADMIN_ROLES },
  { prefix: "/admin/directory", roles: ADMIN_ROLES },
  { prefix: "/admin/gamification", roles: ADMIN_ROLES },
  { prefix: "/admin/events", roles: ADMIN_ROLES },

  // ── Только Owner ──────────────────────────────
  { prefix: "/admin/roles", roles: OWNER_ROLES },
  { prefix: "/admin/global-tours", roles: OWNER_ROLES },
  { prefix: "/admin/database", roles: OWNER_ROLES },

  // ── Весь персонал (owner, admin, manager) ─────
  // Настройки своего профиля: имя, пароль, аватар.
  // Явное правило, чтобы доступ не зависел от фолбэка ниже.
  { prefix: "/admin/settings", roles: STAFF_ROLES },
];

export const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Какие роли пускаем на конкретный путь внутри /admin. Самое длинное правило побеждает. */
export function getAdminAllowedRoles(pathname: string): readonly Role[] {
  let match: RouteRule | null = null;

  for (const rule of ADMIN_ROUTE_RULES) {
    if (matchesPrefix(pathname, rule.prefix) && (!match || rule.prefix.length > match.prefix.length)) {
      match = rule;
    }
  }

  return match?.roles ?? STAFF_ROLES;
}
