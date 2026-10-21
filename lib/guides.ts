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

/** Картинки внутри текста статей */
export const GUIDE_IMAGES_BUCKET = "guide-images";
export const GUIDE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // как file_size_limit бакета
export const GUIDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;

/** Рекомендованные длины для сниппета в Google/Yandex */
export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 160;

/** Бейдж «Новое» висит на гайде столько дней после публикации */
export const GUIDE_NEW_DAYS = 30;

export const GUIDE_COLUMNS =
  "id,title,slug,seo_title,seo_description,seo_keywords,description,content,reading_time,pdf_url,language,tags,is_published,created_at,updated_at";

/** Для карточек на главной текст статьи не нужен */
export const GUIDE_CARD_COLUMNS =
  "id,title,slug,description,reading_time,pdf_url,language,tags,created_at";

export type GuideRow = {
  id: string;
  title: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
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

/** Путь объекта в бакете (по умолчанию guide-files) по публичной ссылке, или null, если ссылка не из бакета */
export function guideStoragePath(url: string | null | undefined, bucket: string = GUIDE_BUCKET): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = url.slice(at + marker.length).split("?")[0];
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

/** Имя файла картинки: ru/chemodan-v-tur/1729500000000-a1b2c3.webp */
export function buildGuideImagePath(language: GuideLanguage, slug: string, fileName: string): string {
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(fileName)?.[1] ?? "jpg").toLowerCase();
  const safe = slugify(slug) || "draft";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${language}/${safe}/${Date.now()}-${rand}.${ext}`;
}

/** Все ссылки на картинки из бакета guide-images, упомянутые в тексте гайда */
export function extractGuideImageUrls(content: string): string[] {
  const marker = `/storage/v1/object/public/${GUIDE_IMAGES_BUCKET}/`;
  const re = /https?:\/\/[^\s"'()<>]+/g;
  const out = new Set<string>();
  for (const match of content.matchAll(re)) if (match[0].includes(marker)) out.add(match[0]);
  return [...out];
}

const READING_LABEL: Record<GuideLanguage, string> = {
  ru: "мин чтения",
  en: "min read",
  es: "min de lectura",
  pt: "min de leitura",
};

/** Оценка времени чтения: ~180 слов в минуту, разметка и ссылки не считаются */
export function estimateReadingTime(content: string, language: GuideLanguage): string {
  const text = content
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\]\([^)]*\)/g, " ")
    .replace(/[#>*_`|~-]+/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));
  return `${minutes} ${READING_LABEL[language]}`;
}

/** Фолбэки SEO: пустые поля → заголовок и описание карточки */
export function resolveGuideSeo(guide: Pick<GuideRow, "title" | "description" | "seo_title" | "seo_description" | "seo_keywords">) {
  const title = guide.seo_title?.trim() || guide.title;
  const description = (guide.seo_description?.trim() || guide.description || "").slice(0, 320);
  const keywords = (guide.seo_keywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return { title, description, keywords };
}

// ─── Интерактивный чек-лист в тексте гайда ─────────────────────────────

/** Один пункт: html — уже очищенная inline-разметка, text — для копирования */
export type GuideChecklistItem = { id: string; html: string; text: string; checked: boolean };
export type GuideChecklistGroup = { title: string | null; items: GuideChecklistItem[] };
export type GuideChecklistData = { title: string | null; groups: GuideChecklistGroup[] };

/** Текст гайда после рендера: обычный HTML вперемешку с чек-листами */
export type GuideContentSegment =
  | { type: "html"; html: string }
  | { type: "checklist"; data: GuideChecklistData };
