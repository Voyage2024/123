"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · GAMIFICATION — клиентский компонент
 * app/(dashboard)/admin/gamification/GamificationAdminClient.tsx
 *
 * Штамп ставится ПРЯМЫМ клиентским запросом под браузерной сессией
 * админа (Server Action удалён — серверный клиент шёл в базу анонимом
 * и RLS его резал). visit_number по-прежнему считает триггер БД.
 *
 * БЕЗОПАСНОСТЬ: единственный забор на пути этого insert — RLS-политика
 * на game_attendance. Она обязана проверять админ-роль, а не просто
 * `to authenticated`, иначе любой залогиненный резидент сможет
 * наштамповать себе визитов из консоли браузера.
 * ──────────────────────────────────────────────────────────────────── */

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  Check,
  ChevronDown,
  Loader2,
  MapPin,
  Stamp as StampIcon,
  UserRound,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

export type Resident = {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  influence: number;
  rankTitle: string;
  level: number;
};

export type Destination = {
  id: string;
  name: string;
  tag: string | null;
  region: string;
  layer: number;
  visaTier: "free" | "evisa" | "hard";
};

// Контекст направлений — чтобы не прокидывать проп в каждую строку.
const DestinationsCtx = createContext<Destination[]>([]);
function useDestinations() {
  return useContext(DestinationsCtx);
}

const LAYER_LABEL: Record<number, string> = {
  1: "Слой 1 · Starting Saga",
  2: "Слой 2 · Eastern Expansion",
  3: "Слой 3 · Citadels of Wealth",
};

const TIER_DOT: Record<Destination["visaTier"], string> = {
  free: "bg-zinc-500",
  evisa: "bg-[#e6d3a3]/60",
  hard: "bg-[#dfe4ea]/70",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·";
}

/* ── Дропдаун направлений (группировка слой → регион) ────────────── */

function DestinationSelect({
  destinations,
  value,
  onChange,
  disabled,
}: {
  destinations: Destination[];
  value: Destination | null;
  onChange: (d: Destination) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // { [layer]: { [region]: Destination[] } }
  const grouped = useMemo(() => {
    const byLayer = new Map<number, Map<string, Destination[]>>();
    for (const d of destinations) {
      if (!byLayer.has(d.layer)) byLayer.set(d.layer, new Map());
      const byRegion = byLayer.get(d.layer)!;
      if (!byRegion.has(d.region)) byRegion.set(d.region, []);
      byRegion.get(d.region)!.push(d);
    }
    return byLayer;
  }, [destinations]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2.5 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[15rem]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <MapPin size={14} strokeWidth={1.5} className="shrink-0 text-zinc-500" />
          <span className="truncate">
            {value ? value.name : "Выбрать направление"}
          </span>
        </span>
        <ChevronDown
          size={15}
          strokeWidth={1.5}
          className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* клик мимо — закрыть */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 max-h-80 w-72 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-xl">
            {[1, 2, 3].map((layer) => {
              const byRegion = grouped.get(layer);
              if (!byRegion) return null;
              return (
                <div key={layer} className="mb-1 last:mb-0">
                  <p className="px-2.5 pb-1 pt-2 text-[9px] uppercase tracking-[0.25em] text-amber-300/50">
                    {LAYER_LABEL[layer]}
                  </p>
                  {[...byRegion.entries()].map(([region, dests]) => (
                    <div key={region} className="mb-1">
                      <p className="px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                        {region}
                      </p>
                      {dests.map((d) => {
                        const active = value?.id === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              onChange(d);
                              setOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                              active
                                ? "bg-amber-500/10 text-amber-200"
                                : "text-zinc-300 hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[d.visaTier]}`} />
                            <span className="truncate">{d.name}</span>
                            {active && (
                              <Check size={13} strokeWidth={2} className="ml-auto shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Строка резидента ────────────────────────────────────────────── */

function ResidentRow({ resident }: { resident: Resident }) {
  const [selected, setSelected] = useState<Destination | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<
    { kind: "ok"; text: string } | { kind: "err"; text: string } | null
  >(null);

  const destinations = useDestinations();

  async function onStamp() {
    if (!selected || pending) return;
    setToast(null);
    setPending(true);

    // Прямой клиентский insert под сессией админа.
    // visit_number не передаём — его проставит триггер set_visit_number.
    const { data, error } = await supabase
      .from("game_attendance")
      .insert({ profile_id: resident.profileId, destination_id: selected.id })
      .select("visit_number")
      .single();

    if (!error && data) {
      const n = data.visit_number as number;
      const mult = n === 1 ? "база" : n === 2 ? "×1.5" : "×2";
      setToast({
        kind: "ok",
        text: `${selected.name}: ${n}-й визит · ${mult}`,
      });
      setSelected(null);
    } else {
      setToast({
        kind: "err",
        text: error?.message ?? "Не удалось поставить штамп.",
      });
    }

    setPending(false);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-xl transition-colors hover:border-zinc-700/70">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* аватар + имя + статистика */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700/70 bg-zinc-800/60">
            {resident.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resident.avatarUrl}
                alt={resident.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-medium tracking-wide text-zinc-400">
                {initials(resident.fullName)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className={`${cormorant.className} truncate text-xl font-medium text-zinc-100`}>
              {resident.fullName}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
              <span className={`${cormorant.className} italic text-amber-300/80`}>
                {resident.rankTitle}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="font-mono tabular-nums text-zinc-400">
                {resident.influence.toLocaleString("ru-RU")}
                <span className="ml-1 text-zinc-600">influence</span>
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">Level {resident.level}</span>
            </div>
          </div>
        </div>

        {/* дропдаун + кнопка */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <DestinationSelect
            destinations={destinations}
            value={selected}
            onChange={setSelected}
            disabled={pending}
          />
          <button
            type="button"
            disabled={!selected || pending}
            onClick={onStamp}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? (
              <Loader2 size={15} strokeWidth={2} className="animate-spin" />
            ) : (
              <StampIcon size={15} strokeWidth={1.75} />
            )}
            Поставить штамп
          </button>
        </div>
      </div>

      {/* тост-фидбек */}
      {toast && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            toast.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
              : "border-red-500/30 bg-red-950/30 text-red-300"
          }`}
        >
          {toast.kind === "ok" ? (
            <Check size={14} strokeWidth={2} />
          ) : (
            <X size={14} strokeWidth={2} />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </li>
  );
}

/* ── Корневой компонент ──────────────────────────────────────────── */

export default function GamificationAdminClient({
  residents,
  destinations,
}: {
  residents: Resident[];
  destinations: Destination[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [query, residents]);

  return (
    <DestinationsCtx.Provider value={destinations}>
      {/* поиск + счётчик */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <UserRound
            size={15}
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск резидента…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30"
          />
        </div>
        <p className="shrink-0 text-xs text-zinc-600">
          {filtered.length} из {residents.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-16 text-center text-sm text-zinc-500">
          Резиденты не найдены.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <ResidentRow key={r.profileId} resident={r} />
          ))}
        </ul>
      )}
    </DestinationsCtx.Provider>
  );
}
