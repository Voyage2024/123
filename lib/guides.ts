import type { Lang } from "@/app/context/LanguageContext";

/* ──────────────────────────────────────────────────────────────────────
 * ГАЙДЫ — общие типы и хелперы для public.guides
 *
 * Используются на главной (GuidesSection), на странице /guides/[slug],
 * в админке /admin/guides и в серверных экшенах app/actions/guides.ts.
 * Файл без "server-only": его импортируют и клиентские компоненты.
 * ──────────────────────────────────────────────────────────────────── */

export const GUIDE_LANGUAGES = ["ru", "en", "es", "pt"] as const;
export type GuideLanguage = (typeof GUIDE_LANGUAGES)[number];

/** Если на языке интерфейса нет ни одного гайда — показываем русские */
export const GUIDE_FALLBACK_LANGUAGE: GuideLanguage = "ru";

export const GUIDE_BUCKET = "guide-files";
export const GUIDE_PDF_MAX_BYTES = 20 * 1024 * 1024; // как file_size_limit бакета

/** Бейдж «Новое» висит на гайде столько дней после публикации */
export const GUIDE_NEW_DAYS = 30;

export const GUIDE_COLUMNS =
  "id,title,slug,description,content,reading_time,pdf_url,language,tags,is_published,created_at,updated_at";

/** Для карточек на главной текст статьи не нужен */
export const GUIDE_CARD_COLUMNS =
  "id,title,slug,description,reading_time,pdf_url,language,tags,created_at";

export type GuideRow = {
  id: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  reading_time: string | null;
  pdf_url: string | null;
  language: GuideLanguage;
  tags: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type GuideCard = Pick<
  GuideRow,
  "id" | "title" | "slug" | "description" | "reading_time" | "pdf_url" | "language" | "tags" | "created_at"
>;

export const isGuideLanguage = (value: unknown): value is GuideLanguage =>
  typeof value === "string" && (GUIDE_LANGUAGES as readonly string[]).includes(value);

/** "RU" из LanguageContext → "ru" в базе */
export function langToGuideLanguage(lang: Lang | string): GuideLanguage {
  const lower = String(lang).toLowerCase();
  return isGuideLanguage(lower) ? lower : GUIDE_FALLBACK_LANGUAGE;
}

export function guideLanguageToLang(language: GuideLanguage): Lang {
  return language.toUpperCase() as Lang;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** «Чемодан в тур без паники» → "chemodan-v-tur-bez-paniki" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => CYRILLIC[ch] ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** "образы, бьюти , документы" → ["образы", "бьюти", "документы"] (без пустых и дублей) */
export function parseTags(input: string | string[]): string[] {
  const list = Array.isArray(input) ? input : input.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const tag = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 12) break;
  }
  return out;
}

export function isGuideNew(createdAt: string, now = Date.now()): boolean {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && now - created < GUIDE_NEW_DAYS * 24 * 60 * 60 * 1000;
}

export type GuideIconKey = "luggage" | "passport" | "beauty" | "shield" | "concierge" | "book";

const ICON_HINTS: Array<[GuideIconKey, RegExp]> = [
  ["luggage", /чемодан|багаж|сбор|suitcase|packing|luggage|maleta|equipaje|mala\b|bagagem/i],
  ["passport", /документ|паспорт|виз|document|passport|visa|documento|pasaporte|passaporte/i],
  ["beauty", /бьюти|макияж|уход|образ|beauty|makeup|look|belleza|maquillaje|beleza|maquiagem/i],
  ["shield", /безопасн|safety|security|seguridad|segurança/i],
  ["concierge", /консьерж|concierge|conserje/i],
];

/** Иконку на обложке карточки подбираем по тегам и заголовку */
export function pickGuideIcon(guide: Pick<GuideCard, "title" | "tags">): GuideIconKey {
  const haystack = `${guide.title} ${guide.tags.join(" ")}`;
  for (const [key, re] of ICON_HINTS) if (re.test(haystack)) return key;
  return "book";
}

/** Путь объекта в бакете guide-files по публичной ссылке (или null, если ссылка не из бакета) */
export function guideStoragePath(pdfUrl: string | null | undefined): string | null {
  if (!pdfUrl) return null;
  const marker = `/storage/v1/object/public/${GUIDE_BUCKET}/`;
  const at = pdfUrl.indexOf(marker);
  if (at === -1) return null;
  const path = pdfUrl.slice(at + marker.length).split("?")[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return path || null;
  }
}

/** Имя файла для загрузки: ru/chemodan-v-tur-1729500000000.pdf */
export function buildGuidePdfPath(language: GuideLanguage, slug: string): string {
  const safe = slugify(slug) || "guide";
  return `${language}/${safe}-${Date.now()}.pdf`;
}

/**
 * Ссылка для кнопки «Скачать PDF». Атрибут download не работает между доменами,
 * поэтому для файла из Storage просим Supabase отдать его как вложение.
 */
export function guideDownloadUrl(pdfUrl: string): string {
  if (!guideStoragePath(pdfUrl)) return pdfUrl;
  const name = decodeURIComponent(pdfUrl.split("?")[0].split("/").pop() || "voyage-guide.pdf");
  return `${pdfUrl.split("?")[0]}?download=${encodeURIComponent(name)}`;
}
