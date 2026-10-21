"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { renderGuideContent } from "@/lib/server/guide-content";
import { ADMIN_ROLES } from "@/lib/rbac";
import {
  GUIDE_BUCKET,
  GUIDE_COLUMNS,
  GUIDE_IMAGES_BUCKET,
  SLUG_PATTERN,
  extractGuideImageUrls,
  guideStoragePath,
  isGuideLanguage,
  parseTags,
  slugify,
  type GuideContentSegment,
  type GuideLanguage,
  type GuideRow,
} from "@/lib/guides";

/* ──────────────────────────────────────────────────────────────────────
 * ГАЙДЫ — серверные экшены админки /admin/guides
 *
 * Каждый экшен сначала проверяет роль (admin/owner) через requireRole,
 * затем пишет серверным клиентом под сессией администратора, так что
 * RLS public.guides (is_admin()) — второй слой защиты.
 *
 * PDF (guide-files) и картинки статей (guide-images) загружаются прямо
 * из браузера (лимит тела server action в Next — 1 МБ), сюда приходят
 * готовые ссылки. Здесь же убираем из бакетов файлы, которые больше
 * ни одному гайду не нужны.
 * ──────────────────────────────────────────────────────────────────── */

export type GuideInput = {
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  description: string;
  content: string;
  readingTime: string;
  pdfUrl: string | null;
  language: GuideLanguage;
  tags: string[] | string;
  isPublished: boolean;
};

export type GuideActionError =
  | "unauthorized"
  | "validation"
  | "invalid_slug"
  | "slug_taken"
  | "not_found"
  | "failed";

export type GuideActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; reason: GuideActionError; field?: keyof GuideInput };

type Normalized = Omit<GuideRow, "id" | "created_at" | "updated_at">;
type Supabase = Awaited<ReturnType<typeof createClient>>;

const oneLine = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");

function normalize(input: GuideInput): { ok: true; row: Normalized } | { ok: false; reason: GuideActionError; field?: keyof GuideInput } {
  const title = oneLine(input.title);
  const slug = String(input.slug ?? "").trim() ? String(input.slug).trim().toLowerCase() : slugify(title);
  const seoTitle = oneLine(input.seoTitle);
  const seoDescription = oneLine(input.seoDescription);
  const seoKeywords = parseTags(String(input.seoKeywords ?? "")).join(", ");
  const description = String(input.description ?? "").trim();
  const content = String(input.content ?? "").replace(/\r\n/g, "\n").trim();
  const readingTime = String(input.readingTime ?? "").trim();
  const pdfUrl = String(input.pdfUrl ?? "").trim();

  if (title.length < 3 || title.length > 200) return { ok: false, reason: "validation", field: "title" };
  if (!slug || slug.length > 120 || !SLUG_PATTERN.test(slug)) return { ok: false, reason: "invalid_slug", field: "slug" };
  if (seoTitle.length > 120) return { ok: false, reason: "validation", field: "seoTitle" };
  if (seoDescription.length > 320) return { ok: false, reason: "validation", field: "seoDescription" };
  if (seoKeywords.length > 1000) return { ok: false, reason: "validation", field: "seoKeywords" };
  if (description.length > 1000) return { ok: false, reason: "validation", field: "description" };
  if (content.length > 300_000) return { ok: false, reason: "validation", field: "content" };
  if (readingTime.length > 40) return { ok: false, reason: "validation", field: "readingTime" };
  if (!isGuideLanguage(input.language)) return { ok: false, reason: "validation", field: "language" };
  if (pdfUrl && !/^(https:\/\/|\/)/.test(pdfUrl)) return { ok: false, reason: "validation", field: "pdfUrl" };

  return {
    ok: true,
    row: {
      title,
      slug,
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      seo_keywords: seoKeywords || null,
      description,
      content,
      reading_time: readingTime || null,
      pdf_url: pdfUrl || null,
      language: input.language,
      tags: parseTags(input.tags),
      is_published: Boolean(input.isPublished),
    },
  };
}

function fail(error: unknown, scope: string): { ok: false; reason: GuideActionError } {
  if (error instanceof AuthorizationError) return { ok: false, reason: "unauthorized" };
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return { ok: false, reason: "slug_taken" };
  if (code === "42501") return { ok: false, reason: "unauthorized" };
  if (code === "23514") return { ok: false, reason: "validation" };
  console.error(`[guides] ${scope} failed:`, error);
  return { ok: false, reason: "failed" };
}

function revalidateGuides(...slugs: Array<string | null | undefined>) {
  revalidatePath("/");
  revalidatePath("/admin/guides");
  revalidatePath("/sitemap.xml");
  for (const slug of new Set(slugs.filter(Boolean))) revalidatePath(`/guides/${slug}`);
}

async function removePdf(supabase: Supabase, pdfUrl: string | null | undefined) {
  const path = guideStoragePath(pdfUrl);
  if (!path || !pdfUrl) return;
  // Тот же файл может быть привязан к другому гайду (например, к переводу) — тогда не трогаем
  const { data: inUse, error: usageError } = await supabase.from("guides").select("id").eq("pdf_url", pdfUrl).limit(1);
  if (usageError || inUse?.length) return;
  const { error } = await supabase.storage.from(GUIDE_BUCKET).remove([path]);
  if (error) console.warn("[guides] PDF cleanup failed:", path, error.message);
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Удаляет картинки из guide-images, если их больше нет ни в одном гайде */
async function removeUnusedImages(supabase: Supabase, urls: string[]) {
  const paths: string[] = [];
  for (const url of new Set(urls)) {
    const path = guideStoragePath(url, GUIDE_IMAGES_BUCKET);
    if (!path) continue;
    const { data: inUse, error } = await supabase
      .from("guides")
      .select("id")
      .like("content", `%${escapeLike(url)}%`)
      .limit(1);
    if (error || inUse?.length) continue;
    paths.push(path);
  }
  if (!paths.length) return;
  const { error } = await supabase.storage.from(GUIDE_IMAGES_BUCKET).remove(paths);
  if (error) console.warn("[guides] image cleanup failed:", error.message);
}

/** Все гайды (включая черновики) для таблицы в админке */
export async function listGuidesAdmin(): Promise<GuideActionResult<GuideRow[]>> {
  try {
    await requireRole(ADMIN_ROLES);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("guides")
      .select(GUIDE_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { ok: true, data: (data ?? []) as GuideRow[] };
  } catch (error) {
    return fail(error, "list");
  }
}

export async function createGuide(input: GuideInput): Promise<GuideActionResult<GuideRow>> {
  try {
    await requireRole(ADMIN_ROLES);
    const parsed = normalize(input);
    if (!parsed.ok) return parsed;

    const supabase = await createClient();
    const { data, error } = await supabase.from("guides").insert(parsed.row).select(GUIDE_COLUMNS).single();
    if (error) throw error;

    revalidateGuides(parsed.row.slug);
    return { ok: true, data: data as GuideRow };
  } catch (error) {
    return fail(error, "create");
  }
}

export async function updateGuide(id: string, input: GuideInput): Promise<GuideActionResult<GuideRow>> {
  try {
    await requireRole(ADMIN_ROLES);
    const parsed = normalize(input);
    if (!parsed.ok) return parsed;

    const supabase = await createClient();
    const { data: before, error: readError } = await supabase
      .from("guides")
      .select("slug,pdf_url,content")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) return { ok: false, reason: "not_found" };

    const { data, error } = await supabase
      .from("guides")
      .update(parsed.row)
      .eq("id", id)
      .select(GUIDE_COLUMNS)
      .single();
    if (error) throw error;

    // PDF заменили или убрали — старый файл из бакета больше не нужен
    if (before.pdf_url && before.pdf_url !== parsed.row.pdf_url) await removePdf(supabase, before.pdf_url);

    // Картинки, которые убрали из текста
    const kept = new Set(extractGuideImageUrls(parsed.row.content));
    const dropped = extractGuideImageUrls(before.content ?? "").filter((url) => !kept.has(url));
    if (dropped.length) await removeUnusedImages(supabase, dropped);

    revalidateGuides(before.slug, parsed.row.slug);
    return { ok: true, data: data as GuideRow };
  } catch (error) {
    return fail(error, "update");
  }
}

export async function setGuidePublished(id: string, isPublished: boolean): Promise<GuideActionResult<GuideRow>> {
  try {
    await requireRole(ADMIN_ROLES);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("guides")
      .update({ is_published: Boolean(isPublished) })
      .eq("id", id)
      .select(GUIDE_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, reason: "not_found" };

    revalidateGuides((data as GuideRow).slug);
    return { ok: true, data: data as GuideRow };
  } catch (error) {
    return fail(error, "publish");
  }
}

export async function deleteGuide(id: string): Promise<GuideActionResult> {
  try {
    await requireRole(ADMIN_ROLES);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("guides")
      .delete()
      .eq("id", id)
      .select("slug,pdf_url,content")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, reason: "not_found" };

    await removePdf(supabase, data.pdf_url);
    await removeUnusedImages(supabase, extractGuideImageUrls(data.content ?? ""));
    revalidateGuides(data.slug);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error, "delete");
  }
}

/** Загрузили PDF, но форму закрыли без сохранения — убираем сироту из бакета */
export async function discardGuidePdf(pdfUrl: string): Promise<GuideActionResult> {
  try {
    await requireRole(ADMIN_ROLES);
    const supabase = await createClient();
    await removePdf(supabase, pdfUrl);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error, "discard pdf");
  }
}

/** Картинки, загруженные в окне редактора и не попавшие в сохранённый текст */
export async function discardGuideImages(urls: string[]): Promise<GuideActionResult> {
  try {
    await requireRole(ADMIN_ROLES);
    const supabase = await createClient();
    await removeUnusedImages(supabase, Array.isArray(urls) ? urls.slice(0, 100) : []);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error, "discard images");
  }
}

/** Предпросмотр в админке: тот же рендер и та же очистка HTML, что на сайте */
export async function previewGuideContent(content: string): Promise<GuideActionResult<GuideContentSegment[]>> {
  try {
    await requireRole(ADMIN_ROLES);
    return { ok: true, data: renderGuideContent(String(content ?? "").slice(0, 300_000)).segments };
  } catch (error) {
    return fail(error, "preview");
  }
}
