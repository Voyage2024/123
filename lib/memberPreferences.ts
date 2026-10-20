/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ключи личных настроек (public.member_preferences)
 * lib/memberPreferences.ts — общий для server action и клиентских компонентов
 * ──────────────────────────────────────────────────────────────────── */

export const RESIDENT_PREFERENCE_KEYS = ["notify_tours", "notify_parties", "notify_approvals", "notify_points", "hide_points"] as const;
export const MANAGER_PREFERENCE_KEYS = [
  "notify_casting_responses",
  "notify_contract_signed",
  "notify_docs_uploaded",
  "notify_reviews",
  "notify_map_applications",
] as const;

export type PreferenceKey = (typeof RESIDENT_PREFERENCE_KEYS)[number] | (typeof MANAGER_PREFERENCE_KEYS)[number];
export type MemberPreferences = Record<PreferenceKey, boolean>;

/** Нет строки в БД — всё включено, баллы не скрыты */
export const DEFAULT_PREFERENCES: MemberPreferences = {
  notify_tours: true,
  notify_parties: true,
  notify_approvals: true,
  notify_points: true,
  hide_points: false,
  notify_casting_responses: true,
  notify_contract_signed: true,
  notify_docs_uploaded: true,
  notify_reviews: true,
  notify_map_applications: true,
};
