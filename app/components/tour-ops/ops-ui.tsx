"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — общие мелочи интерфейса
 * (поля, модалка, копирование, двойное время, язык словаря).
 * Визуально — тот же язык, что PartnerUI (amber-200 на zinc-950).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, X } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { opsDict, type OpsDict } from "@/lib/tour-ops/i18n";
import { fmtDay, fmtTime, tzCity, viewerTimezone, type UiLang } from "@/lib/tour-ops/time";

export function useOps(): { t: OpsDict; lang: UiLang } {
  const { lang } = useLanguage();
  const ui = (["EN", "RU", "ES", "PT"].includes(String(lang)) ? lang : "RU") as UiLang;
  return useMemo(() => ({ t: opsDict(ui), lang: ui }), [ui]);
}

export const INPUT =
  "w-full min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-200/50 focus:ring-1 focus:ring-amber-200/30 sm:min-h-10";
export const LABEL = "mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-zinc-500";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Notice({ tone = "zinc", children }: { tone?: "zinc" | "amber" | "rose" | "emerald"; children: ReactNode }) {
  const map = {
    zinc: "border-zinc-800 bg-zinc-900/50 text-zinc-300",
    amber: "border-amber-300/30 bg-amber-300/[0.06] text-amber-100",
    rose: "border-rose-400/30 bg-rose-400/[0.06] text-rose-100",
    emerald: "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-100",
  } as const;
  return <div role={tone === "rose" ? "alert" : "status"} className={`rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${map[tone]}`}>{children}</div>;
}

export function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-medium text-zinc-50">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-10 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CopyButton({ text, label, copied, className = "" }: { text: string; label: string; copied: string; className?: string }) {
  const [done, setDone] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* буфер обмена недоступен — ничего страшного */
    }
  }, [text]);
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-700/80 px-3 text-[11px] text-zinc-300 transition hover:border-amber-200/40 hover:text-amber-100 ${className}`}
    >
      {done ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      {done ? copied : label}
    </button>
  );
}

/**
 * Двойное время: крупно — пояс тура, мелко — пояс того, кто смотрит
 * (если отличается). Рендер только на клиенте, чтобы не было расхождения
 * гидрации из-за пояса сервера.
 */
export function DualTime({
  start,
  end,
  tourTz,
  viewerTz,
  lang,
  t,
  withDay = false,
  size = "md",
}: {
  start: string;
  end?: string | null;
  tourTz: string;
  viewerTz?: string | null;
  lang: UiLang;
  t: OpsDict;
  withDay?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="text-zinc-600">—</span>;
  const me = viewerTimezone(viewerTz);
  const range = (tz: string) => `${fmtTime(start, tz, lang)}${end ? `–${fmtTime(end, tz, lang)}` : ""}`;
  const big = range(tourTz);
  const small = range(me);
  const same = big === small && fmtDay(start, tourTz, lang) === fmtDay(start, me, lang);
  const bigCls = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className="inline-flex min-w-0 flex-col leading-tight">
      <span className={`${bigCls} font-medium tabular-nums text-zinc-50`}>
        {withDay && <span className="mr-1.5 text-zinc-400">{fmtDay(start, tourTz, lang)},</span>}
        {big}
        <span className="ml-1.5 text-[10px] font-normal uppercase tracking-[0.18em] text-amber-200/70">{tzCity(tourTz)}</span>
      </span>
      {!same && (
        <span className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
          {withDay && `${fmtDay(start, me, lang)}, `}
          {small} · {t.common.yourTime}
        </span>
      )}
    </span>
  );
}

export const STATUS_TONE: Record<string, string> = {
  scheduled: "border-zinc-600/60 bg-zinc-800/40 text-zinc-200",
  en_route: "border-sky-400/40 bg-sky-400/10 text-sky-100",
  in_progress: "border-amber-300/50 bg-amber-300/10 text-amber-100",
  completed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  cancelled: "border-rose-400/30 bg-rose-400/[0.06] text-rose-200/80",
};

export const GUEST_TONE: Record<string, string> = {
  neutral: "border-zinc-700 bg-zinc-800/40 text-zinc-300",
  vip: "border-amber-200/50 bg-amber-200/10 text-amber-100",
  caution: "border-orange-400/50 bg-orange-400/10 text-orange-100",
  blacklist: "border-rose-500/60 bg-rose-500/15 text-rose-100",
};

export function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${className}`}>{children}</span>;
}

export function Tabs<K extends string>({ items, value, onChange }: { items: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          type="button"
          aria-selected={value === it.key}
          onClick={() => onChange(it.key)}
          className={`min-h-10 shrink-0 rounded-full border px-4 text-xs tracking-wide transition ${
            value === it.key ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
