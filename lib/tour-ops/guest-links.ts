/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Пробивщик — быстрые ссылки для проверки гостя
 * lib/tour-ops/guest-links.ts
 *
 * Только ссылки и копирование: никакие данные гостя не уходят в сторонние
 * сервисы автоматически — оператор сам открывает нужный сервис.
 * ──────────────────────────────────────────────────────────────────── */

/** +7 916 123-45-67 → +79161234567 (как voyage_normalize_phone в базе). */
export function normalizePhone(raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/[^0-9+]/g, "");
  if (!v) return null;
  let d = v.replace(/[^0-9]/g, "");
  if (!v.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("8")) d = `7${d.slice(1)}`;
    else if (d.length === 10 && d.startsWith("9")) d = `7${d}`;
  }
  if (d.length < 8 || d.length > 15) return null;
  return `+${d}`;
}

/** @Nick / t.me/nick → nick. */
export function normalizeTelegram(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)?@?/i, "").toLowerCase();
  return /^[a-z0-9_]{4,32}$/.test(v) ? v : null;
}

/** Что ввели в поле контакта: телефон или ник. */
export function parseGuestContact(raw: string): { phone: string | null; telegram: string | null } {
  const text = raw.trim();
  const looksLikeHandle = /^@|t\.me\//i.test(text) || /[a-z_]/i.test(text.replace(/^\+/, ""));
  if (looksLikeHandle) return { phone: null, telegram: normalizeTelegram(text) };
  return { phone: normalizePhone(text), telegram: null };
}

export type GuestLink = { key: "telegram" | "whatsapp" | "numbuster" | "getcontact"; href: string };

export function guestLinks(input: { phone?: string | null; whatsapp?: string | null; telegram?: string | null }): GuestLink[] {
  const links: GuestLink[] = [];
  const tg = normalizeTelegram(input.telegram);
  const phone = normalizePhone(input.phone);
  const wa = normalizePhone(input.whatsapp) ?? phone;
  if (tg) links.push({ key: "telegram", href: `https://t.me/${tg}` });
  else if (phone) links.push({ key: "telegram", href: `https://t.me/${phone}` });
  if (wa) links.push({ key: "whatsapp", href: `https://wa.me/${wa.slice(1)}` });
  if (phone) {
    // у NumBuster и GetContact нет публичной ссылки поиска: UI копирует номер и открывает сервис
    links.push({ key: "numbuster", href: "https://www.numbuster.com/" });
    links.push({ key: "getcontact", href: "https://web.getcontact.com/search" });
  }
  return links;
}
