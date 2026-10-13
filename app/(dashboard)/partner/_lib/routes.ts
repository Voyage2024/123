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
} as const;

/**
 * Источник данных пульта (.env.local):
 *   NEXT_PUBLIC_PARTNER_DATA=live  → RPC Supabase
 *   не задана                      → демо-данные, действия имитируются
 */
export type DataSource = "mock" | "live";
export const DATA_SOURCE: DataSource = process.env.NEXT_PUBLIC_PARTNER_DATA === "live" ? "live" : "mock";
