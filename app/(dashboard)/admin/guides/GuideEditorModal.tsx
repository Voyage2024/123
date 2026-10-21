"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · GUIDES — редактор гайда (модалка)
 *
 * Два режима (выбор запоминается на устройстве):
 *   «Быстро»    — заголовок, язык, превью, текст, PDF, публикация.
 *                 Адрес и SEO собираются сами из заголовка и превью.
 *   «SEO-профи» — плюс ручной slug, SEO Title/Description/Keywords,
 *                 теги и предпросмотр сниппета поисковика.
 *
 * Текст: Markdown + HTML, панель быстрой разметки, вставка картинки
 * в позицию курсора (файл уходит в бакет guide-images), предпросмотр
 * тем же рендером, что и на сайте (previewGuideContent).
 * PDF — в бакет guide-files, с заменой и удалением.
 * Файлы, загруженные в окне и не попавшие в сохранённый гайд, удаляются.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Bold,
  Calculator,
  ChevronDown,
  Eye,
  FileText,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  Minus,
  PenLine,
  Quote,
  Search,
  Sparkles,
  Table2,
  Trash2,
  Upload,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  createGuide,
  discardGuideImages,
  discardGuidePdf,
  previewGuideContent,
  updateGuide,
  type GuideInput,
} from "@/app/actions/guides";
import {
  GUIDE_BUCKET,
  GUIDE_IMAGES_BUCKET,
  GUIDE_IMAGE_MAX_BYTES,
  GUIDE_IMAGE_TYPES,
  GUIDE_LANGUAGES,
  GUIDE_PDF_MAX_BYTES,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  buildGuideImagePath,
  buildGuidePdfPath,
  estimateReadingTime,
  guideStoragePath,
  langToGuideLanguage,
  slugify,
  type GuideContentSegment,
  type GuideLanguage,
  type GuideRow,
} from "@/lib/guides";
import GuideContent from "@/app/components/guides/GuideContent";
import { useGuidesAdminI18n, type GuidesAdminCopy } from "@/app/(dashboard)/admin/guides/i18n";

type Props = {
  guide: GuideRow | null; // null — новый гайд
  onClose: () => void;
  onSaved: (guide: GuideRow) => void;
};

type Mode = "quick" | "pro";
const MODE_KEY = "voyage-guides-editor-mode";

type FormState = {
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  description: string;
  content: string;
  readingTime: string;
  tags: string;
  language: GuideLanguage;
  isPublished: boolean;
  pdfUrl: string | null;
};

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-black/25 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-amber-200/40 disabled:opacity-50";

function Field({
  label,
  hint,
  error,
  counter,
  action,
  children,
}: {
  label: string;
  hint?: string;
  error?: boolean;
  counter?: { value: number; limit: number };
  action?: ReactNode;
  children: ReactNode;
}) {
  const over = counter ? counter.value > counter.limit : false;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${error ? "text-rose-300" : "text-zinc-500"}`}>{label}</span>
        <span className="flex items-center gap-3">
          {action}
          {counter && (
            <span className={`text-[10px] tabular-nums ${over ? "text-amber-300" : "text-zinc-600"}`}>
              {counter.value} / {counter.limit}
            </span>
          )}
        </span>
      </div>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-5 text-zinc-600">{hint}</span>}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-zinc-800/70 bg-black/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/70">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

const smallBtn =
  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[#c9a961]/80 transition-colors hover:text-amber-100 disabled:opacity-40";

type ToolbarAction = { key: string; icon: LucideIcon; label: keyof GuidesAdminCopy; run: () => void };

export default function GuideEditorModal({ guide, onClose, onSaved }: Props) {
  const { t, lang, languageNames, errorText } = useGuidesAdminI18n();
  const [mode, setMode] = useState<Mode>("quick");
  const [form, setForm] = useState<FormState>(() => ({
    title: guide?.title ?? "",
    slug: guide?.slug ?? "",
    seoTitle: guide?.seo_title ?? "",
    seoDescription: guide?.seo_description ?? "",
    seoKeywords: guide?.seo_keywords ?? "",
    description: guide?.description ?? "",
    content: guide?.content ?? "",
    readingTime: guide?.reading_time ?? "",
    tags: guide?.tags.join(", ") ?? "",
    language: guide?.language ?? langToGuideLanguage(lang),
    isPublished: guide?.is_published ?? true,
    pdfUrl: guide?.pdf_url ?? null,
  }));
  const [slugTouched, setSlugTouched] = useState(Boolean(guide));
  const [slugEditing, setSlugEditing] = useState(false);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState<GuideContentSegment[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<keyof GuideInput | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<{ start: number; end: number } | null>(null);
  // Файлы, загруженные в этом окне и ещё не сохранённые в гайде
  const pendingPdfs = useRef<Set<string>>(new Set());
  const pendingImages = useRef<Set<string>>(new Set());

  const busy = saving || uploading || imageUploading;
  const pro = mode === "pro";
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Режим редактора запоминаем на устройстве
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore a per-device preference after mount.
      if (saved === "pro" || saved === "quick") setMode(saved);
    } catch {
      /* localStorage недоступен */
    }
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      /* игнорируем */
    }
  };

  const cleanupPending = (keepPdf: string | null) => {
    for (const url of pendingPdfs.current) if (url !== keepPdf) void discardGuidePdf(url);
    pendingPdfs.current.clear();
    // сервер удалит только те картинки, которых нет ни в одном сохранённом гайде
    if (pendingImages.current.size) void discardGuideImages([...pendingImages.current]);
    pendingImages.current.clear();
  };

  const close = () => {
    if (busy) return;
    cleanupPending(null);
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  });

  const onTitleChange = (value: string) => {
    setForm((f) => ({ ...f, title: value, slug: slugTouched ? f.slug : slugify(value) }));
  };

  // ── Вставка разметки в позицию курсора ─────────────────────────────

  const rememberSelection = () => {
    const el = textarea.current;
    if (el) selection.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  /**
   * Оборачивает выделение (или вставляет placeholder) и ставит курсор внутрь.
   * replace = true — выделение заменяется на before целиком.
   */
  const insert = (before: string, after = "", placeholder = "", block = false, replace = false) => {
    const el = textarea.current;
    const value = form.content;
    const sel = selection.current ?? (el ? { start: el.selectionStart, end: el.selectionEnd } : { start: value.length, end: value.length });
    const selected = replace ? "" : value.slice(sel.start, sel.end) || placeholder;

    let prefix = before;
    let suffix = after;
    if (block) {
      // блочные элементы — с новой строки и с пустой строкой после
      const head = value.slice(0, sel.start);
      if (head && !head.endsWith("\n\n")) prefix = (head.endsWith("\n") ? "\n" : "\n\n") + prefix;
      const tail = value.slice(sel.end);
      if (!tail.startsWith("\n\n")) suffix += tail.startsWith("\n") ? "\n" : "\n\n";
    }

    const next = value.slice(0, sel.start) + prefix + selected + suffix + value.slice(sel.end);
    const cursorStart = sel.start + prefix.length;
    const cursorEnd = cursorStart + selected.length;
    set("content", next);
    selection.current = null;
    setPreviewHtml(null);

    requestAnimationFrame(() => {
      const node = textarea.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const prefixLines = (marker: (i: number) => string, placeholder: string) => {
    const el = textarea.current;
    const sel = selection.current ?? (el ? { start: el.selectionStart, end: el.selectionEnd } : null);
    const selected = sel ? form.content.slice(sel.start, sel.end) : "";
    const lines = (selected || placeholder).split("\n");
    const body = lines.map((line, i) => `${marker(i)}${line}`).join("\n");
    selection.current = sel;
    insert(body, "", "", true, true);
  };

  const toolbar: ToolbarAction[] = [
    { key: "h2", icon: Heading2, label: "tbH2", run: () => insert("## ", "", t.sampleHeading, true) },
    { key: "h3", icon: Heading3, label: "tbH3", run: () => insert("### ", "", t.sampleHeading, true) },
    { key: "b", icon: Bold, label: "tbBold", run: () => insert("**", "**", t.sampleText) },
    { key: "i", icon: Italic, label: "tbItalic", run: () => insert("*", "*", t.sampleText) },
    { key: "ul", icon: List, label: "tbList", run: () => prefixLines(() => "- ", t.sampleItem) },
    { key: "ol", icon: ListOrdered, label: "tbOl", run: () => prefixLines((i) => `${i + 1}. `, t.sampleItem) },
    { key: "q", icon: Quote, label: "tbQuote", run: () => prefixLines(() => "> ", t.sampleText) },
    { key: "a", icon: Link2, label: "tbLink", run: () => insert("[", "](https://)", t.sampleLink) },
    { key: "table", icon: Table2, label: "tbTable", run: () => insert(t.sampleTable, "", "", true) },
    { key: "note", icon: Sparkles, label: "tbNote", run: () => insert(t.sampleNote, "", "", true) },
    { key: "hr", icon: Minus, label: "tbHr", run: () => insert("---", "", "", true) },
  ];

  // ── Картинка в текст ───────────────────────────────────────────────

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!(GUIDE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError(t.err_image_type);
      return;
    }
    if (file.size > GUIDE_IMAGE_MAX_BYTES) {
      setError(t.err_image_size);
      return;
    }

    setImageUploading(true);
    try {
      const path = buildGuideImagePath(form.language, form.slug || form.title, file.name);
      const { error: uploadError } = await supabase.storage
        .from(GUIDE_IMAGES_BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(GUIDE_IMAGES_BUCKET).getPublicUrl(path);
      pendingImages.current.add(data.publicUrl);

      const el = textarea.current;
      const sel = selection.current;
      const selected = sel && el ? form.content.slice(sel.start, sel.end).trim() : "";
      const alt = (selected || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")).replace(/[[\]]/g, "");
      // выделенный текст становится подписью (alt), сама картинка — отдельным блоком
      insert(`![${alt}](${data.publicUrl})`, "", "", true, true);
      if (tab === "preview") setTab("write");
    } catch (e) {
      console.error("[Guides Admin] image upload failed:", e);
      setError(t.err_image_upload);
    } finally {
      setImageUploading(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  };

  // ── PDF ────────────────────────────────────────────────────────────

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setErrorField(null);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError(t.err_pdf_type);
      return;
    }
    if (file.size > GUIDE_PDF_MAX_BYTES) {
      setError(t.err_pdf_size);
      return;
    }

    setUploading(true);
    try {
      const path = buildGuidePdfPath(form.language, form.slug || form.title || file.name.replace(/\.pdf$/i, ""));
      const { error: uploadError } = await supabase.storage
        .from(GUIDE_BUCKET)
        .upload(path, file, { contentType: "application/pdf", cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(GUIDE_BUCKET).getPublicUrl(path);
      // предыдущий несохранённый файл больше не нужен
      if (form.pdfUrl && pendingPdfs.current.has(form.pdfUrl)) {
        pendingPdfs.current.delete(form.pdfUrl);
        void discardGuidePdf(form.pdfUrl);
      }
      pendingPdfs.current.add(data.publicUrl);
      set("pdfUrl", data.publicUrl);
    } catch (e) {
      console.error("[Guides Admin] PDF upload failed:", e);
      setError(t.err_pdf_upload);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removePdf = () => {
    if (form.pdfUrl && pendingPdfs.current.has(form.pdfUrl)) {
      pendingPdfs.current.delete(form.pdfUrl);
      void discardGuidePdf(form.pdfUrl);
    }
    // уже сохранённый файл удалит updateGuide после сохранения
    set("pdfUrl", null);
  };

  // ── Предпросмотр ───────────────────────────────────────────────────

  const openPreview = async () => {
    setTab("preview");
    if (previewHtml !== null) return;
    setPreviewLoading(true);
    try {
      const result = await previewGuideContent(form.content);
      setPreviewHtml(result.ok ? result.data : []);
      if (!result.ok) setError(errorText(result.reason));
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Сохранение ─────────────────────────────────────────────────────

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setError(null);
    setErrorField(null);

    const readingTime = form.readingTime.trim() || (form.content.trim() ? estimateReadingTime(form.content, form.language) : "");
    const input: GuideInput = {
      title: form.title,
      slug: form.slug,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      seoKeywords: form.seoKeywords,
      description: form.description,
      content: form.content,
      readingTime,
      tags: form.tags,
      language: form.language,
      isPublished: form.isPublished,
      pdfUrl: form.pdfUrl,
    };

    try {
      const result = guide ? await updateGuide(guide.id, input) : await createGuide(input);
      if (!result.ok) {
        const field = result.reason === "slug_taken" ? "slug" : result.field ?? null;
        setErrorField(field);
        setError(field === "seoTitle" ? t.err_seoTitle : field === "seoDescription" ? t.err_seoDescription : errorText(result.reason));
        // ошибка в поле, которого нет в «Быстро», — показываем его
        if (field && ["slug", "seoTitle", "seoDescription", "seoKeywords"].includes(field)) switchMode("pro");
        return;
      }
      cleanupPending(result.data.pdf_url);
      onSaved(result.data);
    } catch (e) {
      console.error("[Guides Admin] save failed:", e);
      setError(t.err_failed);
    } finally {
      setSaving(false);
    }
  };

  const pdfName = form.pdfUrl
    ? decodeURIComponent((guideStoragePath(form.pdfUrl) ?? form.pdfUrl).split("/").pop() ?? "")
    : null;
  const snippetTitle = form.seoTitle.trim() || form.title.trim() || t.fTitle;
  const snippetDesc = (form.seoDescription.trim() || form.description.trim()).slice(0, SEO_DESCRIPTION_LIMIT + 20);
  const host = typeof window !== "undefined" ? window.location.host : "voyage";

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm sm:py-12" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form
        onSubmit={submit}
        className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-950 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-editor-title"
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-200/[0.05] blur-[90px]" />

        <header className="relative flex flex-col gap-4 border-b border-zinc-800/70 px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65">{t.eyebrow}</p>
              <h2 id="guide-editor-title" className="mt-2 font-serif text-2xl text-zinc-50">
                {guide ? t.modalEdit : t.modalCreate}
              </h2>
            </div>
            <button type="button" onClick={close} disabled={busy} aria-label={t.close} className="rounded-lg p-2 text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-40">
              <X size={18} />
            </button>
          </div>

          {/* Переключатель режимов */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit rounded-xl border border-zinc-800 bg-black/30 p-1" role="tablist">
              {([
                ["quick", Zap, t.modeQuick],
                ["pro", Search, t.modePro],
              ] as const).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                    mode === value ? "bg-[#c9a961] text-zinc-950" : "text-zinc-400 hover:text-amber-100"
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-zinc-500 sm:max-w-sm sm:text-right">{pro ? t.modeProHint : t.modeQuickHint}</p>
          </div>
        </header>

        <div className="relative space-y-5 px-6 py-6 sm:px-8">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-xs leading-5 text-rose-200">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Основное ── */}
          <Section title={t.sectionMain}>
            <Field label={t.fTitle} error={errorField === "title"}>
              <input className={inputClass} value={form.title} onChange={(e) => onTitleChange(e.target.value)} maxLength={200} required minLength={3} disabled={saving} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
              {pro || slugEditing || errorField === "slug" ? (
                <Field label={t.fSlug} hint={t.fSlugHint} error={errorField === "slug"}>
                  <div className="flex items-center rounded-xl border border-zinc-800 bg-black/25 focus-within:border-amber-200/40">
                    <span className="pl-4 text-sm text-zinc-600">/guides/</span>
                    <input
                      className="w-full bg-transparent py-3 pr-4 text-sm text-zinc-100 outline-none"
                      value={form.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                      }}
                      onBlur={() => set("slug", slugify(form.slug))}
                      maxLength={120}
                      disabled={saving}
                    />
                  </div>
                </Field>
              ) : (
                <Field label={t.slugAuto}>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-black/15 px-4 py-3 text-sm">
                    <span className="truncate text-zinc-400">/guides/{form.slug || "…"}</span>
                    <button type="button" className={smallBtn} onClick={() => setSlugEditing(true)}>
                      <PenLine size={11} /> {t.slugEdit}
                    </button>
                  </div>
                </Field>
              )}
              <Field label={t.fLanguage} error={errorField === "language"}>
                <select className={inputClass} value={form.language} onChange={(e) => set("language", e.target.value as GuideLanguage)} disabled={saving}>
                  {GUIDE_LANGUAGES.map((code) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()} · {languageNames[code]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label={t.fPreview} error={errorField === "description"} counter={{ value: form.description.length, limit: 1000 }}>
              <textarea
                className={`${inputClass} min-h-[88px] resize-y leading-6`}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={1000}
                disabled={saving}
              />
            </Field>
          </Section>

          {/* ── Текст статьи ── */}
          <Section
            title={t.sectionContent}
            aside={
              <div className="inline-flex rounded-lg border border-zinc-800 bg-black/30 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTab("write")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === "write" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  <PenLine size={12} /> {t.tabWrite}
                </button>
                <button
                  type="button"
                  onClick={() => void openPreview()}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === "preview" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  <Eye size={12} /> {t.tabPreview}
                </button>
              </div>
            }
          >
            {tab === "write" ? (
              <div className={`overflow-hidden rounded-xl border bg-black/25 ${errorField === "content" ? "border-rose-900/70" : "border-zinc-800 focus-within:border-amber-200/40"}`}>
                <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-800/80 bg-black/20 px-2 py-1.5">
                  {toolbar.map(({ key, icon: Icon, label, run }) => (
                    <button
                      key={key}
                      type="button"
                      title={t[label]}
                      aria-label={t[label]}
                      onMouseDown={(e) => {
                        e.preventDefault(); // не теряем выделение в textarea
                        rememberSelection();
                      }}
                      onClick={run}
                      disabled={saving}
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-amber-100 disabled:opacity-40"
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                  <span className="mx-1 h-5 w-px bg-zinc-800" aria-hidden />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      rememberSelection();
                    }}
                    onClick={() => insert(t.sampleChecklist, "", "", true, true)}
                    disabled={saving}
                    title={t.tbChecklistHint}
                    className="mr-1 inline-flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-amber-200/40 hover:text-amber-100 disabled:opacity-40"
                  >
                    <ListChecks size={14} />
                    {t.tbChecklist}
                  </button>
                  <input
                    ref={imageInput}
                    type="file"
                    accept={GUIDE_IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => void onPickImage(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      rememberSelection();
                    }}
                    onClick={() => imageInput.current?.click()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-200/20 bg-amber-200/[0.06] px-3 py-1.5 text-[11px] font-semibold text-amber-100 transition-colors hover:border-amber-200/45 hover:bg-amber-200/[0.1] disabled:opacity-40"
                  >
                    {imageUploading ? <LoaderCircle size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                    {imageUploading ? t.tbImageUploading : t.tbImage}
                  </button>
                </div>
                <textarea
                  ref={textarea}
                  className="block min-h-[340px] w-full resize-y bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-zinc-100 outline-none placeholder:text-zinc-600"
                  value={form.content}
                  onChange={(e) => {
                    set("content", e.target.value);
                    setPreviewHtml(null);
                  }}
                  onSelect={rememberSelection}
                  onBlur={rememberSelection}
                  spellCheck
                  disabled={saving}
                />
              </div>
            ) : (
              <div className="max-h-[520px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 px-6 py-6">
                {previewLoading ? (
                  <p className="py-10 text-center text-sm text-zinc-500">
                    <LoaderCircle size={16} className="mr-2 inline animate-spin text-amber-100/70" />
                    {t.previewLoading}
                  </p>
                ) : previewHtml?.length ? (
                  <GuideContent segments={previewHtml} language={form.language} guideTitle={form.title} />
                ) : (
                  <p className="py-10 text-center text-sm text-zinc-500">{t.previewEmpty}</p>
                )}
              </div>
            )}
            <p className="text-[11px] leading-5 text-zinc-600">{t.contentHelp}</p>

            <Field
              label={t.fReadingTime}
              hint={t.readingAutoHint}
              error={errorField === "readingTime"}
              action={
                <button
                  type="button"
                  className={smallBtn}
                  disabled={!form.content.trim()}
                  onClick={() => set("readingTime", estimateReadingTime(form.content, form.language))}
                >
                  <Calculator size={11} /> {t.readingAuto}
                </button>
              }
            >
              <input
                className={`${inputClass} sm:max-w-xs`}
                value={form.readingTime}
                onChange={(e) => set("readingTime", e.target.value)}
                placeholder={t.fReadingTimePlaceholder}
                maxLength={40}
                disabled={saving}
              />
            </Field>
          </Section>

          {/* ── SEO и теги ── */}
          <Section
            title={t.sectionSeo}
            aside={
              !pro && (
                <button type="button" className={smallBtn} onClick={() => switchMode("pro")}>
                  {t.modePro} <ChevronDown size={11} />
                </button>
              )
            }
          >
            {!pro ? (
              <p className="text-xs leading-5 text-zinc-500">{t.seoAutoSummary}</p>
            ) : (
              <>
                <Field
                  label={t.fSeoTitle}
                  hint={t.fSeoTitleHint}
                  error={errorField === "seoTitle"}
                  counter={{ value: form.seoTitle.length, limit: SEO_TITLE_LIMIT }}
                  action={
                    <button type="button" className={smallBtn} onClick={() => set("seoTitle", form.title.trim().slice(0, 120))} disabled={!form.title.trim()}>
                      {t.seoFromTitle}
                    </button>
                  }
                >
                  <input className={inputClass} value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={120} placeholder={form.title} disabled={saving} />
                </Field>

                <Field
                  label={t.fSeoDescription}
                  hint={t.fSeoDescriptionHint}
                  error={errorField === "seoDescription"}
                  counter={{ value: form.seoDescription.length, limit: SEO_DESCRIPTION_LIMIT }}
                  action={
                    <button
                      type="button"
                      className={smallBtn}
                      onClick={() => set("seoDescription", form.description.trim().replace(/\s+/g, " ").slice(0, SEO_DESCRIPTION_LIMIT))}
                      disabled={!form.description.trim()}
                    >
                      {t.seoFromPreview}
                    </button>
                  }
                >
                  <textarea
                    className={`${inputClass} min-h-[76px] resize-y leading-6`}
                    value={form.seoDescription}
                    onChange={(e) => set("seoDescription", e.target.value)}
                    maxLength={320}
                    placeholder={form.description}
                    disabled={saving}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={t.fSeoKeywords} hint={t.fSeoKeywordsHint} error={errorField === "seoKeywords"}>
                    <input className={inputClass} value={form.seoKeywords} onChange={(e) => set("seoKeywords", e.target.value)} maxLength={1000} disabled={saving} />
                  </Field>
                  <Field label={t.fTags} hint={t.fTagsHint}>
                    <input className={inputClass} value={form.tags} onChange={(e) => set("tags", e.target.value)} disabled={saving} />
                  </Field>
                </div>

                {/* Предпросмотр сниппета */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{t.snippet}</p>
                  <div className="rounded-xl border border-zinc-800 bg-white px-5 py-4 font-sans">
                    <p className="truncate text-xs text-[#202124]">
                      {host} › guides › {form.slug || "…"}
                    </p>
                    <p className="mt-1 truncate text-lg leading-snug text-[#1a0dab]">
                      {snippetTitle.length > SEO_TITLE_LIMIT ? `${snippetTitle.slice(0, SEO_TITLE_LIMIT)}…` : snippetTitle}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-[#4d5156]">
                      {snippetDesc.length > SEO_DESCRIPTION_LIMIT ? `${snippetDesc.slice(0, SEO_DESCRIPTION_LIMIT)}…` : snippetDesc || "—"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </Section>

          {/* ── PDF и публикация ── */}
          <Section title={t.sectionFiles}>
            <div>
              <span className={`mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] ${errorField === "pdfUrl" ? "text-rose-300" : "text-zinc-500"}`}>{t.fPdf}</span>
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zinc-800 bg-black/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c9a961]/30 text-[#c9a961]">
                    <FileText size={18} strokeWidth={1.5} />
                  </span>
                  {pdfName ? (
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{t.pdfCurrent}</p>
                      <a href={form.pdfUrl!} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-amber-100 hover:underline">
                        {pdfName}
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs leading-5 text-zinc-500">{t.pdfHint}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onPickFile(e.target.files?.[0])} />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/[0.07] px-4 py-2.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-200/45 hover:bg-amber-200/[0.11] disabled:opacity-40"
                  >
                    {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? t.pdfUploading : pdfName ? t.pdfReplace : t.pdfUpload}
                  </button>
                  {pdfName && (
                    <button
                      type="button"
                      onClick={removePdf}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700/80 bg-black/15 px-3 py-2.5 text-xs text-zinc-400 transition-colors hover:border-rose-900/70 hover:text-rose-200 disabled:opacity-40"
                    >
                      <Trash2 size={14} /> {t.pdfRemove}
                    </button>
                  )}
                </div>
              </div>
              {pdfName && <p className="mt-1.5 text-[11px] text-zinc-600">{t.pdfHint}</p>}
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-black/15 px-4 py-3.5">
              <span className="text-sm text-zinc-300">{t.fPublished}</span>
              <span className="relative inline-flex">
                <input type="checkbox" className="peer sr-only" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} disabled={saving} />
                <span className="h-6 w-11 rounded-full border border-zinc-700 bg-zinc-800 transition-colors peer-checked:border-[#c9a961]/60 peer-checked:bg-[#c9a961]/80 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-200/40" />
                <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-zinc-400 transition-transform peer-checked:translate-x-5 peer-checked:bg-zinc-950" />
              </span>
            </label>
          </Section>
        </div>

        <footer className="relative flex flex-col-reverse gap-2 border-t border-zinc-800/70 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
          <button type="button" onClick={close} disabled={busy} className="rounded-xl border border-zinc-700/80 bg-black/15 px-5 py-3 text-xs text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-40">
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c9a961] px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-950 transition-colors hover:bg-[#d6b877] disabled:opacity-50"
          >
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            {saving ? t.saving : t.save}
          </button>
        </footer>
      </form>
    </div>
  );
}
