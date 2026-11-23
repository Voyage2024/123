"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог туров — «Внутренняя заметка владельца» (только owner)
 * app/(dashboard)/partner/castings/tours/_components/OwnerNoteBlock.tsx
 *
 * Контролируемое поле: TourEditor держит текст и сохраняет его вместе с
 * туром (saveCatalogOwnerNote после saveCatalogTour). Заметка живёт в
 * отдельной таблице tour_catalog_owner_notes (RLS is_owner()), поэтому её
 * не видят admin, менеджеры и резидентки — даже прямым запросом.
 * ──────────────────────────────────────────────────────────────────── */

import { Lock } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { TOUR_MANAGERS_COPY, formatDateTime } from "@/app/(dashboard)/partner/castings/tours/_components/tourManagersCopy";

export const OWNER_NOTE_LIMIT = 8000;

export function OwnerNoteBlock({
  value,
  onChange,
  updatedAt,
  loading,
  disabled,
  lang,
}: {
  value: string;
  onChange: (next: string) => void;
  updatedAt: string | null;
  loading?: boolean;
  disabled?: boolean;
  lang: Lang;
}) {
  const t = TOUR_MANAGERS_COPY[lang] ?? TOUR_MANAGERS_COPY.EN;
  return (
    <section className="space-y-3 rounded-2xl border border-amber-200/20 bg-gradient-to-b from-amber-200/[0.05] to-transparent p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-200">
          <Lock size={13} className="text-amber-200" /> {t.noteTitle}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/40 bg-amber-200/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
          <Lock size={10} /> {t.notePrivate}
        </span>
      </div>
      <p className="text-xs leading-5 text-zinc-500">{t.noteHint}</p>
      <textarea
        className="min-h-32 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/50 focus:outline-none disabled:opacity-60"
        rows={5}
        maxLength={OWNER_NOTE_LIMIT}
        value={value}
        disabled={disabled || loading}
        placeholder={loading ? "…" : t.notePlaceholder}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t.noteTitle}
      />
      <p className="flex justify-between text-[11px] text-zinc-600">
        <span>{updatedAt ? t.noteSaved(formatDateTime(updatedAt, lang)) : ""}</span>
        <span className="font-mono">
          {value.length}/{OWNER_NOTE_LIMIT}
        </span>
      </p>
    </section>
  );
}
