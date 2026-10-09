/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · заявки с главной («Запросить приглашение»)
 * lib/guestApplications.ts
 *
 * Не путать с таблицей applications — это заявки резидентов в туры.
 *
 * Таблица public.guest_applications — миграция 20261011_guest_applications.sql.
 * Ссылки из анкеты приходят от анонимов, поэтому в админке они
 * собираются только отсюда: Instagram — из проверенного @handle,
 * портфолио — только http(s), контакты — t.me / wa.me.
 * ──────────────────────────────────────────────────────────────────── */

export const APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const isApplicationStatus = (v: unknown): v is ApplicationStatus =>
  typeof v === "string" && (APPLICATION_STATUSES as readonly string[]).includes(v);

export type GuestApplicationRow = {
  id: string;
  full_name: string;
  contact: string;
  instagram: string;
  instagram_handle?: string | null;
  portfolio_url: string | null;
  about: string | null;
  status: string;
  lang?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
};

export type GuestApplication = {
  id: string;
  fullName: string;
  contact: string;
  instagram: string;
  /** проверенный @handle без «@» или null */
  handle: string | null;
  portfolioUrl: string | null;
  about: string | null;
  status: ApplicationStatus;
  lang: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

/** «@anna.k», «instagram.com/anna.k/», «https://www.instagram.com/anna.k?igsh=…» → «anna.k» */
export function instagramHandle(raw: string | null | undefined): string | null {
  const handle = (raw ?? "")
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

export function normalizeApplication(r: GuestApplicationRow): GuestApplication {
  return {
    id: r.id,
    fullName: (r.full_name ?? "").trim() || "—",
    contact: (r.contact ?? "").trim(),
    instagram: (r.instagram ?? "").trim(),
    handle: instagramHandle(r.instagram_handle ?? r.instagram),
    portfolioUrl: safeHttpUrl(r.portfolio_url),
    about: r.about?.trim() || null,
    status: isApplicationStatus(r.status) ? r.status : "pending",
    lang: r.lang ?? null,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? null,
    reviewedBy: r.reviewed_by ?? null,
  };
}

/** Только http(s) — никаких javascript:, data: и прочего из анонимной формы */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const instagramUrl = (handle: string) => `https://instagram.com/${encodeURIComponent(handle)}`;

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Telegram / WhatsApp из поля «Контакт» */
export function contactLinks(raw: string): { telegram: string | null; whatsapp: string | null } {
  const v = raw.trim();
  const tme = /^(https?:\/\/)?t\.me\/([a-z0-9_]{4,32})\/?$/i.exec(v);
  if (tme) return { telegram: `https://t.me/${tme[2]}`, whatsapp: null };
  const digits = v.replace(/\D/g, "");
  if (digits.length >= 7 && /^[+\d\s().-]+$/.test(v)) {
    const intl = digits.replace(/^00/, "");
    return { telegram: `https://t.me/+${intl}`, whatsapp: `https://wa.me/${intl}` };
  }
  const user = /^@?([a-z0-9_]{4,32})$/i.exec(v);
  if (user && /[a-z]/i.test(user[1])) return { telegram: `https://t.me/${user[1]}`, whatsapp: null };
  return { telegram: null, whatsapp: null };
}
