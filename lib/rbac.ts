/* ──────────────────────────────────────────────────────────────────────
 * RBAC — единый источник правды о ролях и доступе к разделам.
 *
 * Используется в admin/layout.tsx для определения разрешённых ролей маршрута.
 * Файл не выполняет проверку сам по себе: вызывающая сторона должна применить правила.
 * Права должны совпадать с NAV_SECTIONS в Sidebar.tsx и RLS в базе.
 * ──────────────────────────────────────────────────────────────────── */

export const ROLES = ["owner", "admin", "manager", "resident", "operator", "scout"] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = "resident";

export const RESIDENT_HOME_PATH = "/dashboard";
export const ADMIN_HOME_PATH = "/admin";
export const PARTNER_HOME_PATH = "/partner";
/** Диспетчерский пульт оператора (ОС туров). */
export const OPERATOR_HOME_PATH = "/operator";
/** Кабинет скаута: его модели и ссылки, начисления и выплаты, профиль. */
export const SCOUT_HOME_PATH = "/scout";

/** Default landing page after login; admin/owner can still navigate to both workspaces. */
export function getRoleHomePath(role: Role): string {
  if (role === "manager") return PARTNER_HOME_PATH;
  if (role === "operator") return OPERATOR_HOME_PATH;
  if (role === "scout") return SCOUT_HOME_PATH;
  if (role === "admin" || role === "owner") return ADMIN_HOME_PATH;
  return RESIDENT_HOME_PATH;
}

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

export const STAFF_ROLES: readonly Role[] = ["manager", "admin", "owner"];
export const ADMIN_ROLES: readonly Role[] = ["admin", "owner"];
export const OWNER_ROLES: readonly Role[] = ["owner"];

/* ── ОС туров, букингов и операторов (Этап 1) ──────────────────────────
 * admin сюда НЕ допускается: is_admin() в базе = admin или owner, поэтому
 * модуль везде проверяет роли явно. Списки ниже — единый источник для
 * proxy.ts, серверных layout-гардов и бокового меню. */
export const TOUR_OPS_MANAGE_ROLES: readonly Role[] = ["manager", "owner"];
export const TOUR_OPS_DESK_ROLES: readonly Role[] = ["manager", "owner", "operator"];
export const OPERATOR_ROLES: readonly Role[] = ["operator"];

/* ── Скауты ────────────────────────────────────────────────────────────
 * scout — самостоятельная роль: не staff, не резидент, не участник клуба.
 * Кабинет — только /scout. В базе роль проверяется через voyage_ops_role()
 * (у приостановленного скаута — null), admin скаутов не видит. */
export const SCOUT_ROLES: readonly Role[] = ["scout"];
/** Кто приводит моделей по ссылкам VYM (общий механизм закрепления). */
export const SCOUTING_ROLES: readonly Role[] = ["manager", "scout"];

/** Разделы /partner, закрытые для admin (только manager и owner). */
export const PARTNER_TOUR_OPS_PREFIXES = ["/partner/bookings", "/partner/team", "/partner/guests", "/partner/models"] as const;
/** Owner-only раздел в /admin. */
export const OWNER_TOUR_CONTROL_PREFIX = "/admin/tour-control";

type RouteRule = { prefix: string; roles: readonly Role[] };

/**
 * All /admin routes are restricted to owner/admin by default. The longest matching
 * rule wins, so personal settings remain available to staff and sensitive sections
 * can define stricter access independently.
 */
export const ADMIN_ROUTE_RULES: RouteRule[] = [
  // Baseline: administrative workspace is admin/owner only.
  { prefix: "/admin", roles: ADMIN_ROLES },

  // Explicit exceptions / stricter access.
  // Control Tower is admin/owner only; keep the rule explicit for future maintenance.
  { prefix: "/admin/negotiations", roles: ADMIN_ROLES },
  { prefix: "/admin/settings", roles: STAFF_ROLES },
  { prefix: "/admin/roles", roles: OWNER_ROLES },
  { prefix: "/admin/global-tours", roles: OWNER_ROLES },
  // ОС туров: сводный контроль — строго owner, admin не видит.
  { prefix: "/admin/tour-control", roles: OWNER_ROLES },
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
