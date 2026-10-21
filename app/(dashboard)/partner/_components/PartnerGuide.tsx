"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — гид по разделу
 * app/(dashboard)/partner/_components/PartnerGuide.tsx
 *
 * Один компонент для всех страниц пульта: за что отвечает раздел,
 * механика по шагам и словарь статусов и кнопок. Тексты на 4 языках —
 * в ./guides.ts, здесь только вёрстка.
 *
 *   <PartnerGuide page="castings" />
 *
 * Тот же язык, что RulesPanel в Ключах: Panel, SectionHeader, номера
 * шагов Cormorant золотом. Гид сворачивается; выбор запоминается на
 * устройстве отдельно для каждой страницы (localStorage — только
 * удобство: нет доступа к хранилищу — гид просто открыт).
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useId, useState } from "react";
import { ChevronDown, Compass } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { GUIDES, GUIDE_ICONS, GUIDE_UI, type GuidePage } from "@/app/(dashboard)/partner/_components/guides";
import { Panel, SectionHeader, cormorant } from "@/app/(dashboard)/partner/_components/PartnerUI";

const storageKey = (page: GuidePage) => `voyage.partner.guide.${page}`;

export function PartnerGuide({ page, className = "mt-8" }: { page: GuidePage; className?: string }) {
  const { lang } = useLanguage();
  const g = GUIDES[page][lang] ?? GUIDES[page].EN;
  const ui = GUIDE_UI[lang] ?? GUIDE_UI.EN;
  const icons = GUIDE_ICONS[page];
  const bodyId = useId();
  const [open, setOpen] = useState(true);

  // читаем после монтирования — серверная и первая клиентская отрисовка совпадают
  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey(page)) === "collapsed") setOpen(false);
    } catch {
      /* хранилище недоступно — оставляем открытым */
    }
  }, [page]);

  const toggle = () => {
    setOpen((was) => {
      try {
        window.localStorage.setItem(storageKey(page), was ? "collapsed" : "open");
      } catch {
        /* не запомнили — не страшно */
      }
      return !was;
    });
  };

  return (
    <Panel className={`${className} p-5 md:p-6`} label={g.title}>
      {/* золотая нить сверху — гид отличается от рабочих панелей */}
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-amber-200/0 via-amber-200/40 to-amber-200/0" />

      <SectionHeader
        eyebrow={ui.eyebrow}
        title={g.title}
        icon={Compass}
        action={
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-700/80 px-4 text-xs text-zinc-300 transition hover:border-amber-200/35 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30"
          >
            {open ? ui.hide : ui.show}
            <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        }
      />
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{g.lead}</p>

      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          {/* механика по шагам */}
          {g.flow && (
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/60">{g.flow.title}</p>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-flow-col xl:auto-cols-fr xl:grid-cols-none">
                {g.flow.steps.map((s, i) => {
                  const Icon = icons.flow[i] ?? Compass;
                  return (
                    <li
                      key={s.title}
                      className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4 xl:after:absolute xl:after:-right-2.5 xl:after:top-1/2 xl:after:h-px xl:after:w-2 xl:after:bg-amber-200/30 xl:last:after:hidden"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`${cormorant.className} text-2xl leading-none text-amber-200/80`}>{i + 1}</span>
                        <span className="flex size-8 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/[0.06] text-amber-200">
                          <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-zinc-100">{s.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{s.text}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* словарь: разделы, статусы, кнопки */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {g.sections.map((sec, i) => {
              const Icon = icons.sections[i] ?? Compass;
              return (
                <section key={sec.title} className="rounded-xl border border-zinc-800/70 bg-zinc-950/30 p-4">
                  <h3 className={`${cormorant.className} flex items-center gap-2.5 text-xl font-medium text-zinc-50`}>
                    <Icon className="size-4 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
                    {sec.title}
                  </h3>
                  <dl className="mt-3 space-y-2.5">
                    {sec.items.map((it) => (
                      <div key={it.term ?? it.text} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                        {it.term && (
                          <dt className="shrink-0 sm:w-36">
                            <span className="inline-flex max-w-full rounded-full border border-amber-200/25 bg-amber-200/[0.06] px-2.5 py-0.5 text-[11px] text-amber-100">
                              {it.term}
                            </span>
                          </dt>
                        )}
                        <dd className="min-w-0 text-xs leading-relaxed text-zinc-400">{it.text}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>

          {g.tip && (
            <p className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3 text-xs leading-relaxed text-amber-100/80">
              <Compass className="mt-0.5 size-3.5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
              {g.tip}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
