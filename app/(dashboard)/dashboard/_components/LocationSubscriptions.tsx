"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · подписки на локации карты — резидентка выбирает города
 * app/(dashboard)/dashboard/_components/LocationSubscriptions.tsx
 *
 * Активные локации /admin/map-locations: регион → страна → город.
 * Колокольчик = подписка: новый тур или открытый кастинг в этом городе
 * придёт в ленту локаций и в Telegram (тумблер «Мои локации» в настройках).
 * Миграция 20261106090000_map_hub_subscriptions.sql.
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, LoaderCircle, MapPin, Plane, Search, Sparkles } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { countryFlag, countryName } from "@/lib/countries";
import { pickText, setHubSubscription, useHubDirectory, type HubEntry, type SubscriptionFailure } from "@/lib/map-subscriptions";

type RegionFilter = "all" | "mine" | "mena" | "europe" | "americas" | "apac";

type Copy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  search: string;
  filters: Record<RegionFilter, string>;
  regions: Record<string, string>;
  subscribe: string;
  subscribed: string;
  unsubscribe: string;
  subscribedCount: (n: number) => string;
  tour: string;
  castings: (n: number) => string;
  noCountry: string;
  empty: string;
  emptyMine: string;
  loadError: string;
  errors: Record<SubscriptionFailure, string>;
  settings: string;
};

const T: Record<Lang, Copy> = {
  RU: {
    eyebrow: "Мои локации",
    title: "Подписки на города",
    subtitle:
      "Нажмите на колокольчик у города — когда там появится новый тур или откроется кастинг, вы первой узнаете условия: в ленте ниже и в Telegram.",
    search: "Город или страна…",
    filters: { all: "Все", mine: "Мои", mena: "MENA", europe: "Европа", americas: "Америка", apac: "АТР" },
    regions: { mena: "Ближний Восток", europe: "Европа", americas: "Америка", apac: "Азия и Тихий океан" },
    subscribe: "Подписаться",
    subscribed: "Вы подписаны",
    unsubscribe: "Отписаться",
    subscribedCount: (n) => (n === 0 ? "Пока нет подписок" : `Подписок: ${n}`),
    tour: "Тур открыт",
    castings: (n) => `Кастингов: ${n}`,
    noCountry: "Страна уточняется",
    empty: "Под этот фильтр локаций нет.",
    emptyMine: "Вы ещё не подписаны ни на один город.",
    loadError: "Не удалось загрузить локации. Обновите страницу.",
    errors: {
      inactive: "Локация закрыта — подписаться нельзя.",
      limit: "Максимум 50 подписок. Отпишитесь от лишних городов.",
      residents_only: "Подписки доступны только резиденткам.",
      schema: "Модуль подписок ещё не включён в базе.",
      network: "Не получилось сохранить. Попробуйте ещё раз.",
    },
    settings: "Telegram-оповещения",
  },
  EN: {
    eyebrow: "My locations",
    title: "City subscriptions",
    subtitle:
      "Tap the bell next to a city — when a new tour appears there or a casting opens, you’ll be the first to see the terms: in the feed below and in Telegram.",
    search: "City or country…",
    filters: { all: "All", mine: "Mine", mena: "MENA", europe: "Europe", americas: "Americas", apac: "APAC" },
    regions: { mena: "Middle East", europe: "Europe", americas: "The Americas", apac: "Asia Pacific" },
    subscribe: "Subscribe",
    subscribed: "Subscribed",
    unsubscribe: "Unsubscribe",
    subscribedCount: (n) => (n === 0 ? "No subscriptions yet" : `Subscriptions: ${n}`),
    tour: "Tour open",
    castings: (n) => `Castings: ${n}`,
    noCountry: "Country pending",
    empty: "No locations match this filter.",
    emptyMine: "You haven’t subscribed to any city yet.",
    loadError: "Could not load locations. Please refresh.",
    errors: {
      inactive: "This location is closed — you can’t subscribe.",
      limit: "50 subscriptions max. Remove some cities first.",
      residents_only: "Subscriptions are for residents only.",
      schema: "The subscriptions module isn’t enabled in the database yet.",
      network: "Could not save. Please try again.",
    },
    settings: "Telegram notifications",
  },
  ES: {
    eyebrow: "Mis ubicaciones",
    title: "Suscripciones a ciudades",
    subtitle:
      "Toca la campana junto a una ciudad: cuando aparezca un tour nuevo o se abra un casting, verás las condiciones primero, en el feed de abajo y en Telegram.",
    search: "Ciudad o país…",
    filters: { all: "Todas", mine: "Mías", mena: "MENA", europe: "Europa", americas: "Américas", apac: "APAC" },
    regions: { mena: "Oriente Medio", europe: "Europa", americas: "Américas", apac: "Asia-Pacífico" },
    subscribe: "Suscribirme",
    subscribed: "Suscrita",
    unsubscribe: "Cancelar suscripción",
    subscribedCount: (n) => (n === 0 ? "Aún no hay suscripciones" : `Suscripciones: ${n}`),
    tour: "Tour abierto",
    castings: (n) => `Castings: ${n}`,
    noCountry: "País por confirmar",
    empty: "No hay ubicaciones con este filtro.",
    emptyMine: "Aún no te has suscrito a ninguna ciudad.",
    loadError: "No se pudieron cargar las ubicaciones. Actualiza la página.",
    errors: {
      inactive: "La ubicación está cerrada: no es posible suscribirse.",
      limit: "Máximo 50 suscripciones. Quita alguna ciudad.",
      residents_only: "Las suscripciones son solo para residentes.",
      schema: "El módulo de suscripciones aún no está activo en la base.",
      network: "No se pudo guardar. Inténtalo de nuevo.",
    },
    settings: "Avisos de Telegram",
  },
  PT: {
    eyebrow: "Minhas localizações",
    title: "Assinaturas de cidades",
    subtitle:
      "Toque no sino ao lado da cidade: quando surgir um tour novo ou abrir um casting, você verá as condições primeiro, no feed abaixo e no Telegram.",
    search: "Cidade ou país…",
    filters: { all: "Todas", mine: "Minhas", mena: "MENA", europe: "Europa", americas: "Américas", apac: "APAC" },
    regions: { mena: "Oriente Médio", europe: "Europa", americas: "Américas", apac: "Ásia-Pacífico" },
    subscribe: "Assinar",
    subscribed: "Assinado",
    unsubscribe: "Cancelar assinatura",
    subscribedCount: (n) => (n === 0 ? "Nenhuma assinatura ainda" : `Assinaturas: ${n}`),
    tour: "Tour aberto",
    castings: (n) => `Castings: ${n}`,
    noCountry: "País a confirmar",
    empty: "Nenhuma localização neste filtro.",
    emptyMine: "Você ainda não assinou nenhuma cidade.",
    loadError: "Não foi possível carregar as localizações. Atualize a página.",
    errors: {
      inactive: "A localização está fechada — não dá para assinar.",
      limit: "No máximo 50 assinaturas. Remova algumas cidades.",
      residents_only: "Assinaturas são só para residentes.",
      schema: "O módulo de assinaturas ainda não está ativo no banco.",
      network: "Não foi possível salvar. Tente novamente.",
    },
    settings: "Avisos no Telegram",
  },
};

const REGION_ORDER = ["europe", "mena", "apac", "americas"];
const regionRank = (region: string) => {
  const i = REGION_ORDER.indexOf(region);
  return i === -1 ? REGION_ORDER.length : i;
};

export default function LocationSubscriptions() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.RU;
  const directory = useHubDirectory();
  const [filter, setFilter] = useState<RegionFilter>("all");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hubName = (hub: HubEntry) => pickText(hub.name, lang, hub.id);
  const mineCount = directory.data.filter((h) => h.subscribed).length;

  /** регион → страна → города */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = directory.data.filter((hub) => {
      if (filter === "mine" && !hub.subscribed) return false;
      if (filter !== "all" && filter !== "mine" && hub.region !== filter) return false;
      if (!q) return true;
      const hay = [hubName(hub), ...Object.values(hub.name), countryName(hub.countryCode, lang), hub.countryCode ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    const byRegion = new Map<string, Map<string, HubEntry[]>>();
    for (const hub of visible) {
      const region = byRegion.get(hub.region) ?? new Map<string, HubEntry[]>();
      const key = hub.countryCode ?? "";
      region.set(key, [...(region.get(key) ?? []), hub]);
      byRegion.set(hub.region, region);
    }
    return [...byRegion.entries()]
      .sort(([a], [b]) => regionRank(a) - regionRank(b))
      .map(([region, countries]) => ({
        region,
        countries: [...countries.entries()]
          .map(([code, hubs]) => ({
            code,
            name: code ? countryName(code, lang) : t.noCountry,
            hubs: hubs.sort((a, b) => hubName(a).localeCompare(hubName(b))),
          }))
          .sort((a, b) => (a.code ? 0 : 1) - (b.code ? 0 : 1) || a.name.localeCompare(b.name)),
      }));
    // hubName зависит только от lang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory.data, filter, query, lang, t.noCountry]);

  const toggle = async (hub: HubEntry) => {
    if (pending) return;
    setPending(hub.id);
    setError(null);
    const next = !hub.subscribed;
    directory.setData((prev) => prev.map((h) => (h.id === hub.id ? { ...h, subscribed: next } : h)));
    const res = await setHubSubscription(hub.id, next);
    if (!res.ok) {
      directory.setData((prev) => prev.map((h) => (h.id === hub.id ? { ...h, subscribed: hub.subscribed } : h)));
      setError(t.errors[res.reason]);
    } else if (res.subscribed !== next) {
      directory.setData((prev) => prev.map((h) => (h.id === hub.id ? { ...h, subscribed: res.subscribed } : h)));
    }
    setPending(null);
  };

  return (
    <section id="locations" className="mt-10 scroll-mt-24 rounded-3xl border border-white/[0.07] bg-zinc-950/60 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-[#c9a961]/80">
            <BellRing size={12} /> {t.eyebrow}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-light tracking-tight text-zinc-50">{t.title}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{t.subtitle}</p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className="rounded-full border border-[#c9a961]/25 bg-[#c9a961]/[0.06] px-3 py-1 text-[11px] text-[#e6d3a3]">
            {t.subscribedCount(mineCount)}
          </span>
          <Link href="/dashboard/settings" className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 transition hover:text-[#e6d3a3]">
            {t.settings}
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
          {(Object.keys(t.filters) as RegionFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] transition ${
                filter === key
                  ? "border-[#c9a961]/50 bg-[#c9a961]/15 text-[#f1e3bd]"
                  : "border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              }`}
            >
              {t.filters[key]}
              {key === "mine" && mineCount > 0 ? ` · ${mineCount}` : ""}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="min-h-10 w-full rounded-full border border-white/[0.08] bg-zinc-900/60 pl-9 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#c9a961]/40 focus:outline-none"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-2.5 text-xs text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-7">
        {directory.loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-zinc-900/60" />
            ))}
          </div>
        ) : directory.error ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">{t.loadError}</p>
        ) : groups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
            {filter === "mine" ? t.emptyMine : t.empty}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.region || "other"}>
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.regions[group.region] ?? group.region.toUpperCase()}</p>
              <div className="mt-3 space-y-4">
                {group.countries.map((country) => (
                  <div key={country.code || "none"}>
                    <p className="flex items-center gap-2 text-sm text-zinc-200">
                      <span aria-hidden className="text-base leading-none">{countryFlag(country.code) || "🌐"}</span>
                      {country.name}
                    </p>
                    <ul className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {country.hubs.map((hub) => {
                        const busy = pending === hub.id;
                        const subtitle = pickText(hub.subtitle, lang);
                        return (
                          <li
                            key={hub.id}
                            className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${
                              hub.subscribed ? "border-[#c9a961]/35 bg-[#c9a961]/[0.05]" : "border-white/[0.06] bg-zinc-900/30"
                            }`}
                          >
                            <MapPin size={16} className={hub.subscribed ? "shrink-0 text-[#c9a961]" : "shrink-0 text-zinc-600"} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-zinc-100">{hubName(hub)}</p>
                              {subtitle && <p className="truncate text-[11px] text-zinc-500">{subtitle}</p>}
                              {(hub.tourId || hub.openCastings > 0) && (
                                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[#e6d3a3]/80">
                                  {hub.tourId && (
                                    <span className="inline-flex items-center gap-1">
                                      <Plane size={10} /> {t.tour}
                                    </span>
                                  )}
                                  {hub.openCastings > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <Sparkles size={10} /> {t.castings(hub.openCastings)}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => void toggle(hub)}
                              disabled={busy}
                              aria-pressed={hub.subscribed}
                              aria-label={`${hub.subscribed ? t.unsubscribe : t.subscribe}: ${hubName(hub)}`}
                              title={hub.subscribed ? t.unsubscribe : t.subscribe}
                              className={`flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-[10px] uppercase tracking-[0.14em] transition disabled:opacity-60 ${
                                hub.subscribed
                                  ? "border-[#c9a961]/50 bg-[#c9a961]/15 text-[#f1e3bd] hover:bg-[#c9a961]/25"
                                  : "border-white/10 text-zinc-400 hover:border-[#c9a961]/40 hover:text-[#e6d3a3]"
                              }`}
                            >
                              {busy ? (
                                <LoaderCircle size={14} className="animate-spin" />
                              ) : hub.subscribed ? (
                                <BellRing size={14} />
                              ) : (
                                <Bell size={14} />
                              )}
                              <span className="hidden sm:inline">{hub.subscribed ? t.subscribed : t.subscribe}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
