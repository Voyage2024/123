"use client";

/* Список туров модуля: менеджер — свои, owner — все, оператор — туры, куда
 * его привязали (без оборота). Данные — voyage_tour_ops_list / voyage_operator_home. */

import Link from "next/link";
import { AlertTriangle, CalendarClock, Headset, Users } from "lucide-react";
import { Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import type { TourListItem } from "@/lib/tour-ops/types";
import type { OpsDict } from "@/lib/tour-ops/i18n";
import { fmtDay, fmtMoney, type UiLang } from "@/lib/tour-ops/time";

export default function TourOpsList({
  tours,
  t,
  lang,
  hrefFor,
  emptyText,
  showManager = false,
}: {
  tours: TourListItem[];
  t: OpsDict;
  lang: UiLang;
  hrefFor: (id: string) => string;
  emptyText: string;
  showManager?: boolean;
}) {
  if (tours.length === 0) return <p className="text-sm text-zinc-500">{emptyText}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tours.map((tour) => (
        <Link key={tour.id} href={hrefFor(tour.id)} className="group block">
          <Panel className="h-full p-4 transition-colors group-hover:border-amber-200/30">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg text-zinc-50">{tour.city}</p>
                <p className="mt-0.5 text-[12px] text-zinc-500">
                  {fmtDay(tour.departsAt, tour.timezone, lang)}
                  {tour.returnsAt ? ` — ${fmtDay(tour.returnsAt, tour.timezone, lang)}` : ""} · {t.tourStatus[tour.status] ?? tour.status}
                </p>
                {showManager && <p className="mt-0.5 text-[12px] text-zinc-400">{t.list.manager}: {tour.managerName}</p>}
              </div>
              <CalendarClock className="size-4 shrink-0 text-amber-200/60" aria-hidden />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-zinc-400">
              <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {tour.models} {t.list.models}</span>
              {tour.operators !== null && <span className="inline-flex items-center gap-1"><Headset className="size-3.5" /> {tour.operators} {t.list.operators}</span>}
              <span>{tour.bookingsOpen} {t.list.open}</span>
              <span>{tour.bookingsToday} {t.list.today}</span>
              {tour.revenue !== null && <span className="text-zinc-200">{t.list.revenue}: {fmtMoney(tour.revenue, tour.currency, lang)}</span>}
            </div>
            {!tour.hasSettings && tour.access !== "operator" && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-amber-200/80"><AlertTriangle className="size-3.5" /> {t.list.needsSettings}</p>
            )}
            <p className="mt-3 text-[12px] text-amber-200/80 group-hover:underline">{t.list.openBoard} →</p>
          </Panel>
        </Link>
      ))}
    </div>
  );
}
