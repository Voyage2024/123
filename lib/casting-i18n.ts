/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · тексты кастингов и туров на 4 языках
 * lib/casting-i18n.ts
 *
 * В базе тексты лежат в jsonb { RU, EN, ES, PT }:
 *   partner_castings.title_i18n / brief_i18n, source_lang — язык автора;
 *   tour_catalog.title_i18n / description_i18n / requirements_i18n / conditions_i18n.
 * См. supabase/migrations/20261103090000_tour_catalog_casting_i18n_invites.sql
 *
 * Файл без серверных импортов — подключается и в клиенте, и в server actions.
 * ──────────────────────────────────────────────────────────────────── */

export const CASTING_LANGS = ["RU", "EN", "ES", "PT"] as const;
export type CastingLang = (typeof CASTING_LANGS)[number];
export type I18nText = Partial<Record<CastingLang, string>>;

export const TITLE_MAX = 120;
export const BRIEF_MAX = 2000;
export const TOUR_DESCRIPTION_MAX = 4000;
export const TOUR_NOTE_MAX = 2000;

export const LANG_NAMES: Record<CastingLang, string> = {
  RU: "Русский",
  EN: "English",
  ES: "Español",
  PT: "Português",
};

export const isCastingLang = (v: unknown): v is CastingLang =>
  typeof v === "string" && (CASTING_LANGS as readonly string[]).includes(v);

export const toCastingLang = (v: unknown, fallback: CastingLang = "RU"): CastingLang => {
  const up = typeof v === "string" ? v.trim().toUpperCase() : "";
  return isCastingLang(up) ? up : fallback;
};

/** jsonb из базы → { RU?, EN?, ES?, PT? } (лишние ключи и не-строки отбрасываются, длина режется) */
export function toI18n(raw: unknown, max = BRIEF_MAX): I18nText {
  const out: I18nText = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const lang of CASTING_LANGS) {
    const v = r[lang];
    if (typeof v === "string" && v.trim() !== "") out[lang] = v.slice(0, max);
  }
  return out;
}

/** Для записи в базу: обрезаем пробелы, пустые языки убираем */
export function cleanI18n(value: I18nText, max: number): I18nText {
  const out: I18nText = {};
  for (const lang of CASTING_LANGS) {
    const v = value[lang];
    if (typeof v === "string" && v.trim() !== "") out[lang] = v.trim().slice(0, max);
  }
  return out;
}

export const hasI18nText = (value: I18nText | null | undefined): boolean =>
  !!value && CASTING_LANGS.some((l) => (value[l] ?? "").trim() !== "");

/** Текст на языке интерфейса → на языке автора → EN → любой */
export function pickI18n(value: I18nText | null | undefined, lang: string, source?: string | null): string | null {
  if (!value) return null;
  const order = [lang?.toUpperCase(), source?.toUpperCase(), "EN", "RU", "ES", "PT"];
  for (const key of order) {
    if (isCastingLang(key)) {
      const v = value[key]?.trim();
      if (v) return v;
    }
  }
  return null;
}

/** Показан не на языке интерфейса — для пометки «оригинал на …» */
export function pickedLang(value: I18nText | null | undefined, lang: string, source?: string | null): CastingLang | null {
  if (!value) return null;
  const order = [lang?.toUpperCase(), source?.toUpperCase(), "EN", "RU", "ES", "PT"];
  for (const key of order) {
    if (isCastingLang(key) && value[key]?.trim()) return key;
  }
  return null;
}

/** Каких языков не хватает */
export const missingLangs = (value: I18nText): CastingLang[] =>
  CASTING_LANGS.filter((l) => !(value[l] ?? "").trim());
