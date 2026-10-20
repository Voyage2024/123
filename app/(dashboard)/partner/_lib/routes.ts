/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — адреса пульта и источник данных
 * app/(dashboard)/partner/_lib/routes.ts
 *
 * Все ссылки кабинета менеджера собраны здесь: переименовали маршрут —
 * поменяли одну строку.
 *
 * Профиль резидентки — /partner/residents/[id] для всех ролей: у владельца
 * и админа на этой странице больше прав (RLS), отдельный адрес не нужен.
 * Если появится свой админский экран — замените только resident().
 * ──────────────────────────────────────────────────────────────────── */

export const ROUTES = {
  command: "/partner",
  castings: "/partner/castings",
  newCasting: "/partner/castings/new",
  casting: (id: string) => `/partner/castings/${id}`,
  /** Слепая карточка кандидатки внутри кастинга — до рукопожатия имени нет */
  castingCandidate: (castingId: string, code: string) =>
    `/partner/castings/${castingId}?candidate=${encodeURIComponent(code)}`,
  manifest: "/partner/manifest",
  tour: (id: string) => `/partner/manifest/${id}`,
  dealRoom: (id: string) => `/partner/manifest/${id}/room`,
  blacklist: "/partner/blacklist",
  residents: "/partner/residents",
  resident: (id: string) => `/partner/residents/${id}`,
  pulse: "/partner/pulse",
  keys: "/partner/keys",
  /** Telegram-оповещения и профиль менеджера */
  settings: "/admin/settings",
} as const;

/**
 * Источник данных пульта. Демо-режим снят: все экраны читают RPC Supabase
 * под RLS (миграции 20261011120000_partner_command.sql,
 * 20261012090000_partner_deal_room.sql, 20261020094000_partner_live_pages.sql).
 * Тип оставлен, чтобы старые проверки `source === "mock"` компилировались.
 */
export type DataSource = "mock" | "live";
export const DATA_SOURCE: DataSource = "live" as DataSource;
