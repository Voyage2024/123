/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — время и часовые пояса
 * lib/tour-ops/time.ts
 *
 * Двойное время: крупно — город тура (tour_ops_settings.timezone),
 * мелко — пояс того, кто смотрит (profiles.timezone, иначе браузера).
 * Только Intl, без зависимостей. Работает и на сервере (Node ICU).
 * ──────────────────────────────────────────────────────────────────── */

export type UiLang = "EN" | "RU" | "ES" | "PT";

const LOCALE: Record<UiLang, string> = { EN: "en-GB", RU: "ru-RU", ES: "es-ES", PT: "pt-PT" };
export const localeOf = (lang: UiLang) => LOCALE[lang] ?? "en-GB";

/** Частые пояса — для быстрых кнопок и списка в настройках. */
export const COMMON_TIMEZONES = [
  "Europe/Moscow",
  "Asia/Dubai",
  "Europe/Istanbul",
  "Asia/Bangkok",
  "Asia/Bali",
  "Asia/Makassar",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "UTC",
] as const;

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Пояс просмотра: из профиля, иначе браузера. */
export function viewerTimezone(profileTz: string | null | undefined): string {
  return isValidTimezone(profileTz) ? profileTz : browserTimezone();
}

function safeTz(tz: string): string {
  return isValidTimezone(tz) ? tz : "UTC";
}

export function fmtTime(iso: string, tz: string, lang: UiLang = "RU"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeOf(lang), { timeZone: safeTz(tz), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

export function fmtDay(iso: string, tz: string, lang: UiLang = "RU"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeOf(lang), { timeZone: safeTz(tz), weekday: "short", day: "numeric", month: "short" }).format(d);
}

export function fmtDateTime(iso: string, tz: string, lang: UiLang = "RU"): string {
  return `${fmtDay(iso, tz, lang)}, ${fmtTime(iso, tz, lang)}`;
}

/** «GMT+4» для пояса на дату. */
export function tzShort(tz: string, at: Date = new Date(), lang: UiLang = "EN"): string {
  try {
    const part = new Intl.DateTimeFormat(localeOf(lang), { timeZone: safeTz(tz), timeZoneName: "shortOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? tz;
  } catch {
    return tz;
  }
}

/** Город из IANA: Asia/Dubai → Dubai. */
export function tzCity(tz: string): string {
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

/** Календарный день в поясе: YYYY-MM-DD. */
export function dayKey(iso: string | Date, tz: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: safeTz(tz), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Время HH:mm в поясе. */
export function timeKey(iso: string | Date, tz: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", { timeZone: safeTz(tz), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

function offsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz(tz),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** «2026-11-14» + «21:30» в поясе тура → ISO UTC. */
export function zonedToIso(day: string, time: string, tz: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const naive = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
  // две итерации — корректно и на переходе на летнее время
  let guess = naive - offsetMinutes(naive, tz) * 60000;
  guess = naive - offsetMinutes(guess, tz) * 60000;
  return new Date(guess).toISOString();
}

/** Сдвиг дня YYYY-MM-DD на n дней. */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1) + n * 86400000);
  return dt.toISOString().slice(0, 10);
}

export function minutesBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000);
}

export function fmtDuration(minutes: number, lang: UiLang = "RU"): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const u = lang === "RU" ? { h: "ч", m: "мин" } : lang === "ES" ? { h: "h", m: "min" } : lang === "PT" ? { h: "h", m: "min" } : { h: "h", m: "min" };
  if (h && r) return `${h} ${u.h} ${r} ${u.m}`;
  if (h) return `${h} ${u.h}`;
  return `${r} ${u.m}`;
}

export function fmtMoney(amount: number, currency: string, lang: UiLang = "RU"): string {
  try {
    return new Intl.NumberFormat(localeOf(lang), { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/* ── свободные окна ───────────────────────────────────────────────── */

export type Slot<T> =
  | { kind: "booking"; item: T; start: string; end: string }
  | { kind: "gap"; start: string; end: string; minutes: number; tight: boolean };

/**
 * Расставляет заказы одной модели по времени и вставляет между ними
 * свободные окна. tight — зазор меньше буфера на дорогу/сборы.
 */
export function withGaps<T extends { startsAt: string; endsAt: string; status: string }>(
  items: T[],
  bufferMinutes: number,
): Slot<T>[] {
  const live = items.filter((b) => b.status !== "cancelled").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const cancelled = items.filter((b) => b.status === "cancelled");
  const out: Slot<T>[] = [];
  live.forEach((b, i) => {
    if (i > 0) {
      const prev = live[i - 1];
      const minutes = minutesBetween(prev.endsAt, b.startsAt);
      if (minutes > 0) out.push({ kind: "gap", start: prev.endsAt, end: b.startsAt, minutes, tight: minutes < bufferMinutes });
      else if (minutes === 0) out.push({ kind: "gap", start: prev.endsAt, end: b.startsAt, minutes: 0, tight: bufferMinutes > 0 });
    }
    out.push({ kind: "booking", item: b, start: b.startsAt, end: b.endsAt });
  });
  cancelled
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .forEach((b) => out.push({ kind: "booking", item: b, start: b.startsAt, end: b.endsAt }));
  return out;
}
