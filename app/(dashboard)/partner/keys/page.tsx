"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · КЛЮЧИ — app/(dashboard)/partner/keys/page.tsx
 *
 * Власть: ранг менеджера.
 *   Герой      эмблема текущего Ключа и шкалы до следующего:
 *              закрытые туры (в нужном окне) и оценка резиденток
 *   Лестница   Silver → Gold → Platinum: условия и привилегии
 *   В зачёте   туры, которые считаются для Platinum, и когда каждый
 *              выпадет из 12-месячного окна
 *   Правила    как считается Ключ
 *
 * Пороги — _lib/keys.ts → KEY_RULES (те же, что в partner_manager_stats).
 * Привилегии перечислены только те, что база уже обеспечивает.
 * ──────────────────────────────────────────────────────────────────── */

import { useId } from "react";
import Link from "next/link";
import { Check, ChevronRight, Hourglass, KeyRound, Lock, Scale, Sparkles, Star } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { DAY } from "../_lib/clock";
import { ROUTES } from "../_lib/routes";
import type { KeyTier } from "../_lib/command";
import { pl, ru, usePartnerFormat, type Common, type Fmt } from "../_lib/format";
import { KEY_RULES, parseKeys, type CountedTour, type KeysData, type TierRule } from "../_lib/keys";
import { usePartnerFeed } from "../_lib/usePartnerFeed";
import {
  LINK_SUBTLE,
  Meter,
  FeedGate,
  PageHeader,
  PageShell,
  Panel,
  Pill,
  SectionHeader,
  TIER_LABEL,
  TIER_TEXT,
  cormorant,
} from "../_components/PartnerUI";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type Dict = {
  eyebrow: string;
  title: string;
  subtitle: string;
  hero: { label: string; to: (tier: string) => string; top: string; topHint: string; auto: string; left: (n: number, tier: string) => string };
  req: {
    toursYear: string;
    toursTotal: string;
    rating: string;
    ratingOf: (have: string, need: string) => string;
    toursOf: (have: number, need: number) => string;
    met: string;
    noRating: string;
  };
  ladder: { eyebrow: string; title: string; passed: string; current: string; next: string; locked: string; needs: string; gives: string };
  needs: Record<KeyTier, (rule: TierRule, rating: string) => string[]>;
  gives: Record<KeyTier, string[]>;
  counted: {
    eyebrow: string;
    title: string;
    hint: (need: number) => string;
    leaves: (d: string) => string;
    first: string;
    empty: string;
  };
  rules: { eyebrow: string; title: string; items: (gold: TierRule, platinum: TierRule, rating: string) => string[] };
  pulseLink: string;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Power · Keys",
    title: "Keys",
    subtitle: "Your rank is earned by the quality of your work in Voyage: closed tours and residents’ ratings. It is recalculated automatically.",
    hero: {
      label: "Your rank",
      to: (tier) => `To ${tier}`,
      top: "Highest Key",
      topHint: "Keep the conditions below — the rank is recalculated every day.",
      auto: "All conditions met — the Key will update automatically.",
      left: (n, tier) => `${n} more ${pl(n, "tour", "tours")} to ${tier}`,
    },
    req: {
      toursYear: "Closed tours · last 12 months",
      toursTotal: "Closed tours · all time",
      rating: "Residents’ rating",
      ratingOf: (h, n) => `${h} · need ${n}`,
      toursOf: (h, n) => `${h} of ${n}`,
      met: "Met",
      noRating: "No ratings yet",
    },
    ladder: {
      eyebrow: "Ladder",
      title: "Silver → Gold → Platinum",
      passed: "Passed",
      current: "Your rank",
      next: "Next",
      locked: "Ahead",
      needs: "Conditions",
      gives: "What it gives",
    },
    needs: {
      silver: () => ["Invitation from Voyage"],
      gold: (r, x) => [`${r.tours} closed tours in Voyage`, `Residents’ rating from ${x}`],
      platinum: (r, x) => [`${r.tours} closed tours in the last 12 months`, `Residents’ rating from ${x}`],
    },
    gives: {
      silver: ["Castings with blind selection", "Tour room and Digital Contract", "Telegram reminders to participants", "Blacklist and Radar"],
      gold: ["Everything in Silver", "Gold Key mark on your reviews of residents"],
      platinum: ["New Verified profiles right away — others wait 24 hours", "Platinum Key mark on your reviews"],
    },
    counted: {
      eyebrow: "Counted",
      title: "Tours in the 12-month window",
      hint: (n) => `A tour counts for 12 months from its departure. Platinum needs ${n} in the window at the same time.`,
      leaves: (d) => `counts for ${d} more`,
      first: "Leaves first",
      empty: "No closed tours in the last 12 months.",
    },
    rules: {
      eyebrow: "Rules",
      title: "How the Key is calculated",
      items: (g, p, x) => [
        "Only tours closed in Voyage count — work outside the platform does not affect the Key.",
        "The rating is the average of residents’ published reviews about you; the club moderates every review.",
        `Gold: ${g.tours} closed tours in total and a rating from ${x}. Platinum: ${p.tours} closed tours in the last 12 months and a rating from ${x}.`,
        "If the rating drops or tours leave the window, the rank goes down automatically.",
      ],
    },
    pulseLink: "Your Pulse",
  },
  RU: {
    eyebrow: "Власть · Ключи",
    title: "Ключи",
    subtitle: "Ранг зарабатывается качеством работы в Voyage: закрытые туры и оценки резиденток. Пересчитывается автоматически.",
    hero: {
      label: "Ваш ранг",
      to: (tier) => `До ${tier}`,
      top: "Высший ключ",
      topHint: "Держите условия ниже — ранг пересчитывается каждый день.",
      auto: "Все условия выполнены — Ключ обновится автоматически.",
      left: (n, tier) => `Ещё ${n} ${ru(n, "тур", "тура", "туров")} до ${tier}`,
    },
    req: {
      toursYear: "Закрытые туры · 12 месяцев",
      toursTotal: "Закрытые туры · за всё время",
      rating: "Оценка резиденток",
      ratingOf: (h, n) => `${h} · нужно ${n}`,
      toursOf: (h, n) => `${h} из ${n}`,
      met: "Выполнено",
      noRating: "Оценок пока нет",
    },
    ladder: {
      eyebrow: "Лестница",
      title: "Silver → Gold → Platinum",
      passed: "Пройден",
      current: "Ваш ранг",
      next: "Следующий",
      locked: "Впереди",
      needs: "Условия",
      gives: "Что даёт",
    },
    needs: {
      silver: () => ["Приглашение Voyage"],
      gold: (r, x) => [`${r.tours} ${ru(r.tours ?? 0, "закрытый тур", "закрытых тура", "закрытых туров")} в Voyage`, `Оценка резиденток от ${x}`],
      platinum: (r, x) => [
        `${r.tours} ${ru(r.tours ?? 0, "закрытый тур", "закрытых тура", "закрытых туров")} за 12 месяцев`,
        `Оценка резиденток от ${x}`,
      ],
    },
    gives: {
      silver: ["Кастинги со слепым отбором", "Комната тура и Digital Contract", "Напоминания участницам в Telegram", "Blacklist и Радар"],
      gold: ["Всё из Silver", "Отметка Gold Key в ваших отзывах о резидентках"],
      platinum: ["Новые анкеты Verified — сразу, остальным через 24 часа", "Отметка Platinum Key в ваших отзывах"],
    },
    counted: {
      eyebrow: "В зачёте",
      title: "Туры в окне 12 месяцев",
      hint: (n) => `Тур идёт в зачёт 12 месяцев с даты вылета. Для Platinum нужно ${n} туров в окне одновременно.`,
      leaves: (d) => `в зачёте ещё ${d}`,
      first: "Выпадет первым",
      empty: "За последние 12 месяцев закрытых туров нет.",
    },
    rules: {
      eyebrow: "Правила",
      title: "Как считается Ключ",
      items: (g, p, x) => [
        "Считаются только туры, закрытые в Voyage, — работа вне платформы на Ключ не влияет.",
        "Оценка — средняя по опубликованным отзывам резиденток о вас; каждый отзыв проходит модерацию клуба.",
        `Gold: ${g.tours} ${ru(g.tours ?? 0, "закрытый тур", "закрытых тура", "закрытых туров")} за всё время и оценка от ${x}. ` +
          `Platinum: ${p.tours} ${ru(p.tours ?? 0, "закрытый тур", "закрытых тура", "закрытых туров")} за последние 12 месяцев и оценка от ${x}.`,
        "Если оценка опустится или туры выйдут из окна, ранг снизится автоматически.",
      ],
    },
    pulseLink: "Ваш Пульс",
  },
  ES: {
    eyebrow: "Poder · Llaves",
    title: "Llaves",
    subtitle: "El rango se gana con la calidad del trabajo en Voyage: tours cerrados y valoraciones de las residentes. Se recalcula solo.",
    hero: {
      label: "Tu rango",
      to: (tier) => `Hasta ${tier}`,
      top: "Llave máxima",
      topHint: "Mantén las condiciones de abajo: el rango se recalcula cada día.",
      auto: "Todas las condiciones cumplidas: la Llave se actualizará sola.",
      left: (n, tier) => `${n} ${pl(n, "tour más", "tours más")} para ${tier}`,
    },
    req: {
      toursYear: "Tours cerrados · 12 meses",
      toursTotal: "Tours cerrados · en total",
      rating: "Valoración de residentes",
      ratingOf: (h, n) => `${h} · se necesita ${n}`,
      toursOf: (h, n) => `${h} de ${n}`,
      met: "Cumplido",
      noRating: "Aún sin valoraciones",
    },
    ladder: {
      eyebrow: "Escalera",
      title: "Silver → Gold → Platinum",
      passed: "Superado",
      current: "Tu rango",
      next: "Siguiente",
      locked: "Más adelante",
      needs: "Condiciones",
      gives: "Qué da",
    },
    needs: {
      silver: () => ["Invitación de Voyage"],
      gold: (r, x) => [`${r.tours} tours cerrados en Voyage`, `Valoración de residentes desde ${x}`],
      platinum: (r, x) => [`${r.tours} tours cerrados en 12 meses`, `Valoración de residentes desde ${x}`],
    },
    gives: {
      silver: ["Castings con selección a ciegas", "Sala del tour y Digital Contract", "Recordatorios por Telegram a las participantes", "Blacklist y Radar"],
      gold: ["Todo lo de Silver", "Marca Gold Key en tus reseñas de residentes"],
      platinum: ["Perfiles Verified nuevos al instante; los demás esperan 24 horas", "Marca Platinum Key en tus reseñas"],
    },
    counted: {
      eyebrow: "Cuentan",
      title: "Tours en la ventana de 12 meses",
      hint: (n) => `Un tour cuenta 12 meses desde su salida. Para Platinum necesitas ${n} en la ventana a la vez.`,
      leaves: (d) => `cuenta ${d} más`,
      first: "Sale primero",
      empty: "No hay tours cerrados en los últimos 12 meses.",
    },
    rules: {
      eyebrow: "Reglas",
      title: "Cómo se calcula la Llave",
      items: (g, p, x) => [
        "Solo cuentan los tours cerrados en Voyage: el trabajo fuera de la plataforma no afecta a la Llave.",
        "La valoración es la media de las reseñas publicadas de las residentes sobre ti; el club modera cada reseña.",
        `Gold: ${g.tours} tours cerrados en total y valoración desde ${x}. Platinum: ${p.tours} tours cerrados en los últimos 12 meses y valoración desde ${x}.`,
        "Si la valoración baja o los tours salen de la ventana, el rango baja automáticamente.",
      ],
    },
    pulseLink: "Tu Pulse",
  },
  PT: {
    eyebrow: "Poder · Chaves",
    title: "Chaves",
    subtitle: "O ranking vem da qualidade do trabalho no Voyage: tours encerrados e avaliações das residentes. É recalculado automaticamente.",
    hero: {
      label: "Seu ranking",
      to: (tier) => `Até ${tier}`,
      top: "Chave máxima",
      topHint: "Mantenha as condições abaixo — o ranking é recalculado todo dia.",
      auto: "Todas as condições cumpridas — a Chave será atualizada automaticamente.",
      left: (n, tier) => `Mais ${n} ${pl(n, "tour", "tours")} até ${tier}`,
    },
    req: {
      toursYear: "Tours encerrados · 12 meses",
      toursTotal: "Tours encerrados · no total",
      rating: "Avaliação das residentes",
      ratingOf: (h, n) => `${h} · precisa de ${n}`,
      toursOf: (h, n) => `${h} de ${n}`,
      met: "Cumprido",
      noRating: "Ainda sem avaliações",
    },
    ladder: {
      eyebrow: "Escada",
      title: "Silver → Gold → Platinum",
      passed: "Concluído",
      current: "Seu ranking",
      next: "Próximo",
      locked: "Adiante",
      needs: "Condições",
      gives: "O que dá",
    },
    needs: {
      silver: () => ["Convite do Voyage"],
      gold: (r, x) => [`${r.tours} tours encerrados no Voyage`, `Avaliação das residentes a partir de ${x}`],
      platinum: (r, x) => [`${r.tours} tours encerrados em 12 meses`, `Avaliação das residentes a partir de ${x}`],
    },
    gives: {
      silver: ["Castings com seleção às cegas", "Sala do tour e Digital Contract", "Lembretes às participantes pelo Telegram", "Blacklist e Radar"],
      gold: ["Tudo do Silver", "Marca Gold Key nas suas avaliações de residentes"],
      platinum: ["Perfis Verified novos na hora — os demais esperam 24 horas", "Marca Platinum Key nas suas avaliações"],
    },
    counted: {
      eyebrow: "Contam",
      title: "Tours na janela de 12 meses",
      hint: (n) => `Um tour conta por 12 meses a partir do embarque. Para Platinum você precisa de ${n} na janela ao mesmo tempo.`,
      leaves: (d) => `conta por mais ${d}`,
      first: "Sai primeiro",
      empty: "Nenhum tour encerrado nos últimos 12 meses.",
    },
    rules: {
      eyebrow: "Regras",
      title: "Como a Chave é calculada",
      items: (g, p, x) => [
        "Só contam tours encerrados no Voyage — trabalho fora da plataforma não afeta a Chave.",
        "A avaliação é a média das avaliações publicadas das residentes sobre você; o clube modera cada uma.",
        `Gold: ${g.tours} tours encerrados no total e avaliação a partir de ${x}. Platinum: ${p.tours} tours encerrados nos últimos 12 meses e avaliação a partir de ${x}.`,
        "Se a avaliação cair ou os tours saírem da janela, o ranking cai automaticamente.",
      ],
    },
    pulseLink: "Seu Pulse",
  },
};

const ORDER: KeyTier[] = ["silver", "gold", "platinum"];
const ruleOf = (tier: KeyTier) => KEY_RULES.find((r) => r.tier === tier) ?? KEY_RULES[0];

const STOPS: Record<KeyTier, [string, string]> = {
  silver: ["#f4f4f5", "#71717a"],
  gold: ["#fde68a", "#f59e0b"],
  platinum: ["#fafafa", "#bae6fd"],
};

/* ══════════════════════════════════════════════════════════════════
 * ЭМБЛЕМА И ШКАЛЫ
 * ══════════════════════════════════════════════════════════════════ */

/** Округление координат: последние знаки Math.sin в Node и браузере расходятся — гидрация ругается */
const r2 = (v: number) => Math.round(v * 100) / 100;

function KeyEmblem({ tier, size = 176 }: { tier: KeyTier; size?: number }) {
  const id = `key-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [from, to] = STOPS[tier];
  const ticks = Array.from({ length: 48 }, (_, i) => i);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <span aria-hidden className="absolute inset-4 rounded-full bg-amber-300/15 blur-2xl" />
      <svg viewBox="0 0 200 200" className="relative size-full" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="none" stroke={`url(#${id})`} strokeWidth="1.5" opacity="0.9" />
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const long = i % 4 === 0;
          const r1 = long ? 78 : 81;
          return (
            <line
              key={i}
              x1={r2(100 + Math.cos(a) * r1)}
              y1={r2(100 + Math.sin(a) * r1)}
              x2={r2(100 + Math.cos(a) * 85)}
              y2={r2(100 + Math.sin(a) * 85)}
              stroke={`url(#${id})`}
              strokeWidth={long ? 1.4 : 0.8}
              opacity={long ? 0.8 : 0.4}
            />
          );
        })}
        <circle cx="100" cy="100" r="66" fill="rgb(9 9 11 / 0.85)" stroke={`url(#${id})`} strokeWidth="1" opacity="0.95" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <KeyRound className="size-14 text-amber-200 drop-shadow-[0_0_18px_rgba(253,230,138,0.45)]" strokeWidth={1.1} aria-hidden />
      </span>
    </div>
  );
}

function Requirement({
  label,
  value,
  met,
  metLabel,
  meter,
}: {
  label: string;
  value: string;
  met: boolean;
  metLabel: string;
  meter: { value: number; max: number };
}) {
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs text-zinc-300">{label}</span>
        <span className={`flex items-center gap-1.5 text-xs tabular-nums ${met ? "text-emerald-200" : "text-zinc-100"}`}>
          {met && <Check className="size-3.5" aria-hidden />}
          {value}
          {met && <span className="sr-only">· {metLabel}</span>}
        </span>
      </div>
      <Meter value={meter.value} max={meter.max} label={`${label}: ${value}`} tone={met ? "emerald" : "gold"} className="mt-2" />
    </li>
  );
}

function KeyHero({ data, t, fmt }: { data: KeysData; t: Dict; fmt: Fmt }) {
  const m = data.manager;
  const next = m.nextTier;
  const rule = next ? ruleOf(next) : ruleOf(m.tier);
  const have = rule.window === "year" ? data.closedYear : data.closedTotal;
  const needTours = rule.tours ?? 0;
  const needRating = rule.rating ?? 0;
  const toursMet = have >= needTours;
  const ratingMet = (m.rating ?? 0) >= needRating;
  const left = Math.max(0, needTours - have);

  return (
    <Panel className="mt-8 overflow-hidden p-6 md:p-8">
      <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-amber-400/[0.08] blur-3xl" />
      <div className="relative grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col items-center gap-5 text-center">
          <KeyEmblem tier={m.tier} />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.hero.label}</p>
            <p
              className={`${cormorant.className} mt-2 bg-gradient-to-r ${TIER_TEXT[m.tier]} bg-clip-text text-5xl font-semibold leading-none text-transparent md:text-6xl`}
            >
              {TIER_LABEL[m.tier]}
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              {next ? (toursMet && ratingMet ? t.hero.auto : t.hero.left(left, TIER_LABEL[next])) : t.hero.topHint}
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-5">
          <p className={`${cormorant.className} text-xl font-medium text-zinc-50`}>
            {next ? (
              <>
                {t.hero.to("")}
                <span className={`bg-gradient-to-r ${TIER_TEXT[next]} bg-clip-text font-semibold text-transparent`}>{TIER_LABEL[next]}</span>
              </>
            ) : (
              t.hero.top
            )}
          </p>
          <ul className="mt-5 space-y-5">
            <Requirement
              label={rule.window === "year" ? t.req.toursYear : t.req.toursTotal}
              value={t.req.toursOf(have, needTours)}
              met={toursMet}
              metLabel={t.req.met}
              meter={{ value: have, max: needTours }}
            />
            <Requirement
              label={t.req.rating}
              value={m.rating !== null ? t.req.ratingOf(fmt.num(m.rating, 1), fmt.num(needRating, 1)) : t.req.noRating}
              met={ratingMet}
              metLabel={t.req.met}
              meter={{ value: m.rating ?? 0, max: 5 }}
            />
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ЛЕСТНИЦА
 * ══════════════════════════════════════════════════════════════════ */

function Ladder({ current, t, fmt }: { current: KeyTier; t: Dict; fmt: Fmt }) {
  const at = ORDER.indexOf(current);
  return (
    <section className="mt-10">
      <SectionHeader eyebrow={t.ladder.eyebrow} title={t.ladder.title} icon={Sparkles} />
      <ol className="relative mt-6 grid gap-4 xl:grid-cols-3">
        {/* линия между ступенями (≥ xl) */}
        <span aria-hidden className="absolute left-[16%] right-[16%] top-[18px] hidden h-px bg-zinc-800 xl:block" />
        <span
          aria-hidden
          className="absolute left-[16%] top-[18px] hidden h-px bg-gradient-to-r from-amber-500 to-amber-200 xl:block"
          style={{ width: `${(at / (ORDER.length - 1)) * 68}%` }}
        />
        {ORDER.map((tier, i) => {
          const state = i < at ? "passed" : i === at ? "current" : i === at + 1 ? "next" : "locked";
          const rule = ruleOf(tier);
          const ratingText = rule.rating !== null ? fmt.num(rule.rating, 1) : "";
          return (
            <li key={tier} className="relative flex flex-col">
              <span
                className={`relative z-[1] mx-auto flex size-9 items-center justify-center rounded-full border text-xs ${
                  state === "current"
                    ? "border-amber-200/60 bg-amber-200 text-zinc-950 shadow-[0_0_24px_-6px_rgba(253,230,138,0.8)]"
                    : state === "passed"
                      ? "border-amber-200/40 bg-zinc-950 text-amber-200"
                      : "border-zinc-700 bg-zinc-950 text-zinc-500"
                } max-xl:hidden`}
                aria-hidden
              >
                {state === "passed" ? <Check className="size-4" /> : state === "current" ? <KeyRound className="size-4" /> : <Lock className="size-3.5" />}
              </span>
              <div
                className={`mt-0 flex flex-1 flex-col rounded-2xl border p-5 backdrop-blur-xl xl:mt-4 ${
                  state === "current"
                    ? "border-amber-200/35 bg-gradient-to-br from-amber-200/[0.08] via-zinc-900/60 to-zinc-950/80 shadow-[0_0_40px_-20px_rgba(253,230,138,0.5)]"
                    : "border-zinc-800/80 bg-zinc-900/40"
                } ${state === "locked" ? "opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <p
                    className={`${cormorant.className} whitespace-nowrap bg-gradient-to-r ${TIER_TEXT[tier]} bg-clip-text text-[1.75rem] font-semibold leading-tight text-transparent`}
                  >
                    {TIER_LABEL[tier]}
                  </p>
                  <Pill tone={state === "current" ? "gold" : state === "passed" ? "emerald" : "zinc"}>
                    {state === "passed" ? t.ladder.passed : state === "current" ? t.ladder.current : state === "next" ? t.ladder.next : t.ladder.locked}
                  </Pill>
                </div>

                <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.ladder.needs}</p>
                <ul className="mt-2 space-y-1.5">
                  {t.needs[tier](rule, ratingText).map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs leading-snug text-zinc-300">
                      <Scale className="mt-0.5 size-3 shrink-0 text-zinc-500" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{t.ladder.gives}</p>
                <ul className="mt-2 space-y-1.5">
                  {t.gives[tier].map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs leading-snug text-zinc-200">
                      <Star className="mt-0.5 size-3 shrink-0 text-amber-200/80" aria-hidden />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ТУРЫ В ЗАЧЁТЕ · ПРАВИЛА
 * ══════════════════════════════════════════════════════════════════ */

function CountedPanel({ counted, need, t, cm, fmt }: { counted: CountedTour[]; need: number; t: Dict; cm: Common; fmt: Fmt }) {
  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.counted.eyebrow} title={t.counted.title} icon={Hourglass} count={counted.length} />
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">{t.counted.hint(need)}</p>
      {counted.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">{t.counted.empty}</p>
      ) : (
        <ol className="mt-4 divide-y divide-zinc-800/70">
          {counted.map((c, i) => {
            const soon = fmt.ready && c.expiresAt - fmt.now < 90 * DAY;
            return (
              <li key={c.id}>
                <Link
                  href={ROUTES.dealRoom(c.id)}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-zinc-900/60"
                >
                  <span className="w-12 shrink-0 text-[11px] tabular-nums text-zinc-500">
                    {fmt.date(c.departsAt, { day: "numeric", month: "short" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">
                      {fmt.city(c.city)} · {cm.projects[c.project]}
                    </span>
                    {i === 0 && <span className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">{t.counted.first}</span>}
                  </span>
                  <span className={`shrink-0 text-right text-[11px] ${soon ? "text-amber-200" : "text-zinc-500"}`}>
                    {fmt.ready ? t.counted.leaves(fmt.until(c.expiresAt)) : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function RulesPanel({ t, fmt }: { t: Dict; fmt: Fmt }) {
  const gold = ruleOf("gold");
  const platinum = ruleOf("platinum");
  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.rules.eyebrow} title={t.rules.title} icon={Scale} />
      <ol className="mt-4 space-y-3">
        {t.rules.items(gold, platinum, fmt.num(gold.rating ?? 0, 1)).map((item, i) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-zinc-300">
            <span className={`${cormorant.className} w-5 shrink-0 text-lg leading-6 text-amber-200/80`}>{i + 1}</span>
            {item}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function PartnerKeysPage() {
  const { lang, c: cm } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const feed = usePartnerFeed("partner_keys", parseKeys);
  return (
    <FeedGate feed={feed} c={cm} eyebrow={t.eyebrow} title={t.title}>
      {(data) => <KeysView data={data} />}
    </FeedGate>
  );
}

function KeysView({ data }: { data: KeysData }) {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;

  return (
    <PageShell>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link href={ROUTES.pulse} className={LINK_SUBTLE}>
            {t.pulseLink}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        }
      />

      <KeyHero data={data} t={t} fmt={fmt} />
      <Ladder current={data.manager.tier} t={t} fmt={fmt} />

      <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <CountedPanel counted={data.counted} need={ruleOf("platinum").tours ?? 0} t={t} cm={cm} fmt={fmt} />
        <RulesPanel t={t} fmt={fmt} />
      </div>
    </PageShell>
  );
}
