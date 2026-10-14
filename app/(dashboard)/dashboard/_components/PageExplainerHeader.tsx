"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PAGE EXPLAINER HEADER
 * app/(dashboard)/dashboard/_components/PageExplainerHeader.tsx
 *
 * Единая шапка разделов кабинета резидента — по образцу «Баллов тура»:
 *
 *   1. Hero      золотая пилюля-eyebrow, крупный serif-заголовок,
 *                описание; водяной знак — иконка раздела (та же, что
 *                в сайдбаре), два мягких золотых свечения.
 *   2. Шаги      01 · 02 · 03 — механика раздела в три коротких строки.
 *   3. Карточки  опционально две: нейтральная и «золотая» (как «Спринт»
 *                и «Марафон»), у каждой может быть ссылка-пилюля.
 *
 * Тексты страница отдаёт сразу на 4 языках (COPY: EN · RU · ES · PT),
 * язык компонент берёт сам из LanguageContext. Иконки и ссылки от языка
 * не зависят и передаются отдельно:
 *
 *   <PageExplainerHeader
 *     copy={COPY}
 *     icon={Sparkles}
 *     stepIcons={[ToggleRight, MousePointerClick, Handshake]}
 *     cards={[{ icon: EyeOff }, { icon: Hourglass, href: "/dashboard/tours" }]}
 *   />
 *
 * Сетки учитывают сайдбар: на md (768–1023 px) рядом с колонкой меню
 * остаётся 480–730 px, поэтому шаги и карточки там идут столбиком,
 * а в три и две колонки раскладываются с lg.
 *
 * ResidentPageShell — общая рамка страницы (ширина и отступы как у
 * «Баллов тура»), чтобы все разделы стояли на одной сетке.
 * ──────────────────────────────────────────────────────────────────── */

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles, type LucideIcon } from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";

/* ───────────────────────── Types ───────────────────────── */

export type ExplainerCard = {
  title: string;
  text: string;
  /** Подпись ссылки-пилюли. Показывается, только если у карточки есть href */
  cta?: string;
};

export type ExplainerCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: readonly [string, string, string];
  cards?: readonly [ExplainerCard, ExplainerCard];
};

/** Тексты шапки на всех языках интерфейса — объект COPY на странице */
export type ExplainerDict = Record<Lang, ExplainerCopy>;

export type ExplainerCardSetup = {
  icon: LucideIcon;
  href?: string;
};

export type PageExplainerHeaderProps = {
  copy: ExplainerDict;
  /** Иконка раздела — водяной знак в hero. Берите ту же, что в сайдбаре */
  icon: LucideIcon;
  stepIcons: readonly [LucideIcon, LucideIcon, LucideIcon];
  /** Иконки и ссылки нижних карточек. Сами карточки рисуются из copy.cards */
  cards?: readonly [ExplainerCardSetup, ExplainerCardSetup];
  /** Какая карточка «золотая». По умолчанию вторая, null — обе нейтральные */
  accent?: 0 | 1 | null;
  /** Иконка в пилюле-eyebrow, по умолчанию Sparkles */
  eyebrowIcon?: LucideIcon;
  /** Слот справа от пилюли: бейдж «Демо», счётчик и т. п. */
  badge?: ReactNode;
  className?: string;
};

/* ───────────────────────── Header ───────────────────────── */

export default function PageExplainerHeader({
  copy,
  icon: HeroIcon,
  stepIcons,
  cards,
  accent = 1,
  eyebrowIcon: EyebrowIcon = Sparkles,
  badge,
  className = "",
}: PageExplainerHeaderProps) {
  const { lang } = useLanguage();
  const c = copy[lang] ?? copy.EN;
  const titleId = useId();

  return (
    <div className={className}>
      {/* ───────────── Hero ───────────── */}
      <section
        aria-labelledby={titleId}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-6 sm:p-10"
      >
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c9a961]/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[#c9a961]/5 blur-3xl" />
        <HeroIcon
          aria-hidden
          strokeWidth={1}
          className="pointer-events-none absolute -right-6 bottom-0 h-40 w-40 text-[#c9a961]/[0.06] sm:h-56 sm:w-56"
        />

        <div className="relative">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#c9a961]/30 bg-[#c9a961]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[#c9a961]">
              <EyebrowIcon aria-hidden className="h-3.5 w-3.5" />
              {c.eyebrow}
            </p>
            {badge}
          </div>

          <h1 id={titleId} className="font-serif text-3xl font-light tracking-tight text-white sm:text-5xl">
            {c.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">{c.subtitle}</p>

          <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            {c.steps.map((text, i) => {
              const StepIcon = stepIcons[i];
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 backdrop-blur"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c9a961]/10 text-[#c9a961]"
                  >
                    <StepIcon className="h-4 w-4" />
                  </span>
                  <span className="text-sm text-neutral-200">
                    <span aria-hidden className="mr-1.5 tabular-nums text-[#c9a961]/70">
                      0{i + 1}
                    </span>
                    {text}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ───────────── Инфо-карточки ───────────── */}
      {c.cards && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          {c.cards.map((card, i) => (
            <InfoCard key={i} card={card} setup={cards?.[i]} gold={accent === i} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Card ───────────────────────── */

function InfoCard({ card, setup, gold }: { card: ExplainerCard; setup?: ExplainerCardSetup; gold: boolean }) {
  const Icon = setup?.icon ?? Sparkles;
  const href = card.cta ? setup?.href : undefined;

  return (
    <div
      className={
        gold
          ? "relative overflow-hidden rounded-3xl border border-[#c9a961]/25 bg-gradient-to-br from-[#c9a961]/[0.07] via-neutral-950 to-neutral-950 p-5 sm:p-6"
          : "rounded-3xl border border-white/10 bg-neutral-950/60 p-5 sm:p-6"
      }
    >
      <h2
        className={`flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] ${
          gold ? "text-[#c9a961]" : "text-neutral-300"
        }`}
      >
        <Icon aria-hidden strokeWidth={1.5} className={`h-4 w-4 shrink-0 ${gold ? "" : "text-[#c9a961]"}`} />
        {card.title}
      </h2>
      <p className={`mt-3 text-sm leading-relaxed ${gold ? "text-neutral-300" : "text-neutral-400"}`}>{card.text}</p>
      {href && (
        <Link
          href={href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#c9a961]/40 px-3.5 py-1.5 text-xs text-[#c9a961] transition hover:bg-[#c9a961]/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c9a961]/60"
        >
          {card.cta}
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/* ───────────────────────── Page shell ───────────────────────── */

/** Рамка страницы резидента: ширина и отступы как у «Баллов тура» */
export function ResidentPageShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-4xl px-4 pb-24 pt-0 sm:px-6 md:pb-12 ${className}`}>{children}</div>;
}
