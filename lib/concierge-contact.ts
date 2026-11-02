/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Контакты консьержа для записи на KYC 3
 * lib/concierge-contact.ts
 *
 * Заполните в Vercel → Settings → Environment Variables (и в .env.local):
 *
 *   NEXT_PUBLIC_CONCIERGE_TELEGRAM = voyage_concierge      (username без @
 *                                    или полная ссылка https://t.me/…)
 *   NEXT_PUBLIC_CONCIERGE_WHATSAPP = +971501234567         (номер в любом
 *                                    формате — оставим только цифры)
 *
 * Пустая переменная — кнопка этого канала просто не показывается;
 * запись через форму (заявка консьержу в кабинете) работает всегда.
 * После изменения переменных нужен новый деплой: NEXT_PUBLIC_* вшиваются
 * в клиентский бандл при сборке.
 * ──────────────────────────────────────────────────────────────────── */

const RAW_TELEGRAM = (process.env.NEXT_PUBLIC_CONCIERGE_TELEGRAM ?? "").trim();
const RAW_WHATSAPP = (process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP ?? "").trim();

function telegramBase(raw: string): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  const username = raw.replace(/^@/, "").replace(/^t\.me\//i, "");
  return /^[A-Za-z0-9_]{4,32}$/.test(username) ? `https://t.me/${username}` : null;
}

function whatsappDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

const TG = telegramBase(RAW_TELEGRAM);
const WA = whatsappDigits(RAW_WHATSAPP);

export const CONCIERGE_CONTACT = {
  hasTelegram: TG !== null,
  hasWhatsapp: WA !== null,
} as const;

/** Ссылка на чат с консьержем в Telegram; text — заготовка сообщения */
export function conciergeTelegramUrl(text?: string): string | null {
  if (!TG) return null;
  if (!text || !TG.startsWith("https://t.me/") || TG.includes("?")) return TG;
  return `${TG}?text=${encodeURIComponent(text)}`;
}

/** Ссылка на чат с консьержем в WhatsApp; text — заготовка сообщения */
export function conciergeWhatsappUrl(text?: string): string | null {
  if (!WA) return null;
  return text ? `https://wa.me/${WA}?text=${encodeURIComponent(text)}` : `https://wa.me/${WA}`;
}
