"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — общие детали страниц пульта
 * app/(dashboard)/partner/_components/PartnerUI.tsx
 *
 * Тот же язык, что у Штаба: zinc-950, тонкие бордеры zinc-800,
 * золото amber-200 / amber-500, стекло с backdrop-blur, заголовки
 * Cormorant Garamond. Здесь — атомы для Кастингов, Манифеста, Пульса,
 * Blacklist и Ключей; Штаб пока держит свои копии.
 *
 *   PageShell    фон, свечение, поля страницы
 *   PageHeader   надзаголовок · заголовок · подзаголовок · кнопки
 *   StatStrip    плитки с цифрами
 *   FilterTabs   сегменты-фильтры со счётчиками
 *   SearchField  поиск с кнопкой очистки
 *   Panel, SectionHeader, Pill, Meter, EmptyFilter
 * ──────────────────────────────────────────────────────────────────── */

import type { ReactNode } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { Search, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import type { KeyTier } from "../_lib/command";

export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600"],
});

/* ── токены ────────────────────────────────────────────────────────── */

export type Tone = "gold" | "emerald" | "amber" | "rose" | "zinc";

export const PILL: Record<Tone, string> = {
  gold: "border-amber-200/30 bg-amber-200/10 text-amber-100",
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  rose: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  zinc: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
};
export const ICON_RING: Record<Tone, string> = {
  gold: "border-amber-200/25 bg-amber-200/10 text-amber-200",
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  zinc: "border-zinc-700 bg-zinc-800 text-zinc-300",
};
/** Цвет левой кромки строки — статус виден боковым зрением */
export const EDGE: Record<Tone, string> = {
  gold: "before:bg-amber-200/70",
  emerald: "before:bg-emerald-400/70",
  amber: "before:bg-amber-400/80",
  rose: "before:bg-rose-400",
  zinc: "before:bg-zinc-700",
};

export const TIER_LABEL: Record<KeyTier, string> = { silver: "Silver Key", gold: "Gold Key", platinum: "Platinum Key" };
export const TIER_TEXT: Record<KeyTier, string> = {
  silver: "from-zinc-100 via-zinc-300 to-zinc-500",
  gold: "from-amber-100 via-amber-200 to-amber-500",
  platinum: "from-zinc-50 via-sky-100 to-zinc-300",
};

export const BTN_GOLD =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-200 px-4 text-xs font-medium tracking-wide text-zinc-950 shadow-[0_0_24px_-8px_rgba(253,230,138,0.6)] transition hover:bg-amber-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:min-h-9";
export const BTN_GHOST =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-4 text-xs tracking-wide text-zinc-200 transition hover:border-amber-200/40 hover:text-amber-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 sm:min-h-9";
export const LINK_SUBTLE =
  "inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-amber-200 sm:min-h-0";
/** Прозрачная ссылка-подложка на всю карточку: внутренние ссылки ставим поверх (z-[2]) */
export const OVERLAY_LINK =
  "absolute inset-0 z-[1] rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200/60";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* ── каркас страницы ───────────────────────────────────────────────── */

function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-48 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-amber-500/[0.07] blur-[120px]" />
      <div className="absolute -right-40 top-[38rem] h-96 w-96 rounded-full bg-amber-200/[0.04] blur-[100px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_60%)]" />
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-full overflow-x-clip bg-zinc-950 text-zinc-100">
      <Ambient />
      <div className="mx-auto w-full max-w-[90rem] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pt-10 lg:px-10">
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  demo,
  demoHint,
  actions,
  aside,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Подпись «Демо-данные» рядом с надзаголовком */
  demo?: string;
  demoHint?: string;
  actions?: ReactNode;
  /** Правая колонка шапки: статус, карточка ранга и т. п. */
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end gap-x-10 gap-y-6">
      <div className="min-w-0 flex-[1_1_28rem]">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-amber-200/70">
            <span aria-hidden className="h-px w-8 bg-gradient-to-r from-amber-200/0 to-amber-200/60" />
            {eyebrow}
          </p>
          {demo && (
            <span
              title={demoHint}
              className="rounded-full border border-zinc-700/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-zinc-500"
            >
              {demo}
            </span>
          )}
        </div>
        <h1 className={`${cormorant.className} mt-4 text-[2.5rem] font-medium leading-[1.05] text-zinc-50 md:text-[3.5rem]`}>
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{subtitle}</p>
        {actions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {aside && <div className="flex min-w-0 flex-[1_1_22rem] flex-wrap justify-start gap-3 lg:justify-end">{aside}</div>}
    </header>
  );
}

/* ── блоки ─────────────────────────────────────────────────────────── */

export function Panel({
  as: Tag = "section",
  className = "",
  children,
  label,
}: {
  as?: "section" | "div" | "article" | "aside";
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <Tag
      aria-label={label}
      className={`relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  icon: Icon,
  count,
  action,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          <Icon className="size-3.5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
          {eyebrow}
        </p>
        <h2 className={`${cormorant.className} mt-1.5 flex items-center gap-2.5 text-2xl font-medium text-zinc-50 md:text-[1.7rem]`}>
          <span className="truncate">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/10 px-1.5 font-sans text-[11px] font-medium text-amber-100">
              {count}
            </span>
          )}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Pill({ tone, icon: Icon, children }: { tone: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${PILL[tone]}`}
    >
      {Icon && <Icon className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />}
      {children}
    </span>
  );
}

export type Stat = { label: string; value: string; icon: LucideIcon; hint?: string; tone?: Tone };

const STAT_ICON: Record<Tone, string> = {
  gold: "text-amber-200/80",
  emerald: "text-emerald-300/80",
  amber: "text-amber-300/80",
  rose: "text-rose-300/80",
  zinc: "text-zinc-600",
};

export function StatStrip({ items }: { items: Stat[] }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon, hint, tone }) => (
        <div
          key={label}
          className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
        >
          <Icon className={`absolute right-3.5 top-3.5 size-4 ${STAT_ICON[tone ?? "zinc"]}`} strokeWidth={1.5} aria-hidden />
          <p className={`${cormorant.className} text-3xl font-medium leading-none text-zinc-50 md:text-4xl`}>{value}</p>
          <p className="mt-2 pr-5 text-[10px] uppercase leading-snug tracking-[0.2em] text-zinc-500">{label}</p>
          {hint && <p className="mt-1 text-[11px] leading-snug text-zinc-500">{hint}</p>}
        </div>
      ))}
    </div>
  );
}

/** Горизонтальная шкала: прогресс к цели (role=progressbar) */
export function Meter({
  value,
  max,
  label,
  tone = "gold",
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  tone?: "gold" | "emerald";
  className?: string;
}) {
  const pct = max > 0 ? clamp(value / max, 0, 1) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={`h-1.5 overflow-hidden rounded-full ${tone === "gold" ? "bg-amber-950/60" : "bg-emerald-950/60"} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ${
          tone === "gold" ? "bg-gradient-to-r from-amber-500 to-amber-200" : "bg-emerald-400/80"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ── фильтры ───────────────────────────────────────────────────────── */

export type FilterItem<K extends string> = { key: K; label: string; count?: number };

/** Сегменты фильтра. На телефоне прокручиваются внутри себя, страница не уезжает вбок */
export function FilterTabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: FilterItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div
        role="group"
        aria-label={label}
        className="inline-flex gap-1 rounded-full border border-zinc-800/80 bg-zinc-900/50 p-1 backdrop-blur-xl"
      >
        {items.map((it) => {
          const active = it.key === value;
          return (
            <button
              key={it.key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(it.key)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-xs transition ${
                active
                  ? "bg-amber-200 font-medium text-zinc-950 shadow-[0_0_18px_-8px_rgba(253,230,138,0.7)]"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              }`}
            >
              {it.label}
              {it.count !== undefined && (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-center text-[10px] font-medium leading-4 ${
                    active ? "bg-zinc-950/15 text-zinc-900" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {it.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  clearLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  clearLabel: string;
}) {
  return (
    <label className="relative flex min-w-0 flex-[1_1_14rem] items-center sm:max-w-xs">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute left-3.5 size-4 text-zinc-500" strokeWidth={1.5} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-11 w-full rounded-full border border-zinc-800/80 bg-zinc-900/50 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 backdrop-blur-xl transition focus:border-amber-200/40 focus:outline-none focus:ring-2 focus:ring-amber-200/20 sm:min-h-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="absolute right-1.5 flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </label>
  );
}

export function EmptyFilter({ text, reset, onReset }: { text: string; reset: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-zinc-800 p-6 sm:flex-row sm:items-center">
      <SlidersHorizontal className="size-5 shrink-0 text-zinc-500" strokeWidth={1.5} aria-hidden />
      <p className="min-w-0 flex-1 text-sm text-zinc-400">{text}</p>
      <button type="button" onClick={onReset} className={BTN_GHOST}>
        {reset}
      </button>
    </div>
  );
}
