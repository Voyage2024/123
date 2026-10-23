"use client";

import { Skeleton, cx, inputClass } from "@/app/bunker/_components/ui";
import { CURRENCIES } from "@/lib/bunker/types";

/* Общие мелочи вкладок «Финансов»: приходы, долги, инвестиции. */

/** numeric из Postgres приходит строкой — приводим к числу. */
export const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;

/** Порядок валют как в справочнике (USD, EUR, RUB…): суммы в разных валютах между собой не сравниваем. */
export const currencyRank = (c: string) => {
  const i = (CURRENCIES as readonly string[]).indexOf(c);
  return i < 0 ? CURRENCIES.length : i;
};

/** «1 200,50» → 1200.5; пусто или мусор → NaN. */
export const parseAmount = (s: string) => (s.trim() ? Number(s.replace(",", ".").replace(/\s/g, "")) : NaN);

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={cx("truncate font-medium tabular-nums", accent ? "text-[#e9d7a8]" : "text-zinc-200")}>{value}</p>
    </div>
  );
}

export function CurrencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, "w-28 [color-scheme:dark]")}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-36" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  );
}
