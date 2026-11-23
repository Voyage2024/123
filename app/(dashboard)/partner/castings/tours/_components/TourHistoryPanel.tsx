"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог туров — «История изменений» тура (только owner)
 * app/(dashboard)/partner/castings/tours/_components/TourHistoryPanel.tsx
 *
 * Читает append-only audit_logs через RPC voyage_owner_catalog_tour_history:
 * кто менял условия (с ролью на момент правки), что было и что стало,
 * назначения, отзывы, передачи кастингов. Текст заметки владельца в
 * журнал не пишется — только факт правки и длина.
 * ──────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, LoaderCircle } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { listCatalogTourHistory } from "@/app/actions/tour-catalog-managers";
import type { TourHistoryEntry } from "@/lib/tour-catalog";
import { TOUR_MANAGERS_COPY, formatDateTime } from "@/app/(dashboard)/partner/castings/tours/_components/tourManagersCopy";

function show(value: unknown, lang: Lang, empty: string): string {
  if (value === null || value === undefined || value === "") return empty;
  if (Array.isArray(value)) return value.length ? value.join(", ") : empty;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const pick = o[lang] ?? o.RU ?? o.EN ?? Object.values(o)[0];
    const text = typeof pick === "string" ? pick : JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text || empty;
  }
  return String(value);
}

export function TourHistoryPanel({ tourId, lang }: { tourId: string; lang: Lang }) {
  const t = TOUR_MANAGERS_COPY[lang] ?? TOUR_MANAGERS_COPY.EN;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<TourHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && entries === null) {
      setLoading(true);
      const res = await listCatalogTourHistory(tourId);
      setLoading(false);
      if (res.ok) setEntries(res.entries);
      else setError(t.errors[res.reason]);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/20 p-4">
      <button type="button" onClick={() => void toggle()} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-300">
          <History size={13} className="text-amber-200/80" /> {t.historyTitle}
        </span>
        {loading ? <LoaderCircle size={14} className="animate-spin text-zinc-500" /> : <span className="text-xs text-zinc-500">{open ? "−" : "+"}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {error && <p className="mt-3 text-xs text-rose-200">{error}</p>}
            {entries && entries.length === 0 && <p className="mt-3 text-xs text-zinc-500">{t.historyEmpty}</p>}
            <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {(entries ?? []).map((e) => {
                const fields = Object.entries(e.changes);
                const meta = e.metadata;
                const who = [e.actorName, e.actorRole ? t.roles[e.actorRole] ?? e.actorRole : null].filter(Boolean).join(" · ");
                return (
                  <li key={e.id} className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 px-3 py-2">
                    <p className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-200">{t.actions[e.action] ?? e.action}</span>
                      <span className="text-[11px] text-zinc-500">{formatDateTime(e.at, lang)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {who || "—"}
                      {meta.source === "cascade" ? ` · ${t.cascade}` : ""}
                      {typeof meta.manager_name === "string" ? ` · ${meta.manager_name}` : ""}
                      {typeof meta.reason === "string" && meta.reason ? ` · «${meta.reason}»` : ""}
                    </p>
                    {fields.length > 0 && e.action === "tour_catalog.update" && (
                      <ul className="mt-1.5 space-y-0.5 text-[11px] leading-5">
                        {fields.map(([key, diff]) => (
                          <li key={key} className="text-zinc-400">
                            <span className="text-zinc-500">{t.fields[key] ?? key}: </span>
                            <span className="text-rose-200/70 line-through decoration-rose-300/40">{show(diff?.old, lang, t.empty)}</span>
                            {" → "}
                            <span className="text-emerald-100/90">{show(diff?.new, lang, t.empty)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
