"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · кабинет менеджера — «Мои направления»
 * app/(dashboard)/partner/castings/tours/_components/MyDirections.tsx
 *
 * Только туры с активным назначением (RPC voyage_my_catalog_tours,
 * миграция 20261125090000). Внутри: условия, ответственные, кастинги по
 * туру (свои — со ссылкой, чужие — только даты и статус), правка условий
 * и «Создать кастинг». Заметок владельца и внутренних полей здесь нет —
 * RPC их не отдаёт.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, CalendarDays, EyeOff, MapPinned, Pencil, Plus, ShieldAlert, Users } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { listMyCatalogTours } from "@/app/actions/tour-catalog";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { projectLabels } from "@/lib/project-types";
import { pickI18n } from "@/lib/casting-i18n";
import { MAP_HUB_REGIONS, type CatalogTour, type MyCatalogTour } from "@/lib/tour-catalog";
import { countryFlag, countryName } from "@/lib/countries";
import { TOUR_MANAGERS_COPY, formatDay } from "@/app/(dashboard)/partner/castings/tours/_components/tourManagersCopy";

export function MyDirections({
  lang,
  reloadKey,
  audiences,
  feeLabel,
  feeOpen,
  requirementsLabel,
  conditionsLabel,
  hiddenLabel,
  onEdit,
}: {
  lang: Lang;
  /** Меняется после сохранения тура — перечитать список */
  reloadKey: number;
  audiences: Record<CatalogTour["audience"], string>;
  feeLabel: string;
  feeOpen: string;
  requirementsLabel: string;
  conditionsLabel: string;
  hiddenLabel: string;
  onEdit: (tour: MyCatalogTour) => void;
}) {
  const t = TOUR_MANAGERS_COPY[lang] ?? TOUR_MANAGERS_COPY.EN;
  const [tours, setTours] = useState<MyCatalogTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const projects = projectLabels(lang);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMyCatalogTours();
    setLoading(false);
    if (!res.ok) {
      setError(res.reason === "schema" ? t.errors.schema : t.errors.failed);
      return;
    }
    setError(null);
    setTours(res.tours);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl text-zinc-50">{t.myTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">{t.mySubtitle}</p>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {loading ? (
        <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-sm text-zinc-500">…</div>
      ) : tours.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{t.myEmpty}</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {tours.map((tour, index) => {
            const title = pickI18n(tour.title, lang, tour.sourceLang) ?? tour.city;
            const description = pickI18n(tour.description, lang, tour.sourceLang);
            const requirements = pickI18n(tour.requirements, lang, tour.sourceLang);
            const conditions = pickI18n(tour.conditions, lang, tour.sourceLang);
            return (
              <motion.li
                key={tour.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 6) * 0.04 }}
                className={`flex flex-col rounded-2xl border bg-zinc-900/40 p-5 backdrop-blur-sm transition hover:border-amber-200/20 ${tour.isActive ? "border-zinc-800/80" : "border-zinc-800/50 opacity-80"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                      {projects[tour.project]} · <MapPinned size={10} className="-mt-0.5 inline" /> {tour.city}
                      {tour.countryCode ? ` · ${countryFlag(tour.countryCode)} ${countryName(tour.countryCode, lang)}` : ""}
                      {tour.region ? ` · ${MAP_HUB_REGIONS[tour.region] ?? tour.region}` : ""} · {audiences[tour.audience]}
                    </p>
                    <h3 className="mt-1 font-serif text-2xl text-zinc-50">{title}</h3>
                  </div>
                  {!tour.isActive && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                      <EyeOff size={11} /> {hiddenLabel}
                    </span>
                  )}
                </div>

                {description && <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-zinc-300">{description}</p>}
                {requirements && (
                  <p className="mt-3 text-xs leading-5 text-zinc-400">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{requirementsLabel}: </span>
                    {requirements}
                  </p>
                )}
                {conditions && (
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{conditionsLabel}: </span>
                    {conditions}
                  </p>
                )}
                <p className="mt-3 text-xs text-zinc-500">
                  {feeLabel}: {tour.feeAmount !== null && tour.feeCurrency ? `${tour.feeAmount} ${tour.feeCurrency}` : feeOpen}
                  {tour.heightMin ? ` · ${tour.heightMin}+ cm` : ""}
                  {tour.languages.length ? ` · ${tour.languages.join(" · ")}` : ""}
                </p>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t.coManagers}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {tour.coManagers.map((m, i) => (
                      <li
                        key={`${m.name}-${i}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${m.isMe ? "border-amber-200/40 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-300"}`}
                      >
                        {m.isSystem ? <Building2 size={11} /> : <Users size={11} />} {m.name}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t.castings}</p>
                  {tour.castings.length === 0 ? (
                    <p className="mt-1.5 text-xs text-zinc-500">{t.noCastings}</p>
                  ) : (
                    <ul className="mt-1.5 space-y-1">
                      {tour.castings.slice(0, 8).map((c) => {
                        const dates = c.startsOn === c.endsOn ? c.startsOn : `${c.startsOn} → ${c.endsOn}`;
                        const body = (
                          <>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays size={12} className="text-zinc-500" /> {dates}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                              {t.statuses[c.status] ?? c.status}
                              {c.isMine ? ` · ${t.mine}` : ` · ${c.organizer}`}
                            </span>
                          </>
                        );
                        return (
                          <li key={c.id}>
                            {c.isMine ? (
                              <Link
                                href={ROUTES.casting(c.id)}
                                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-amber-200/30 hover:text-amber-100"
                              >
                                {body}
                              </Link>
                            ) : (
                              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/60 px-2.5 py-1.5 text-xs text-zinc-400">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                  {tour.isActive && (
                    <Link
                      href={`${ROUTES.newCasting}?tour=${encodeURIComponent(tour.id)}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-200/40 bg-amber-200 px-4 text-xs font-semibold text-zinc-950 transition hover:bg-amber-100"
                    >
                      <Plus size={14} /> {t.createCasting}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => onEdit(tour)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-zinc-800 px-4 text-xs text-zinc-300 transition hover:border-amber-200/25 hover:text-amber-100"
                  >
                    <Pencil size={13} /> {t.editTerms}
                  </button>
                  {tour.updatedAt && <span className="ml-auto text-[11px] text-zinc-600">{t.updated(formatDay(tour.updatedAt, lang))}</span>}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
