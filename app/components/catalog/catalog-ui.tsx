/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог — мелкие общие элементы (этап 2)
 * app/components/catalog/catalog-ui.tsx
 * Без хуков: подходят и для резидентки, и для менеджера.
 * ──────────────────────────────────────────────────────────────────── */

import { CalendarX2, Clapperboard, Languages } from "lucide-react";
import { VipSeal } from "@/app/components/profile/VipBadge";
import { fmtRange, type BusyRange, type CatalogCopy, type Freshness } from "@/lib/resident-catalog";

const FRESH_TONE: Record<Freshness, string> = {
  fresh: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  aging: "border-amber-200/30 bg-amber-200/10 text-amber-100",
  stale: "border-zinc-600/60 bg-zinc-800/60 text-zinc-300",
  none: "border-zinc-700/60 bg-zinc-900/60 text-zinc-500",
};

export function FreshnessChip({ value, c }: { value: Freshness; c: CatalogCopy }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${FRESH_TONE[value]}`}>
      <Clapperboard size={10} aria-hidden /> {c.freshness[value]}
    </span>
  );
}

export function KycChip({ level }: { level: number }) {
  const lvl = Math.max(0, Math.min(3, level));
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#c9a961]/30 bg-[#c9a961]/10 px-2 py-0.5 text-[10px] text-amber-100">
      {lvl >= 3 && <VipSeal className="h-3 w-3" glow={false} />} KYC {lvl}
    </span>
  );
}

export function LanguagesLine({ languages }: { languages: string[] }) {
  if (!languages.length) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
      <Languages size={11} aria-hidden /> {languages.join(" · ")}
    </span>
  );
}

export function BusyLine({ busy, lang, c }: { busy: BusyRange[]; lang: string; c: CatalogCopy }) {
  if (!busy.length) return <span className="text-[11px] text-emerald-200/80">{c.free}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px] text-zinc-400">
      <CalendarX2 size={11} aria-hidden /> {c.busy}: {busy.map((b) => fmtRange(b.from, b.to, lang)).join(", ")}
    </span>
  );
}

export const FIELD =
  "min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#c9a961]/60";
export const GOLD_BTN =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#c9a961]/60 bg-[#c9a961] px-4 text-xs font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:pointer-events-none disabled:opacity-50";
export const GHOST_BTN =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-4 text-xs text-zinc-200 transition hover:border-[#c9a961]/50 hover:text-amber-100 disabled:pointer-events-none disabled:opacity-50";
