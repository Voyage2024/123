"use client";

/* VOYAGE · «Опубликовать от имени» — выбор организатора тура / ивента.
 * Список отдаёт RPC voyage_list_publishers() (только owner/admin):
 * VOYAGE Management первым, затем действующие партнёры-менеджеры. */

import { useEffect, useState } from "react";
import { BadgeCheck, Building2, ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ORGANIZER_TEXT,
  VOYAGE_MANAGEMENT_ID,
  VOYAGE_MANAGEMENT_NAME,
  parsePublishers,
  type OrganizerLang,
  type Publisher,
} from "@/lib/organizer";

const FALLBACK: Publisher[] = [
  { id: VOYAGE_MANAGEMENT_ID, name: VOYAGE_MANAGEMENT_NAME, role: "manager", badge: "official_club", isSystem: true },
];

export function usePublishers(enabled = true) {
  const [publishers, setPublishers] = useState<Publisher[]>(FALLBACK);
  const [loading, setLoading] = useState(enabled);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let alive = true;
    void (async () => {
      const { data, error } = await supabase.rpc("voyage_list_publishers");
      if (!alive) return;
      const list = parsePublishers(data);
      if (error || list.length === 0) {
        setFailed(Boolean(error));
        setPublishers(FALLBACK);
      } else {
        setPublishers(list);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  return { publishers, loading, failed };
}

export function OrganizerBadgePill({ badge, lang, className = "" }: { badge: Publisher["badge"]; lang: OrganizerLang; className?: string }) {
  if (!badge) return null;
  const t = ORGANIZER_TEXT[lang];
  const official = badge === "official_club";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
        official ? "border-amber-200/35 bg-amber-200/10 text-amber-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
      } ${className}`}
    >
      <BadgeCheck className="size-3" aria-hidden />
      {official ? t.official : t.verified}
    </span>
  );
}

export default function OrganizerSelect({
  value,
  onChange,
  lang,
  disabled = false,
  id = "organizer-select",
}: {
  value: string;
  onChange: (id: string) => void;
  lang: OrganizerLang;
  disabled?: boolean;
  id?: string;
}) {
  const t = ORGANIZER_TEXT[lang];
  const { publishers, loading, failed } = usePublishers(true);
  const known = publishers.some((p) => p.id === value);
  const options = known || !value ? publishers : [...publishers, { id: value, name: value.slice(0, 8), role: "manager", badge: null, isSystem: false }];
  const selected = options.find((p) => p.id === (value || VOYAGE_MANAGEMENT_ID));

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 text-xs font-medium text-zinc-300">
        <Building2 className="size-3.5 text-amber-200/70" aria-hidden />
        {t.label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value || VOYAGE_MANAGEMENT_ID}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || loading}
          className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 pr-9 text-sm text-zinc-100 outline-none transition focus:border-amber-200/40 disabled:opacity-60"
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.isSystem ? `${p.name} · ${t.official}` : `${p.name} · ${p.badge === "verified" ? t.verified : t.partner}`}
            </option>
          ))}
        </select>
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-500" aria-hidden />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" aria-hidden />
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {selected && <OrganizerBadgePill badge={selected.badge} lang={lang} />}
        <p className="text-[11px] leading-4 text-zinc-500">{loading ? t.loading : failed ? t.loadError : t.hint}</p>
      </div>
    </div>
  );
}
