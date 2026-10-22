/* Форматирование для бункера: деньги, даты (локальные, без UTC-сдвигов). */

export function money(value: number, currency: string, opts: { compact?: boolean } = {}) {
  const amount = Number.isFinite(value) ? value : 0;
  const number = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: opts.compact && Math.abs(amount) >= 10000 ? 0 : 2,
    notation: opts.compact && Math.abs(amount) >= 1_000_000 ? "compact" : "standard",
  }).format(amount);
  const symbol: Record<string, string> = { USD: "$", EUR: "€", RUB: "₽", VND: "₫", AED: "AED", THB: "฿", USDT: "USDT" };
  const s = symbol[currency] ?? currency;
  return s.length === 1 ? (currency === "USD" || currency === "EUR" ? `${s}${number}` : `${number} ${s}`) : `${number} ${s}`;
}

export function percent(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits).replace(".", ",")}%`;
}

/** Локальная дата YYYY-MM-DD (не toISOString — тот уходит в UTC). */
export function isoDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(day: string, n: number) {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return isoDay(date);
}

export function daysBetween(from: string, to: string) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function weekdayShort(day: string) {
  return WEEKDAYS[parseDay(day).getDay()];
}

/** «Сегодня», «Завтра», «Вчера», «пт, 24 окт.» */
export function humanDay(day: string, today = isoDay()) {
  const diff = daysBetween(today, day);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff === -1) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(parseDay(day).getFullYear() !== parseDay(today).getFullYear() ? { year: "numeric" } : {}),
  }).format(parseDay(day));
}

export function shortDate(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(
    iso.length === 10 ? parseDay(iso) : new Date(iso),
  );
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return shortDate(iso);
}

/** plural(5, ["запись", "записи", "записей"]) → «записей» */
export function plural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Кириллица → латиница для slug своих проектов. */
export function slugify(input: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l",
    м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
    щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  const latin = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `p-${Date.now().toString(36)}`;
}
