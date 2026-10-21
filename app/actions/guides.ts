"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { ADMIN_ROLES } from "@/lib/rbac";
import {
  GUIDE_BUCKET,
  GUIDE_COLUMNS,
  SLUG_PATTERN,
  guideStoragePath,
  isGuideLanguage,
  parseTags,
  slugify,
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
 * PDF загружается в бакет guide-files прямо из браузера (лимит тела
 * server action в Next — 1 МБ), сюда приходит уже готовая ссылка.
 * Здесь же убираем из бакета файлы, которые больше не нужны.
 * ──────────────────────────────────────────────────────────────────── */

export type GuideInput = {
  title: string;
  slug: string;
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

function normalize(input: GuideInput): { ok: true; row: Normalized } | { ok: false; reason: GuideActionError; field?: keyof GuideInput } {
  const title = String(input.title ?? "").trim().replace(/\s+/g, " ");
  const slug = (String(input.slug ?? "").trim() ? String(input.slug).trim().toLowerCase() : slugify(title));
  const description = String(input.description ?? "").trim();
  const content = String(input.content ?? "").replace(/\r\n/g, "\n").trim();
  const readingTime = String(input.readingTime ?? "").trim();
  const pdfUrl = String(input.pdfUrl ?? "").trim();

  if (title.length < 3 || title.length > 200) return { ok: false, reason: "validation", field: "title" };
  if (!slug || slug.length > 120 || !SLUG_PATTERN.test(slug)) return { ok: false, reason: "invalid_slug", field: "slug" };
  if (description.length > 1000) return { ok: false, reason: "validation", field: "description" };
  if (content.length > 200_000) return { ok: false, reason: "validation", field: "content" };
  if (readingTime.length > 40) return { ok: false, reason: "validation", field: "readingTime" };
  if (!isGuideLanguage(input.language)) return { ok: false, reason: "validation", field: "language" };
  if (pdfUrl && !/^(https:\/\/|\/)/.test(pdfUrl)) return { ok: false, reason: "validation", field: "pdfUrl" };

  return {
    ok: true,
    row: {
      title,
      slug,
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
  for (const slug of new Set(slugs.filter(Boolean))) revalidatePath(`/guides/${slug}`);
}

async function removePdf(supabase: Awaited<ReturnType<typeof createClient>>, pdfUrl: string | null | undefined) {
  const path = guideStoragePath(pdfUrl);
  if (!path) return;
  // Тот же файл может быть привязан к другому гайду (например, к переводу) — тогда не трогаем
  const { data: inUse, error: usageError } = await supabase.from("guides").select("id").eq("pdf_url", pdfUrl!).limit(1);
  if (usageError || inUse?.length) return;
  const { error } = await supabase.storage.from(GUIDE_BUCKET).remove([path]);
  if (error) console.warn("[guides] PDF cleanup failed:", path, error.message);
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
      .select("slug,pdf_url")
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
      .select("slug,pdf_url")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, reason: "not_found" };

    await removePdf(supabase, data.pdf_url);
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
