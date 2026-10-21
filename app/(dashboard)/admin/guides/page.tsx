"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · GUIDES — app/(dashboard)/admin/guides/page.tsx
 *
 * Управление блоком «Гайды и шпаргалки» на главной: таблица гайдов,
 * публикация/скрытие, создание и редактирование в модалке, удаление.
 *
 * Доступ: owner и admin. Маршрут уже закрыт правилом "/admin" в
 * lib/rbac.ts (layout + middleware); здесь данные грузятся только
 * после проверки сессии, а каждый экшен ещё раз проверяет роль
 * (requireRole) и RLS public.guides (is_admin()).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { ADMIN_ROLES } from "@/lib/rbac";
import { deleteGuide, listGuidesAdmin, setGuidePublished } from "@/app/actions/guides";
import type { GuideRow } from "@/lib/guides";
import GuideEditorModal from "@/app/(dashboard)/admin/guides/GuideEditorModal";
import { useGuidesAdminI18n } from "@/app/(dashboard)/admin/guides/i18n";

type Editor = { guide: GuideRow | null } | null;

export default function AdminGuidesPage() {
  const { role, loading: authLoading } = useAuth();
  const allowed = !!role && ADMIN_ROLES.includes(role);
  const { t, errorText, formatDate } = useGuidesAdminI18n();

  const [rows, setRows] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listGuidesAdmin();
      if (!result.ok) {
        setError(errorText(result.reason));
        return;
      }
      setRows(result.data);
    } catch (e) {
      console.error("[Guides Admin] load failed:", e);
      setError(errorText("failed"));
    } finally {
      setLoading(false);
    }
  }, [errorText]);

  useEffect(() => {
    if (authLoading || !allowed) return; // ждём сессию; без прав данные не грузим
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial async data load after role resolution.
    void load();
  }, [authLoading, allowed, load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const upsertRow = (guide: GuideRow) =>
    setRows((list) => {
      const exists = list.some((g) => g.id === guide.id);
      const next = exists ? list.map((g) => (g.id === guide.id ? guide : g)) : [guide, ...list];
      return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
    });

  const onTogglePublished = async (guide: GuideRow) => {
    setWorkingId(guide.id);
    setError(null);
    try {
      const result = await setGuidePublished(guide.id, !guide.is_published);
      if (!result.ok) {
        setError(errorText(result.reason));
        return;
      }
      upsertRow(result.data);
      setNotice(result.data.is_published ? t.publishedNotice : t.hiddenNotice);
    } finally {
      setWorkingId(null);
    }
  };

  const onDelete = async (guide: GuideRow) => {
    if (!window.confirm(t.confirmDelete.replace("{title}", guide.title))) return;
    setWorkingId(guide.id);
    setError(null);
    try {
      const result = await deleteGuide(guide.id);
      if (!result.ok) {
        setError(errorText(result.reason));
        if (result.reason === "not_found") setRows((list) => list.filter((g) => g.id !== guide.id));
        return;
      }
      setRows((list) => list.filter((g) => g.id !== guide.id));
      setNotice(t.deleted);
    } finally {
      setWorkingId(null);
    }
  };

  if (!authLoading && !allowed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/20 text-amber-200/70">
          <LockKeyhole size={18} />
        </span>
        <p className="max-w-sm text-sm text-zinc-400">{t.noAccess}</p>
      </div>
    );
  }

  const showSpinner = authLoading || loading;

  return (
    <div className="space-y-7 pb-10">
      <header className="relative overflow-hidden rounded-3xl border border-amber-200/15 bg-gradient-to-br from-zinc-900/90 via-zinc-900/55 to-zinc-950 p-7 sm:p-9">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber-200/[0.05] blur-[90px]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-100/65">
              <BookOpen size={13} /> {t.eyebrow}
            </p>
            <h1 className="mt-4 font-serif text-4xl font-medium tracking-tight text-zinc-50 sm:text-5xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{t.intro}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditor({ guide: null })}
              disabled={!allowed}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-200/25 bg-amber-200/[0.07] px-4 py-3 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-200/45 hover:bg-amber-200/[0.11] disabled:opacity-40"
            >
              <Plus size={14} /> {t.create}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              disabled={showSpinner || !allowed}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-zinc-700/80 bg-black/15 px-4 py-3 text-xs text-zinc-300 transition-colors hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-40"
            >
              <RefreshCw size={14} className={showSpinner ? "animate-spin" : ""} /> {t.refresh}
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-200/90">
          <span className="flex items-center gap-2"><Check size={14} />{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.close}><X size={14} /></button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-xs leading-5 text-rose-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />{error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
        <div className="flex flex-col gap-2 border-b border-zinc-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">{t.library}</p>
            <h2 className="mt-1 font-serif text-xl text-zinc-100">{t.title}</h2>
          </div>
          <span className="w-fit rounded-full border border-zinc-700/70 bg-black/15 px-3 py-1 text-xs tabular-nums text-zinc-400">
            {rows.length} {t.guides}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="bg-black/20">
              <tr className="border-b border-zinc-800/80 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                <th className="px-5 py-4">{t.colTitle}</th>
                <th className="px-5 py-4">{t.colLanguage}</th>
                <th className="px-5 py-4">{t.colStatus}</th>
                <th className="px-5 py-4">{t.colDate}</th>
                <th className="px-5 py-4 text-right">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {showSpinner ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-zinc-500">
                    <LoaderCircle size={17} className="mr-2 inline animate-spin text-amber-100/70" />{t.loading}
                  </td>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-zinc-500">{t.empty}</td>
                </tr>
              ) : rows.map((guide) => {
                const busy = workingId === guide.id;
                return (
                  <tr key={guide.id} className="align-top transition-colors hover:bg-white/[0.015]">
                    <td className="max-w-[420px] px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setEditor({ guide })}
                        className="text-left text-sm font-medium leading-6 text-zinc-200 transition-colors hover:text-amber-100"
                      >
                        {guide.title}
                      </button>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
                        <span>/guides/{guide.slug}</span>
                        {guide.reading_time && <span>· {guide.reading_time}</span>}
                        {guide.pdf_url && (
                          <span className="inline-flex items-center gap-1 text-[#c9a961]/80">
                            <FileText size={12} /> PDF
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-lg border border-zinc-700/70 bg-black/15 px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-zinc-300">
                        {guide.language}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {guide.is_published ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-200/90">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t.published}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-black/15 px-3 py-1 text-xs text-zinc-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> {t.draft}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs tabular-nums text-zinc-400">{formatDate(guide.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/guides/${guide.slug}`}
                          target="_blank"
                          title={t.open}
                          aria-label={t.open}
                          className="rounded-lg border border-zinc-700/80 bg-black/15 p-2 text-zinc-400 transition-colors hover:border-amber-200/25 hover:text-amber-100"
                        >
                          <ExternalLink size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void onTogglePublished(guide)}
                          disabled={busy}
                          title={guide.is_published ? t.unpublish : t.publish}
                          aria-label={guide.is_published ? t.unpublish : t.publish}
                          className="rounded-lg border border-zinc-700/80 bg-black/15 p-2 text-zinc-400 transition-colors hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-40"
                        >
                          {busy ? <LoaderCircle size={14} className="animate-spin" /> : guide.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditor({ guide })}
                          disabled={busy}
                          title={t.edit}
                          aria-label={t.edit}
                          className="rounded-lg border border-zinc-700/80 bg-black/15 p-2 text-zinc-400 transition-colors hover:border-amber-200/25 hover:text-amber-100 disabled:opacity-40"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(guide)}
                          disabled={busy}
                          title={t.delete}
                          aria-label={t.delete}
                          className="rounded-lg border border-zinc-700/80 bg-black/15 p-2 text-zinc-400 transition-colors hover:border-rose-900/70 hover:text-rose-200 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editor && (
        <GuideEditorModal
          guide={editor.guide}
          onClose={() => setEditor(null)}
          onSaved={(guide) => {
            upsertRow(guide);
            setEditor(null);
            setNotice(t.saved);
          }}
        />
      )}
    </div>
  );
}
