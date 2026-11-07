/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · страны локаций карты — lib/countries.ts
 *
 * map_hubs.country_code (ISO-3166 alpha-2, миграция
 * 20261106090000_map_hub_subscriptions.sql). Названия стран берутся из
 * Intl.DisplayNames на языке интерфейса — без своих словарей на 4 языка.
 * ──────────────────────────────────────────────────────────────────── */

export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AR", "AT", "AU", "AW", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH",
  "BI", "BJ", "BL", "BM", "BN", "BO", "BR", "BS", "BT", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH", "CI", "CL", "CM",
  "CN", "CO", "CR", "CU", "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "ER", "ES", "ET",
  "FI", "FJ", "FR", "GA", "GB", "GD", "GE", "GH", "GI", "GM", "GN", "GQ", "GR", "GT", "GW", "GY", "HK", "HN", "HR", "HT",
  "HU", "ID", "IE", "IL", "IN", "IQ", "IR", "IS", "IT", "JM", "JO", "JP", "KE", "KG", "KH", "KM", "KN", "KR", "KW", "KY",
  "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MK", "ML",
  "MM", "MN", "MO", "MR", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NE", "NG", "NI", "NL", "NO", "NP", "NZ", "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PR", "PT", "PY", "QA", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE",
  "SG", "SI", "SK", "SL", "SM", "SN", "SO", "SR", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TG", "TH", "TJ", "TL", "TM",
  "TN", "TO", "TR", "TT", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WS", "XK",
  "YE", "ZA", "ZM", "ZW",
] as const;

const CODE_RE = /^[A-Z]{2}$/;

/** «ae» / « AE » → «AE»; что-то другое → null */
export function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

const LOCALE: Record<string, string> = { RU: "ru", EN: "en", ES: "es", PT: "pt" };
const namesCache = new Map<string, Intl.DisplayNames | null>();

function displayNames(lang: string): Intl.DisplayNames | null {
  const locale = LOCALE[lang.toUpperCase()] ?? "en";
  if (!namesCache.has(locale)) {
    try {
      namesCache.set(locale, new Intl.DisplayNames([locale], { type: "region" }));
    } catch {
      namesCache.set(locale, null);
    }
  }
  return namesCache.get(locale) ?? null;
}

/** «AE» → «ОАЭ» / «United Arab Emirates» … ; без кода — пустая строка */
export function countryName(code: string | null | undefined, lang: string): string {
  const cc = normalizeCountryCode(code);
  if (!cc) return "";
  try {
    return displayNames(lang)?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** «AE» → 🇦🇪 */
export function countryFlag(code: string | null | undefined): string {
  const cc = normalizeCountryCode(code);
  if (!cc) return "";
  return String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Список для выпадающего меню, по алфавиту на языке интерфейса */
export function countryOptions(lang: string): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, lang) })).sort((a, b) =>
    a.name.localeCompare(b.name, LOCALE[lang.toUpperCase()] ?? "en"),
  );
}
