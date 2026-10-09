/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · доступ к разделам руководства клуба
 * lib/access.ts
 *
 * Owner и admin — «руководство»: приглашения (/admin/invites) и заявки
 * на вступление с главной (/admin/requests). Менеджерам эти разделы закрыты.
 * В базе то же правило — функция club_is_admin() (миграция 20261010).
 * ──────────────────────────────────────────────────────────────────── */

export const CLUB_ADMIN_ROLES = ["owner", "admin"] as const;

export const isClubAdmin = (role: unknown) =>
  typeof role === "string" && (CLUB_ADMIN_ROLES as readonly string[]).includes(role);

/** Персонал клуба: owner, admin, manager (как game_is_staff() в БД) */
export const STAFF_ROLES = ["owner", "admin", "manager"] as const;

export const isStaff = (role: unknown) =>
  typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);
