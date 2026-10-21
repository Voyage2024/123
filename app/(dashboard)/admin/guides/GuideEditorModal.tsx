"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · GUIDES — модалка создания / редактирования гайда
 *
 * PDF грузится прямо из браузера в бакет guide-files (RLS: только
 * admin/owner), в форму попадает публичная ссылка. Сохранение — через
 * серверные экшены createGuide / updateGuide.
 * Если PDF загрузили, но закрыли окно без сохранения, файл удаляется.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, FileText, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createGuide, discardGuidePdf, updateGuide, type GuideInput } from "@/app/actions/guides";
import {
  GUIDE_BUCKET,
  GUIDE_LANGUAGES,
  GUIDE_PDF_MAX_BYTES,
  buildGuidePdfPath,
  guideStoragePath,
  langToGuideLanguage,
  slugify,
  type GuideLanguage,
  type GuideRow,
} from "@/lib/guides";
import { useGuidesAdminI18n } from "@/app/(dashboard)/admin/guides/i18n";

type Props = {
  guide: GuideRow | null; // null — новый гайд
  onClose: () => void;
  onSaved: (guide: GuideRow) => void;
};

type FormState = {
  title: string;
  slug: string;
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

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className={`mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] ${error ? "text-rose-300" : "text-zinc-500"}`}>
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-5 text-zinc-600">{hint}</span>}
    </label>
  );
}

export default function GuideEditorModal({ guide, onClose, onSaved }: Props) {
  const { t, lang, languageNames, errorText } = useGuidesAdminI18n();
  const [form, setForm] = useState<FormState>(() => ({
    title: guide?.title ?? "",
    slug: guide?.slug ?? "",
    description: guide?.description ?? "",
    content: guide?.content ?? "",
    readingTime: guide?.reading_time ?? "",
    tags: guide?.tags.join(", ") ?? "",
    language: guide?.language ?? langToGuideLanguage(lang),
    isPublished: guide?.is_published ?? true,
    pdfUrl: guide?.pdf_url ?? null,
  }));
  const [slugTouched, setSlugTouched] = useState(Boolean(guide));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<keyof GuideInput | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  // PDF, загруженные в этой сессии окна и ещё не сохранённые в гайде
  const pendingUploads = useRef<Set<string>>(new Set());

  const busy = saving || uploading;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const cleanupPending = (keep: string | null) => {
    for (const url of pendingUploads.current) if (url !== keep) void discardGuidePdf(url);
    pendingUploads.current.clear();
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
      if (form.pdfUrl && pendingUploads.current.has(form.pdfUrl)) {
        pendingUploads.current.delete(form.pdfUrl);
        void discardGuidePdf(form.pdfUrl);
      }
      pendingUploads.current.add(data.publicUrl);
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
    if (form.pdfUrl && pendingUploads.current.has(form.pdfUrl)) {
      pendingUploads.current.delete(form.pdfUrl);
      void discardGuidePdf(form.pdfUrl);
    }
    // уже сохранённый файл удалит updateGuide после сохранения
    set("pdfUrl", null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setError(null);
    setErrorField(null);

    const input: GuideInput = {
      title: form.title,
      slug: form.slug,
      description: form.description,
      content: form.content,
      readingTime: form.readingTime,
      tags: form.tags,
      language: form.language,
      isPublished: form.isPublished,
      pdfUrl: form.pdfUrl,
    };

    try {
      const result = guide ? await updateGuide(guide.id, input) : await createGuide(input);
      if (!result.ok) {
        setError(errorText(result.reason));
        setErrorField(result.reason === "slug_taken" ? "slug" : result.field ?? null);
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

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm sm:py-14" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form
        onSubmit={submit}
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-950 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-editor-title"
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-200/[0.05] blur-[90px]" />

        <header className="relative flex items-start justify-between gap-4 border-b border-zinc-800/70 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65">{t.eyebrow}</p>
            <h2 id="guide-editor-title" className="mt-2 font-serif text-2xl text-zinc-50">
              {guide ? t.modalEdit : t.modalCreate}
            </h2>
          </div>
          <button type="button" onClick={close} disabled={busy} aria-label={t.close} className="rounded-lg p-2 text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-40">
            <X size={18} />
          </button>
        </header>

        <div className="relative space-y-5 px-6 py-6 sm:px-8">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-xs leading-5 text-rose-200">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <Field label={t.fTitle} error={errorField === "title"}>
            <input className={inputClass} value={form.title} onChange={(e) => onTitleChange(e.target.value)} maxLength={200} required minLength={3} disabled={saving} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
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

          <Field label={t.fDescription} error={errorField === "description"}>
            <textarea className={`${inputClass} min-h-[88px] resize-y leading-6`} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} disabled={saving} />
          </Field>

          <Field label={t.fContent} hint={t.fContentHint} error={errorField === "content"}>
            <textarea className={`${inputClass} min-h-[260px] resize-y font-mono text-[13px] leading-6`} value={form.content} onChange={(e) => set("content", e.target.value)} disabled={saving} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.fReadingTime} error={errorField === "readingTime"}>
              <input className={inputClass} value={form.readingTime} onChange={(e) => set("readingTime", e.target.value)} placeholder={t.fReadingTimePlaceholder} maxLength={40} disabled={saving} />
            </Field>
            <Field label={t.fTags} hint={t.fTagsHint}>
              <input className={inputClass} value={form.tags} onChange={(e) => set("tags", e.target.value)} disabled={saving} />
            </Field>
          </div>

          {/* PDF */}
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

          {/* Публикация */}
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-black/15 px-4 py-3.5">
            <span className="text-sm text-zinc-300">{t.fPublished}</span>
            <span className="relative inline-flex">
              <input type="checkbox" className="peer sr-only" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} disabled={saving} />
              <span className="h-6 w-11 rounded-full border border-zinc-700 bg-zinc-800 transition-colors peer-checked:border-[#c9a961]/60 peer-checked:bg-[#c9a961]/80 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-200/40" />
              <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-zinc-400 transition-transform peer-checked:translate-x-5 peer-checked:bg-zinc-950" />
            </span>
          </label>
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
