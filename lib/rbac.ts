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

export const RESIDENT_HOME_PATH = "/dashboard";
export const ADMIN_HOME_PATH = "/admin";
export const PARTNER_HOME_PATH = "/partner";

/** Default landing page after login; admin/owner can still navigate to both workspaces. */
export function getRoleHomePath(role: Role): string {
  if (role === "manager") return PARTNER_HOME_PATH;
  if (role === "admin" || role === "owner") return ADMIN_HOME_PATH;
  return RESIDENT_HOME_PATH;
}

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

export const STAFF_ROLES: readonly Role[] = ["manager", "admin", "owner"];
export const ADMIN_ROLES: readonly Role[] = ["admin", "owner"];
export const OWNER_ROLES: readonly Role[] = ["owner"];

type RouteRule = { prefix: string; roles: readonly Role[] };

/**
 * All /admin routes are closed to managers by default. The longest matching rule
 * wins, so personal profile settings remain available to staff while sensitive
 * sections have their own stricter role lists.
 */
export const ADMIN_ROUTE_RULES: RouteRule[] = [
  // Baseline: administrative workspace is admin/owner only.
  { prefix: "/admin", roles: ADMIN_ROLES },

  // Explicit exceptions / stricter access.
  { prefix: "/admin/settings", roles: STAFF_ROLES },
  { prefix: "/admin/roles", roles: OWNER_ROLES },
  { prefix: "/admin/global-tours", roles: OWNER_ROLES },
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

  return match?.roles ?? ADMIN_ROLES;
}
