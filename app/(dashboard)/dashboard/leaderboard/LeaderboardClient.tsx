"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · GLOBAL RANKING — интерфейс
 * app/(dashboard)/dashboard/leaderboard/LeaderboardClient.tsx
 *
 *   Ваше место   — позиция, Индекс, сколько до соседки выше и до Топ-10
 *   Пьедестал    — I · II · III (золото, платина, шампань)
 *   Первая десятка — позиции 4–10 в золочёной рамке, порог входа
 *   Весь рейтинг — 11 и ниже, по 25 строк, «Найти себя»
 *   Как считается Индекс + чем рейтинг тура отличается от глобального
 *
 * В рейтинге — только резиденты с Индексом > 0 (как в v_global_leaderboard:
 * позиция = rank() по total_influence). Раскладка — container queries:
 * страница живёт рядом с сайдбаром, ширина экрана ничего не говорит.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import { ArrowUpRight, Crown, Gem, KeyRound, LocateFixed, Plane, RefreshCw, Stamp, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { fmtPoints, normalizeLang, type CircleKey, type Lang } from "@/lib/gamification";
import { initials } from "@/lib/memberCards";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/* ── Данные ───────────────────────────────────────────────────────── */

export type LeaderboardEntry = {
  profileId: string;
  /** rank() из v_global_leaderboard — при равном Индексе позиции равны */
  position: number;
  name: string;
  avatarUrl: string | null;
  circleKey: CircleKey;
  circleTitle: string;
  influence: number;
  stamps: number;
  destinations: number;
  combos: number;
  patronage: number;
  proteges: number;
  /** баллы всех туров (уже в очках Индекса) */
  tourPoints?: number;
};

export type LeaderboardData = {
  /** по убыванию Индекса */
  entries: LeaderboardEntry[];
  meId: string | null;
  updatedAt: string;
};

const TOP = 10;
const PODIUM = 3;
const PAGE = 25;

/* ── Тексты ───────────────────────────────────────────────────────── */

type Text = {
  title: string;
  lede: string;
  ranked: (n: number) => string;
  updated: (time: string) => string;
  refresh: string;
  you: string;
  yourStanding: string;
  of: (n: number) => string;
  leading: string;
  sharedFirst: string;
  leadBy: (x: string) => string;
  toNext: (pos: number, x: string) => string;
  toTop: (x: string) => string;
  inTop: string;
  firstStamp: string;
  firstStampTop: string;
  staffNote: string;
  topTitle: string;
  topCaption: (x: string) => string;
  restTitle: string;
  showMore: (n: number) => string;
  findMe: string;
  notStarted: (n: number) => string;
  emptyTitle: string;
  emptyBody: string;
  howTitle: string;
  howStamps: string;
  howCombos: string;
  howPatronage: string;
  howTours: string;
  toursNote: string;
  toursLink: string;
  passportLink: string;
  stamps: string;
  destinations: string;
  proteges: string;
  tourPoints: string;
  unnamed: string;
  locale: string;
};

const TEXT: Record<Lang, Text> = {
  en: {
    title: "The Global Ranking",
    lede: "The club's absolute standings, across all time. Every stamp, tour point, legendary combo and protégée adds to your Influence Index.",
    ranked: (n) => `${n} ranked`,
    updated: (time) => `Updated ${time}`,
    refresh: "Refresh",
    you: "You",
    yourStanding: "Your standing",
    of: (n) => `of ${n}`,
    leading: "You lead the club",
    sharedFirst: "You share first place",
    leadBy: (x) => `${x} ahead of No. 2`,
    toNext: (pos, x) => `${x} to No. ${pos}`,
    toTop: (x) => `${x} to enter the Top 10`,
    inTop: "You are among the Ten",
    firstStamp: "Your first stamp opens your place in the ranking.",
    firstStampTop: "Your first stamp places you straight into the Top 10.",
    staffNote: "The ranking covers club residents — staff accounts don't compete.",
    topTitle: "The Ten",
    topCaption: (x) => `The club's elite. Entry threshold — ${x}.`,
    restTitle: "The full ranking",
    showMore: (n) => `Show ${n} more`,
    findMe: "Find me",
    notStarted: (n) => `${n} more ${n === 1 ? "resident hasn't" : "residents haven't"} collected a first stamp yet.`,
    emptyTitle: "The ranking opens with the first stamp",
    emptyBody: "As soon as the first stamp lands in a passport, the club's standings will appear here.",
    howTitle: "How the Influence Index is built",
    howStamps: "Stamps — each destination is weighted by its visa clearance; return visits count ×1.5 and ×2.",
    howCombos: "Legendary combos — a bonus for completing a route.",
    howPatronage: "Patronage — dividends for the protégées you bring into the club.",
    howTours: "Tours — the points the club team awards on every trip, across all your tours.",
    toursNote:
      "A tour's ranking is a sprint: the trip's leader is decided by that tour's points alone, and every tour starts afresh. Yet every tour point is credited here at once — the global ranking accumulates over your whole time in the club.",
    toursLink: "Tours",
    passportLink: "My Passport",
    stamps: "Stamps",
    destinations: "Destinations",
    proteges: "Protégées",
    tourPoints: "Tour points",
    unnamed: "Resident",
    locale: "en-GB",
  },
  ru: {
    title: "Глобальный рейтинг",
    lede: "Абсолютный рейтинг клуба за всё время. Каждый штамп, балл тура, легендарное комбо и каждая протеже прибавляют к вашему Influence Index.",
    ranked: (n) => `В рейтинге: ${n}`,
    updated: (time) => `Обновлено в ${time}`,
    refresh: "Обновить",
    you: "Вы",
    yourStanding: "Ваше место",
    of: (n) => `из ${n}`,
    leading: "Вы возглавляете клуб",
    sharedFirst: "Вы делите первое место",
    leadBy: (x) => `Отрыв от № 2: ${x}`,
    toNext: (pos, x) => `До № ${pos}: ${x}`,
    toTop: (x) => `До первой десятки: ${x}`,
    inTop: "Вы в первой десятке",
    firstStamp: "Первый штамп откроет вам место в рейтинге.",
    firstStampTop: "Первый штамп сразу введёт вас в первую десятку.",
    staffNote: "В рейтинге — резиденты клуба; аккаунты персонала не участвуют.",
    topTitle: "Первая десятка",
    topCaption: (x) => `Элита клуба. Порог входа — ${x}.`,
    restTitle: "Весь рейтинг",
    showMore: (n) => `Показать ещё ${n}`,
    findMe: "Найти себя",
    notStarted: (n) => `Ещё без штампов: ${n}.`,
    emptyTitle: "Рейтинг откроется с первым штампом",
    emptyBody: "Как только в чьём-то паспорте появится первый штамп, здесь появится рейтинг клуба.",
    howTitle: "Из чего складывается Influence Index",
    howStamps: "Штампы — вес направления зависит от визового ценза; повторные визиты ×1,5 и ×2.",
    howCombos: "Легендарные комбо — бонус за собранный маршрут.",
    howPatronage: "Патронаж — дивиденды за протеже, которых вы привели в клуб.",
    howTours: "Туры — баллы, которые команда клуба начисляет в каждой поездке, за все ваши туры.",
    toursNote:
      "Рейтинг тура — спринт: лидера поездки определяют баллы только этого тура, и с каждым туром гонка начинается заново. Но каждый балл тура сразу зачисляется сюда — глобальный рейтинг копится за всё время в клубе.",
    toursLink: "Туры",
    passportLink: "Мой паспорт",
    stamps: "Штампы",
    destinations: "Направления",
    proteges: "Протеже",
    tourPoints: "Баллы туров",
    unnamed: "Резидент",
    locale: "ru-RU",
  },
  es: {
    title: "El ranking global",
    lede: "La clasificación absoluta del club, de todos los tiempos. Cada sello, punto de tour, combo legendario y protegida suman a su Influence Index.",
    ranked: (n) => `${n} en el ranking`,
    updated: (time) => `Actualizado a las ${time}`,
    refresh: "Actualizar",
    you: "Usted",
    yourStanding: "Su posición",
    of: (n) => `de ${n}`,
    leading: "Usted encabeza el club",
    sharedFirst: "Comparte el primer lugar",
    leadBy: (x) => `Ventaja sobre el n.º 2: ${x}`,
    toNext: (pos, x) => `${x} para el n.º ${pos}`,
    toTop: (x) => `${x} para entrar en el Top 10`,
    inTop: "Está entre los Diez",
    firstStamp: "Su primer sello le abrirá un lugar en el ranking.",
    firstStampTop: "Su primer sello la llevará directamente al Top 10.",
    staffNote: "El ranking incluye a los residentes del club; las cuentas del equipo no compiten.",
    topTitle: "Los Diez",
    topCaption: (x) => `La élite del club. Umbral de entrada: ${x}.`,
    restTitle: "Ranking completo",
    showMore: (n) => `Mostrar ${n} más`,
    findMe: "Encontrarme",
    notStarted: (n) => `${n} ${n === 1 ? "residente aún no tiene" : "residentes aún no tienen"} su primer sello.`,
    emptyTitle: "El ranking se abre con el primer sello",
    emptyBody: "En cuanto aparezca el primer sello en un pasaporte, aquí se mostrará la clasificación del club.",
    howTitle: "Cómo se forma el Influence Index",
    howStamps: "Sellos: cada destino pesa según su exigencia de visado; las visitas repetidas cuentan ×1,5 y ×2.",
    howCombos: "Combos legendarios: una bonificación por completar una ruta.",
    howPatronage: "Patronazgo: dividendos por las protegidas que trae al club.",
    howTours: "Tours: los puntos que el equipo del club otorga en cada viaje, de todos sus tours.",
    toursNote:
      "La clasificación de un tour es un sprint: la líder del viaje se decide solo con los puntos de ese tour, y cada tour empieza de cero. Pero cada punto del tour se suma aquí al instante: el ranking global se acumula durante todo su tiempo en el club.",
    toursLink: "Tours",
    passportLink: "Mi pasaporte",
    stamps: "Sellos",
    destinations: "Destinos",
    proteges: "Protegidas",
    tourPoints: "Puntos de tours",
    unnamed: "Residente",
    locale: "es-ES",
  },
  pt: {
    title: "O ranking global",
    lede: "A classificação absoluta do clube, de todos os tempos. Cada carimbo, ponto de tour, combo lendário e protegida somam ao seu Influence Index.",
    ranked: (n) => `${n} no ranking`,
    updated: (time) => `Atualizado às ${time}`,
    refresh: "Atualizar",
    you: "Você",
    yourStanding: "Sua posição",
    of: (n) => `de ${n}`,
    leading: "Você lidera o clube",
    sharedFirst: "Você divide o primeiro lugar",
    leadBy: (x) => `Vantagem sobre o nº 2: ${x}`,
    toNext: (pos, x) => `${x} para o nº ${pos}`,
    toTop: (x) => `${x} para entrar no Top 10`,
    inTop: "Você está entre os Dez",
    firstStamp: "Seu primeiro carimbo abre seu lugar no ranking.",
    firstStampTop: "Seu primeiro carimbo leva você direto ao Top 10.",
    staffNote: "O ranking inclui os residentes do clube; contas da equipe não competem.",
    topTitle: "Os Dez",
    topCaption: (x) => `A elite do clube. Limite de entrada: ${x}.`,
    restTitle: "Ranking completo",
    showMore: (n) => `Mostrar mais ${n}`,
    findMe: "Encontrar-me",
    notStarted: (n) => `${n} ${n === 1 ? "residente ainda não tem" : "residentes ainda não têm"} o primeiro carimbo.`,
    emptyTitle: "O ranking abre com o primeiro carimbo",
    emptyBody: "Assim que o primeiro carimbo aparecer em um passaporte, a classificação do clube surgirá aqui.",
    howTitle: "Como se forma o Influence Index",
    howStamps: "Carimbos — cada destino pesa conforme a exigência de visto; visitas repetidas contam ×1,5 e ×2.",
    howCombos: "Combos lendários — um bônus por completar uma rota.",
    howPatronage: "Patronato — dividendos pelas protegidas que você traz ao clube.",
    howTours: "Tours — os pontos que a equipe do clube concede em cada viagem, de todos os seus tours.",
    toursNote:
      "A classificação de um tour é um sprint: quem lidera a viagem é decidido só pelos pontos daquele tour, e cada tour recomeça do zero. Mas cada ponto do tour é creditado aqui na hora — o ranking global se acumula durante todo o seu tempo no clube.",
    toursLink: "Tours",
    passportLink: "Meu passaporte",
    stamps: "Carimbos",
    destinations: "Destinos",
    proteges: "Protegidas",
    tourPoints: "Pontos de tours",
    unnamed: "Residente",
    locale: "pt-BR",
  },
};

/* ── Оформление ───────────────────────────────────────────────────── */

const CIRCLE_BADGE: Record<CircleKey, string> = {
  voyager: "border-zinc-700/80 bg-zinc-800/50 text-zinc-400",
  resident: "border-zinc-600/70 bg-zinc-800/60 text-zinc-200",
  preferred: "border-amber-200/20 bg-amber-200/[0.04] text-amber-200/70",
  inner: "border-amber-200/35 bg-amber-200/[0.07] text-amber-200",
  private: "border-slate-200/30 bg-slate-200/[0.06] text-slate-100",
  black: "border-amber-100/50 bg-black text-amber-100",
};

const CIRCLE_RING: Record<CircleKey, string> = {
  voyager: "ring-zinc-700/70",
  resident: "ring-zinc-500/60",
  preferred: "ring-amber-200/25",
  inner: "ring-amber-200/45",
  private: "ring-slate-200/45",
  black: "ring-amber-100/70",
};

/** Пьедестал: золото, платина, шампань */
const PLACE = [
  { ring: "ring-amber-200/80", numeral: "lb-gold-text", glow: "shadow-[0_0_44px_-10px_rgba(253,230,138,0.45)]" },
  { ring: "ring-slate-200/70", numeral: "lb-platinum-text", glow: "shadow-[0_0_36px_-14px_rgba(226,232,240,0.35)]" },
  { ring: "ring-amber-200/40", numeral: "lb-champagne-text", glow: "shadow-[0_0_30px_-16px_rgba(253,230,138,0.3)]" },
] as const;

const STYLES = `
.lb-root { container-type: inline-size; }
.lb-gilt {
  border: 1px solid transparent;
  background:
    linear-gradient(rgb(14 14 17), rgb(14 14 17)) padding-box,
    linear-gradient(135deg, rgba(253,230,138,.55), rgba(253,230,138,.06) 38%, rgba(226,232,240,.2) 64%, rgba(253,230,138,.42)) border-box;
}
.lb-gilt-soft {
  border: 1px solid transparent;
  background:
    linear-gradient(rgb(12 12 15), rgb(12 12 15)) padding-box,
    linear-gradient(160deg, rgba(253,230,138,.32), rgba(253,230,138,.04) 45%, rgba(253,230,138,.22)) border-box;
}
.lb-gold-text { background: linear-gradient(180deg, #fef6dc 0%, #ead08f 55%, #b89553 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lb-platinum-text { background: linear-gradient(180deg, #ffffff 0%, #d9dee6 55%, #9aa3af 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lb-champagne-text { background: linear-gradient(180deg, #f7ead0 0%, #d4bc8e 60%, #a68b5d 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }

.lb-sheen { position: relative; overflow: hidden; isolation: isolate; }
.lb-sheen::after {
  content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background: linear-gradient(115deg, transparent 32%, rgba(253,230,138,.07) 46%, transparent 60%);
  transform: translateX(-100%);
  animation: lb-sheen 9s ease-in-out infinite;
}
@keyframes lb-sheen { 0%, 60% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .lb-sheen::after { animation: none; display: none; } }

/* Ваше место */
.lb-standing { display: grid; gap: 1.25rem; }
.lb-standing-goal { grid-column: 1 / -1; }
@container (min-width: 560px) {
  .lb-standing { grid-template-columns: auto minmax(0, 1fr); align-items: center; column-gap: 2rem; }
}
@container (min-width: 820px) {
  .lb-standing { grid-template-columns: auto minmax(0, 1fr) minmax(0, 1.1fr); }
  .lb-standing-goal { grid-column: auto; }
}

/* Пьедестал */
.lb-podium { display: grid; gap: .75rem; }
.lb-pod { --av: 52px; display: flex; align-items: center; gap: .85rem; padding: 1rem 1rem; text-align: left; border-radius: 1.25rem; }
.lb-pod[data-slot="1"] { --av: 60px; }
.lb-pod-numeral { display: flex; flex-direction: column; align-items: center; width: 1.9rem; flex: none; }
.lb-pod-meta { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: .4rem; }
.lb-pod-avatar { flex: none; }
.lb-pod-name { font-size: 1.25rem; line-height: 1.15; overflow-wrap: break-word; max-width: 100%; }
.lb-pod-score { display: flex; flex-direction: column; align-items: flex-start; }
.lb-pod-value { font-size: 1.5rem; line-height: 1; }
.lb-pod[data-slot="1"] .lb-pod-value { font-size: 1.75rem; }
.lb-rule-l { background: linear-gradient(90deg, transparent, rgba(253,230,138,.3)); }
.lb-rule-r { background: linear-gradient(270deg, transparent, rgba(253,230,138,.3)); }
@container (min-width: 620px) {
  .lb-podium { grid-template-columns: minmax(0, 1fr) minmax(0, 1.18fr) minmax(0, 1fr); align-items: end; gap: 1rem; }
  .lb-pod { --av: 64px; flex-direction: column; text-align: center; padding: 1.6rem 1.1rem 1.5rem; gap: .9rem; }
  .lb-pod[data-slot="1"] { --av: 84px; }
  .lb-pod[data-slot="1"] .lb-pod-name { font-size: 1.5rem; }
  .lb-pod[data-slot="1"] .lb-pod-value { font-size: 1.9rem; }
  .lb-pod-meta, .lb-pod-score { align-items: center; }
  .lb-pod-numeral { width: auto; }
  .lb-pod[data-slot="1"] { grid-column: 2; grid-row: 1; padding-top: 2.1rem; padding-bottom: 2rem; }
  .lb-pod[data-slot="2"] { grid-column: 1; grid-row: 1; }
  .lb-pod[data-slot="3"] { grid-column: 3; grid-row: 1; }
}

/* Строки */
/* узко: имя на всю ширину, Circle и Индекс — второй строкой */
.lb-row {
  display: grid; align-items: center; column-gap: .75rem; row-gap: .3rem;
  grid-template-columns: 1.9rem 2.5rem minmax(0, 1fr) auto;
  grid-template-areas: "pos ava name name" "pos ava badge idx";
  padding: .75rem .85rem;
}
.lb-row-pos { grid-area: pos; } .lb-row-ava { grid-area: ava; }
.lb-row-name { grid-area: name; min-width: 0; } .lb-row-badge { grid-area: badge; min-width: 0; }
.lb-row-idx { grid-area: idx; text-align: right; } .lb-row-stats { display: none; }
.lb-badge-short { display: none; }
@container (max-width: 439px) { .lb-row .lb-badge-full { display: none; } .lb-row .lb-badge-short { display: inline; } }
@container (min-width: 440px) {
  .lb-row { grid-template-columns: 2.4rem 2.6rem minmax(0, 1fr) auto; grid-template-areas: "pos ava name idx" "pos ava badge idx"; column-gap: .9rem; }
}
@container (min-width: 620px) {
  .lb-row {
    grid-template-columns: 3rem 2.75rem minmax(0, 1fr) auto 7rem;
    grid-template-areas: "pos ava name stats idx" "pos ava badge stats idx";
    padding: .8rem 1.25rem; column-gap: 1rem;
  }
  .lb-row-stats { display: grid; grid-area: stats; grid-template-columns: 3.2rem 4.6rem 3rem; }
}

/* Как считается */
.lb-how { display: grid; gap: .75rem; }
@container (min-width: 520px) { .lb-how { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 900px) { .lb-how { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
`;

/* ── Мелкие детали ────────────────────────────────────────────────── */

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const roman = (n: number) => ROMAN[n - 1] ?? String(n);
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

function displayName(e: LeaderboardEntry, t: Text) {
  return e.name || `${t.unnamed} · ${e.profileId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function Avatar({ src, name, size, ring }: { src: string | null; name: string; size: number | string; ring: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-900 ring-2 ring-offset-2 ring-offset-zinc-950 ${ring}`}
      style={{ width: size, height: size }}
    >
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-medium tracking-wide text-zinc-400"
          style={{ fontSize: typeof size === "number" ? Math.max(11, Math.round(size / 3.2)) : `max(11px, calc(${size} / 3.2))` }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}

/** compact: в узкой строке «Inner Circle» → «Inner» (полное имя — в title) */
function CircleBadge({ circleKey, title, compact = false }: { circleKey: CircleKey; title: string; compact?: boolean }) {
  const short = title.replace(/\s+circle$/i, "");
  return (
    <span
      title={compact ? title : undefined}
      className={`inline-block max-w-full truncate rounded-full border px-2.5 py-0.5 align-middle text-[10px] uppercase leading-4 tracking-[0.18em] ${CIRCLE_BADGE[circleKey]}`}
    >
      {compact && short !== title ? (
        <>
          <span className="lb-badge-full">{title}</span>
          <span className="lb-badge-short">{short}</span>
        </>
      ) : (
        title
      )}
    </span>
  );
}

function YouTag({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200/40 bg-amber-200/[0.08] px-2 py-px text-[10px] font-medium uppercase tracking-[0.16em] text-amber-100">
      {label}
    </span>
  );
}

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: number | string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-zinc-500" title={label}>
      <Icon size={13} strokeWidth={1.4} aria-hidden className="text-zinc-600" />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

/* ── Ваше место ───────────────────────────────────────────────────── */

function Standing({ me, ranked, t }: { me: LeaderboardEntry; ranked: LeaderboardEntry[]; t: Text }) {
  const isRanked = me.influence > 0;
  const tenth = ranked.length >= TOP ? ranked[TOP - 1] : null;
  const inTop = isRanked && me.position <= TOP;

  // ближайшая соседка выше (строго больше Индекс) и ниже
  const above = [...ranked].reverse().find((e) => e.influence > me.influence) ?? null;
  const below = ranked.find((e) => e.influence < me.influence) ?? null;
  const sharesFirst = isRanked && me.position === 1 && ranked.some((e) => e.profileId !== me.profileId && e.influence === me.influence);

  let headline: string;
  let detail: string | null = null;
  let progress: number | null = null;
  if (!isRanked) {
    headline = tenth ? t.firstStamp : t.firstStampTop;
    if (tenth) {
      detail = t.toTop(fmtPoints(tenth.influence));
      progress = 0;
    }
  } else if (me.position === 1) {
    headline = sharesFirst ? t.sharedFirst : t.leading;
    detail = !sharesFirst && below ? t.leadBy(fmtPoints(me.influence - below.influence)) : null;
    progress = 1;
  } else if (inTop) {
    headline = t.inTop;
    detail = above ? t.toNext(above.position, fmtPoints(above.influence - me.influence)) : null;
    progress = above ? me.influence / above.influence : 1;
  } else {
    const gap = tenth ? tenth.influence - me.influence : 0;
    headline = t.toTop(fmtPoints(gap));
    detail = above ? t.toNext(above.position, fmtPoints(above.influence - me.influence)) : null;
    progress = tenth && tenth.influence > 0 ? me.influence / tenth.influence : 0;
  }

  return (
    <section
      aria-label={t.yourStanding}
      className={`lb-standing rounded-2xl px-5 py-5 sm:px-7 sm:py-6 ${inTop ? "lb-gilt" : "border border-zinc-800/80 bg-zinc-900/40"}`}
    >
      <div className="flex items-center gap-4">
        <Avatar src={me.avatarUrl} name={displayName(me, t)} size={56} ring={inTop ? "ring-amber-200/70" : CIRCLE_RING[me.circleKey]} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">{t.yourStanding}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className={`${cormorant.className} text-5xl font-medium leading-none tabular-nums ${inTop ? "lb-gold-text" : "text-zinc-50"}`}>
              {isRanked ? `№ ${me.position}` : "—"}
            </span>
            {isRanked && <span className="text-xs text-zinc-500">{t.of(ranked.length)}</span>}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <p className={`${cormorant.className} text-3xl font-medium leading-none lining-nums tabular-nums text-zinc-50`}>{fmtPoints(me.influence)}</p>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.24em] text-zinc-500">Influence Index</p>
        <div className="mt-2.5">
          <CircleBadge circleKey={me.circleKey} title={me.circleTitle} />
        </div>
      </div>

      <div className="lb-standing-goal min-w-0">
        <p className={`flex items-center gap-2 text-sm ${inTop ? "text-amber-100" : "text-zinc-200"}`}>
          {inTop && <Crown size={15} strokeWidth={1.4} aria-hidden className="shrink-0 text-amber-200" />}
          {headline}
        </p>
        {detail && <p className="mt-1 text-xs tabular-nums text-zinc-500">{detail}</p>}
        {progress !== null && (
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-zinc-800" aria-hidden>
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${inTop ? "bg-amber-200/80" : "bg-zinc-300/70"}`}
              style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Пьедестал ────────────────────────────────────────────────────── */

function PodiumCard({ e, slot, me, t }: { e: LeaderboardEntry; slot: 1 | 2 | 3; me: boolean; t: Text }) {
  const look = PLACE[slot - 1];
  const name = displayName(e, t);
  const first = slot === 1;
  return (
    <li
      data-slot={slot}
      aria-current={me ? "true" : undefined}
      className={`lb-pod ${first ? "lb-gilt lb-sheen" : "lb-gilt-soft"} ${look.glow}`}
    >
      <span className="lb-pod-numeral">
        {first && <Crown size={16} strokeWidth={1.3} aria-hidden className="mb-1 text-amber-200/90" />}
        <span aria-hidden className={`${cormorant.className} ${first ? "text-4xl" : "text-3xl"} font-medium italic leading-none ${look.numeral}`}>
          {roman(e.position)}
        </span>
        <span className="sr-only">№ {e.position}</span>
      </span>
      <span className="lb-pod-avatar">
        <Avatar src={e.avatarUrl} name={name} size="var(--av)" ring={look.ring} />
      </span>
      <span className="lb-pod-meta">
        <span className={`${cormorant.className} lb-pod-name font-medium text-zinc-50`}>{name}</span>
        <span className="flex max-w-full flex-wrap items-center gap-1.5">
          <CircleBadge circleKey={e.circleKey} title={e.circleTitle} />
          {me && <YouTag label={t.you} />}
        </span>
        <span className="lb-pod-score mt-1">
          <span className={`${cormorant.className} lb-pod-value font-medium lining-nums tabular-nums text-zinc-50`}>
            {fmtPoints(e.influence)}
          </span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.26em] text-zinc-500">Influence Index</span>
        </span>
      </span>
    </li>
  );
}

/* ── Строка рейтинга ──────────────────────────────────────────────── */

function RankRow({ e, me, elite, t }: { e: LeaderboardEntry; me: boolean; elite: boolean; t: Text }) {
  const name = displayName(e, t);
  return (
    <li
      id={`lb-row-${e.profileId}`}
      aria-current={me ? "true" : undefined}
      className={`lb-row relative transition-colors ${
        me ? "bg-amber-200/[0.06]" : elite ? "hover:bg-amber-200/[0.025]" : "hover:bg-zinc-900/60"
      }`}
    >
      {me && <span aria-hidden className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-amber-200/80" />}
      <span className={`lb-row-pos ${cormorant.className} text-xl font-medium italic tabular-nums ${elite ? "lb-gold-text" : "text-zinc-500"}`}>
        <span aria-hidden>{pad2(e.position)}</span>
        <span className="sr-only">№ {e.position}</span>
      </span>
      <span className="lb-row-ava">
        <Avatar src={e.avatarUrl} name={name} size={elite ? 40 : 36} ring={CIRCLE_RING[e.circleKey]} />
      </span>
      <span className="lb-row-name flex min-w-0 items-center gap-2">
        <span className={`truncate ${elite ? `${cormorant.className} text-lg font-medium leading-tight text-zinc-50` : "text-sm text-zinc-200"}`}>
          {name}
        </span>
        {me && <YouTag label={t.you} />}
      </span>
      <span className="lb-row-badge flex">
        <CircleBadge circleKey={e.circleKey} title={e.circleTitle} compact />
      </span>
      <span className="lb-row-stats items-center">
        <Stat icon={Stamp} value={e.stamps} label={t.stamps} />
        {e.tourPoints ? <Stat icon={Plane} value={fmtPoints(e.tourPoints)} label={t.tourPoints} /> : <span aria-hidden />}
        {e.proteges > 0 ? <Stat icon={KeyRound} value={e.proteges} label={t.proteges} /> : <span aria-hidden />}
      </span>
      <span className="lb-row-idx">
        <span
          className={`${cormorant.className} block text-xl font-medium leading-none lining-nums tabular-nums ${elite ? "text-zinc-50" : "text-zinc-300"}`}
        >
          {fmtPoints(e.influence)}
        </span>
      </span>
    </li>
  );
}

/* ── Страница ─────────────────────────────────────────────────────── */

export default function LeaderboardClient({
  data,
  onRefresh,
  refreshing = false,
}: {
  data: LeaderboardData;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}) {
  const ctx: unknown = useLanguage();
  const lang = normalizeLang(ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).lang : ctx);
  const t = TEXT[lang];

  const { ranked, podium, ten, rest, me, unranked, threshold } = useMemo(() => {
    const ranked = data.entries.filter((e) => e.influence > 0);
    const elite = ranked.filter((e) => e.position <= TOP);
    const podium = elite.filter((e) => e.position <= PODIUM).slice(0, PODIUM);
    const podiumIds = new Set(podium.map((e) => e.profileId));
    return {
      ranked,
      podium,
      ten: elite.filter((e) => !podiumIds.has(e.profileId)),
      rest: ranked.filter((e) => e.position > TOP),
      me: data.meId ? (data.entries.find((e) => e.profileId === data.meId) ?? null) : null,
      unranked: data.entries.length - ranked.length,
      threshold: elite.length ? elite[elite.length - 1].influence : null,
    };
  }, [data]);

  const [shown, setShown] = useState(PAGE);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const meRestIndex = me ? rest.findIndex((e) => e.profileId === me.profileId) : -1;

  useEffect(() => {
    if (!scrollTo) return;
    const el = document.getElementById(`lb-row-${scrollTo}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollTo(null);
  }, [scrollTo, shown]);

  const findMe = () => {
    if (!me) return;
    if (meRestIndex >= shown) setShown(Math.ceil((meRestIndex + 1) / PAGE) * PAGE);
    setScrollTo(me.profileId);
  };

  const time = useMemo(() => {
    try {
      return new Date(data.updatedAt).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [data.updatedAt, t.locale]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <style>{STYLES}</style>
      <div className="lb-root mx-auto w-full max-w-5xl px-4 pb-20 pt-10 sm:px-8 sm:pt-14">
        {/* ── Заголовок ── */}
        <header>
          <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-amber-200/70">
            <span aria-hidden className="h-px w-8 bg-amber-200/40" />
            Voyage · Influence Index
          </p>
          <h1 className={`${cormorant.className} mt-4 text-4xl font-medium leading-[1.05] tracking-wide text-zinc-50 sm:text-5xl`}>
            {t.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">{t.lede}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
            <span className="tabular-nums">{t.ranked(ranked.length)}</span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-200/50 motion-reduce:animate-none" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-200/80" />
              </span>
              {time && t.updated(time)}
            </span>
            {onRefresh && (
              <button
                type="button"
                onClick={() => void onRefresh()}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-2.5 py-1 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40"
              >
                <RefreshCw size={12} strokeWidth={1.5} aria-hidden className={refreshing ? "animate-spin" : ""} />
                {t.refresh}
              </button>
            )}
          </div>
        </header>

        {/* ── Ваше место ── */}
        <div className="mt-10">
          {me ? (
            <Standing me={me} ranked={ranked} t={t} />
          ) : (
            <p className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 text-xs text-zinc-500">{t.staffNote}</p>
          )}
        </div>

        {ranked.length === 0 ? (
          <section className="lb-gilt-soft mt-10 rounded-2xl px-6 py-12 text-center">
            <Crown size={28} strokeWidth={1.1} aria-hidden className="mx-auto text-amber-200/70" />
            <h2 className={`${cormorant.className} mt-4 text-3xl font-medium text-zinc-50`}>{t.emptyTitle}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-400">{t.emptyBody}</p>
          </section>
        ) : (
          <>
            {/* ── Пьедестал ── */}
            <ol className="lb-podium mt-12" aria-label="Top 3">
              {podium.map((e, i) => (
                <PodiumCard key={e.profileId} e={e} slot={(i + 1) as 1 | 2 | 3} me={e.profileId === data.meId} t={t} />
              ))}
            </ol>

            {/* ── Первая десятка ── */}
            {ten.length > 0 && (
              <section className="mt-12" aria-labelledby="lb-ten">
                <div className="flex items-center gap-4">
                  <span aria-hidden className="lb-rule-l h-px flex-1" />
                  <p className="text-[10px] uppercase tracking-[0.32em] text-amber-200/70">Top 10</p>
                  <span aria-hidden className="lb-rule-r h-px flex-1" />
                </div>
                <h2 id="lb-ten" className={`${cormorant.className} mt-3 text-center text-3xl font-medium text-zinc-50`}>
                  {t.topTitle}
                </h2>
                {threshold !== null && (
                  <p className="mt-1.5 text-center text-xs tabular-nums text-zinc-500">{t.topCaption(fmtPoints(threshold))}</p>
                )}
                <ol className="lb-gilt-soft mt-6 divide-y divide-amber-200/[0.07] overflow-hidden rounded-2xl">
                  {ten.map((e) => (
                    <RankRow key={e.profileId} e={e} me={e.profileId === data.meId} elite t={t} />
                  ))}
                </ol>
              </section>
            )}

            {/* ── Весь рейтинг ── */}
            {rest.length > 0 && (
              <section className="mt-14" aria-labelledby="lb-rest">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 id="lb-rest" className={`${cormorant.className} text-2xl font-medium text-zinc-100`}>
                    {t.restTitle}
                  </h2>
                  {me && meRestIndex >= 0 && (
                    <button
                      type="button"
                      onClick={findMe}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/25 px-3 py-1 text-xs text-amber-100/90 transition-colors hover:bg-amber-200/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40"
                    >
                      <LocateFixed size={13} strokeWidth={1.5} aria-hidden />
                      {t.findMe}
                    </button>
                  )}
                </div>
                <ol className="mt-4 divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/20">
                  {rest.slice(0, shown).map((e) => (
                    <RankRow key={e.profileId} e={e} me={e.profileId === data.meId} elite={false} t={t} />
                  ))}
                </ol>
                {rest.length > shown && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShown((s) => s + PAGE)}
                      className="rounded-full border border-zinc-800 px-4 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40"
                    >
                      {t.showMore(Math.min(PAGE, rest.length - shown))}
                    </button>
                  </div>
                )}
              </section>
            )}

            {unranked > 0 && <p className="mt-6 text-center text-xs text-zinc-600">{t.notStarted(unranked)}</p>}
          </>
        )}

        {/* ── Как считается ── */}
        <section className="mt-16 border-t border-zinc-800/70 pt-10" aria-labelledby="lb-how">
          <h2 id="lb-how" className={`${cormorant.className} text-2xl font-medium text-zinc-100`}>
            {t.howTitle}
          </h2>
          <ul className="lb-how mt-5">
            {[
              { icon: Stamp, text: t.howStamps },
              { icon: Plane, text: t.howTours },
              { icon: Gem, text: t.howCombos },
              { icon: KeyRound, text: t.howPatronage },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/30 px-4 py-3.5">
                <Icon size={16} strokeWidth={1.3} aria-hidden className="mt-0.5 shrink-0 text-amber-200/70" />
                <span className="text-xs leading-relaxed text-zinc-400">{text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-zinc-500">{t.toursNote}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { href: "/dashboard/tours", label: t.toursLink },
              { href: "/dashboard/gamification", label: t.passportLink },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-amber-200/30 hover:text-amber-100"
              >
                {l.label}
                <ArrowUpRight size={12} strokeWidth={1.5} aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}