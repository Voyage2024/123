"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ПУЛЬС — app/(dashboard)/partner/pulse/page.tsx
 *
 * Разведка: репутация менеджера — только факты внутри Voyage.
 *   Show Rate    доля подтверждённых участниц, которые долетели (12 мес.)
 *                + столбцы по месяцам: долетели / срыв, подсказка и таблица
 *   Цифры        оценка резиденток, отзывы, туры за 12 мес., срывы с заменой
 *   Оценить      участницы закрытых туров без оценки — звёзды и только
 *                профессиональные критерии; отзыв уходит на модерацию
 *   О вас        что отмечают резидентки и их отзывы — без имени автора
 *   Участницы    с кем вы летали чаще всего, их Trusted
 *
 * Данные: _lib/pulse.ts (демо). Отправка отзыва пока имитируется.
 * ──────────────────────────────────────────────────────────────────── */

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Check,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  MessageSquareQuote,
  PlaneLanding,
  RefreshCw,
  Star,
  Users,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { ROUTES } from "../_lib/routes";
import type { ReviewTag } from "../_lib/command";
import { pl, ru, usePartnerFormat, type Common, type Fmt } from "../_lib/format";
import {
  buildPulseMock,
  type CrewStat,
  type ManagerCriterion,
  type PendingReview,
  type PulseData,
  type PulseMonth,
} from "../_lib/pulse";
import { Stars, TrustBadge } from "../_components/TrustSignals";
import {
  BTN_GHOST,
  BTN_GOLD,
  LINK_SUBTLE,
  PageHeader,
  PageShell,
  Panel,
  Pill,
  SectionHeader,
  StatStrip,
  cormorant,
  initials,
} from "../_components/PartnerUI";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type Dict = {
  eyebrow: string;
  title: string;
  subtitle: string;
  showRate: { label: string; caption: (flown: number, total: number) => string; empty: string };
  chart: {
    title: string;
    flown: string;
    dropped: string;
    tip: (flown: number, dropped: number) => string;
    month: string;
  };
  stats: { rating: string; reviews: string; tours: string; replacements: string };
  pending: {
    eyebrow: string;
    title: string;
    empty: string;
    returned: (ago: string) => string;
    rate: string;
    criteriaHint: string;
    comment: string;
    commentHint: string;
    send: string;
    sending: string;
    cancel: string;
    sent: string;
    stars: (n: number) => string;
  };
  tags: Record<ReviewTag, string>;
  about: { eyebrow: string; title: string; of: (n: number, total: number) => string };
  criteria: Record<ManagerCriterion, string>;
  feedback: { eyebrow: string; title: string; anonymous: string; empty: string };
  crew: { eyebrow: string; title: string; tours: (n: number) => string; last: (ago: string) => string; empty: string };
  keysLink: string;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Intelligence · Pulse",
    title: "Pulse",
    subtitle: "Your reputation in the club — facts from inside Voyage only: crews that flew, drops and residents’ ratings.",
    showRate: {
      label: "Show Rate · 12 months",
      caption: (f, t) => `${f} of ${t} confirmed participants flew`,
      empty: "Appears after your first closed tour",
    },
    chart: {
      title: "Participants by month",
      flown: "Flew",
      dropped: "Drop",
      tip: (f, d) => `${f} flew · ${d} ${pl(d, "drop", "drops")}`,
      month: "Month",
    },
    stats: { rating: "Residents’ rating", reviews: "Reviews about you", tours: "Closed tours · 12 mo", replacements: "Drops covered by a replacement" },
    pending: {
      eyebrow: "After the tour",
      title: "Waiting for your rating",
      empty: "All participants of closed tours are rated.",
      returned: (a) => `back ${a}`,
      rate: "Rate",
      criteriaHint: "Professional criteria only — appearance is confirmed by Live Snaps.",
      comment: "Comment (optional)",
      commentHint: "Visible to the club and to the participant after moderation.",
      send: "Send for moderation",
      sending: "Sending…",
      cancel: "Cancel",
      sent: "Under moderation",
      stars: (n) => `${n} of 5`,
    },
    tags: {
      punctual: "Punctual",
      professional: "Professional",
      matchesSnaps: "Matches her snaps",
      communicative: "Responsive",
      teamPlayer: "Team player",
    },
    about: { eyebrow: "About you", title: "What residents note", of: (n, t) => `${n} of ${t}` },
    criteria: {
      payOnTime: "Pays on time",
      respectful: "Respectful",
      matchesBrief: "Tour matches the brief",
      organized: "Well organised",
      communicative: "Responsive",
    },
    feedback: { eyebrow: "Reviews", title: "Residents about you", anonymous: "Tour participant", empty: "No reviews yet." },
    crew: {
      eyebrow: "Your crews",
      title: "Who you fly with",
      tours: (n) => `${n} ${pl(n, "tour", "tours")} with you`,
      last: (a) => `last ${a}`,
      empty: "Participants appear after your first closed tour.",
    },
    keysLink: "How Pulse moves your Key",
  },
  RU: {
    eyebrow: "Разведка · Пульс",
    title: "Пульс",
    subtitle: "Ваша репутация в клубе — только факты внутри Voyage: долёты составов, срывы и оценки резиденток.",
    showRate: {
      label: "Show Rate · 12 месяцев",
      caption: (f, t) => `долетели ${f} из ${t} подтверждённых участниц`,
      empty: "Появится после первого закрытого тура",
    },
    chart: {
      title: "Участницы по месяцам",
      flown: "Долетели",
      dropped: "Срыв",
      tip: (f, d) => `долетели ${f} · ${d} ${ru(d, "срыв", "срыва", "срывов")}`,
      month: "Месяц",
    },
    stats: { rating: "Оценка резиденток", reviews: "Отзывы о вас", tours: "Закрыто туров · 12 мес", replacements: "Срывы закрыты заменой" },
    pending: {
      eyebrow: "После тура",
      title: "Ждут вашей оценки",
      empty: "Все участницы закрытых туров оценены.",
      returned: (a) => `вернулись ${a}`,
      rate: "Оценить",
      criteriaHint: "Только профессиональные критерии — внешность подтверждают Live Snaps.",
      comment: "Комментарий (необязательно)",
      commentHint: "Его увидят клуб и участница после модерации.",
      send: "Отправить на модерацию",
      sending: "Отправляем…",
      cancel: "Отмена",
      sent: "На модерации",
      stars: (n) => `${n} из 5`,
    },
    tags: {
      punctual: "Пунктуальна",
      professional: "Профессиональна",
      matchesSnaps: "Как на снапах",
      communicative: "На связи",
      teamPlayer: "Командная",
    },
    about: { eyebrow: "О вас", title: "Что отмечают резидентки", of: (n, t) => `${n} из ${t}` },
    criteria: {
      payOnTime: "Оплата вовремя",
      respectful: "Уважение",
      matchesBrief: "Тур как в брифе",
      organized: "Организация",
      communicative: "На связи",
    },
    feedback: { eyebrow: "Отзывы", title: "Резидентки о вас", anonymous: "Участница тура", empty: "Отзывов пока нет." },
    crew: {
      eyebrow: "Ваши составы",
      title: "С кем вы летаете",
      tours: (n) => `${n} ${ru(n, "тур", "тура", "туров")} с вами`,
      last: (a) => `последний ${a}`,
      empty: "Участницы появятся после первого закрытого тура.",
    },
    keysLink: "Как Пульс влияет на Ключ",
  },
  ES: {
    eyebrow: "Inteligencia · Pulse",
    title: "Pulse",
    subtitle: "Tu reputación en el club: solo hechos dentro de Voyage, equipos que viajaron, bajas y valoraciones de las residentes.",
    showRate: {
      label: "Show Rate · 12 meses",
      caption: (f, t) => `viajaron ${f} de ${t} participantes confirmadas`,
      empty: "Aparece tras tu primer tour cerrado",
    },
    chart: {
      title: "Participantes por mes",
      flown: "Viajaron",
      dropped: "Baja",
      tip: (f, d) => `viajaron ${f} · ${d} ${pl(d, "baja", "bajas")}`,
      month: "Mes",
    },
    stats: { rating: "Valoración de residentes", reviews: "Reseñas sobre ti", tours: "Tours cerrados · 12 m", replacements: "Bajas cubiertas con reemplazo" },
    pending: {
      eyebrow: "Tras el tour",
      title: "Esperan tu valoración",
      empty: "Todas las participantes de tours cerrados están valoradas.",
      returned: (a) => `volvieron ${a}`,
      rate: "Valorar",
      criteriaHint: "Solo criterios profesionales: la apariencia la confirman los Live Snaps.",
      comment: "Comentario (opcional)",
      commentHint: "Lo verán el club y la participante tras la moderación.",
      send: "Enviar a moderación",
      sending: "Enviando…",
      cancel: "Cancelar",
      sent: "En moderación",
      stars: (n) => `${n} de 5`,
    },
    tags: {
      punctual: "Puntual",
      professional: "Profesional",
      matchesSnaps: "Como en sus snaps",
      communicative: "Responde rápido",
      teamPlayer: "Trabaja en equipo",
    },
    about: { eyebrow: "Sobre ti", title: "Lo que destacan las residentes", of: (n, t) => `${n} de ${t}` },
    criteria: {
      payOnTime: "Paga a tiempo",
      respectful: "Respeto",
      matchesBrief: "Tour fiel al brief",
      organized: "Buena organización",
      communicative: "Responde rápido",
    },
    feedback: { eyebrow: "Reseñas", title: "Las residentes sobre ti", anonymous: "Participante del tour", empty: "Aún no hay reseñas." },
    crew: {
      eyebrow: "Tus equipos",
      title: "Con quién viajas",
      tours: (n) => `${n} ${pl(n, "tour", "tours")} contigo`,
      last: (a) => `último ${a}`,
      empty: "Las participantes aparecen tras tu primer tour cerrado.",
    },
    keysLink: "Cómo Pulse mueve tu Llave",
  },
  PT: {
    eyebrow: "Inteligência · Pulse",
    title: "Pulse",
    subtitle: "Sua reputação no clube: só fatos dentro do Voyage, equipes que embarcaram, desistências e avaliações das residentes.",
    showRate: {
      label: "Show Rate · 12 meses",
      caption: (f, t) => `embarcaram ${f} de ${t} participantes confirmadas`,
      empty: "Aparece após seu primeiro tour encerrado",
    },
    chart: {
      title: "Participantes por mês",
      flown: "Embarcaram",
      dropped: "Desistência",
      tip: (f, d) => `embarcaram ${f} · ${d} ${pl(d, "desistência", "desistências")}`,
      month: "Mês",
    },
    stats: { rating: "Avaliação das residentes", reviews: "Avaliações sobre você", tours: "Tours encerrados · 12 m", replacements: "Desistências cobertas por substituta" },
    pending: {
      eyebrow: "Depois do tour",
      title: "Aguardam sua avaliação",
      empty: "Todas as participantes de tours encerrados foram avaliadas.",
      returned: (a) => `voltaram ${a}`,
      rate: "Avaliar",
      criteriaHint: "Só critérios profissionais: a aparência é confirmada pelos Live Snaps.",
      comment: "Comentário (opcional)",
      commentHint: "O clube e a participante verão após a moderação.",
      send: "Enviar para moderação",
      sending: "Enviando…",
      cancel: "Cancelar",
      sent: "Em moderação",
      stars: (n) => `${n} de 5`,
    },
    tags: {
      punctual: "Pontual",
      professional: "Profissional",
      matchesSnaps: "Igual aos snaps",
      communicative: "Responde rápido",
      teamPlayer: "Trabalha em equipe",
    },
    about: { eyebrow: "Sobre você", title: "O que as residentes destacam", of: (n, t) => `${n} de ${t}` },
    criteria: {
      payOnTime: "Paga em dia",
      respectful: "Respeito",
      matchesBrief: "Tour fiel ao brief",
      organized: "Boa organização",
      communicative: "Responde rápido",
    },
    feedback: { eyebrow: "Avaliações", title: "As residentes sobre você", anonymous: "Participante do tour", empty: "Ainda não há avaliações." },
    crew: {
      eyebrow: "Suas equipes",
      title: "Com quem você viaja",
      tours: (n) => `${n} ${pl(n, "tour", "tours")} com você`,
      last: (a) => `último ${a}`,
      empty: "As participantes aparecem após seu primeiro tour encerrado.",
    },
    keysLink: "Como o Pulse move sua Chave",
  },
};

const REVIEW_TAGS: ReviewTag[] = ["punctual", "professional", "matchesSnaps", "communicative", "teamPlayer"];

/* ══════════════════════════════════════════════════════════════════
 * SHOW RATE + СТОЛБЦЫ ПО МЕСЯЦАМ
 * ══════════════════════════════════════════════════════════════════ */

function ShowRateRing({ flown, total, t }: { flown: number; total: number; t: Dict }) {
  const gradientId = `sr-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rate = total > 0 ? Math.round((flown / total) * 100) : null;
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-5">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 120 120" className="size-32 -rotate-90" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgb(39 39 42)" strokeWidth="6" />
          {rate !== null && (
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - rate / 100)}
              className="transition-[stroke-dashoffset] duration-700"
            />
          )}
        </svg>
        <span className={`${cormorant.className} absolute inset-0 flex items-center justify-center text-4xl font-semibold text-zinc-50`}>
          {rate !== null ? `${rate}%` : "—"}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.showRate.label}</p>
        <p className="mt-2 text-sm leading-snug text-zinc-200">{rate !== null ? t.showRate.caption(flown, total) : t.showRate.empty}</p>
      </div>
    </div>
  );
}

const CHART_H = 140;

/**
 * Участницы по месяцам вылета: долетели (amber-600) и срыв (rose-600) —
 * пара проверена на различимость при дальтонизме. Срыв лежит сверху
 * через зазор 2 px; у каждого столбца подсказка по наведению и фокусу,
 * те же цифры — в таблице под графиком.
 */
function MonthlyChart({ months, t, cm, fmt }: { months: PulseMonth[]; t: Dict; cm: Common; fmt: Fmt }) {
  const [active, setActive] = useState<number | null>(null);

  // Границы месяцев зависят от часового пояса — рисуем только на клиенте,
  // иначе разметка сервера и браузера разойдётся при гидрации
  if (!fmt.ready) {
    return <div aria-hidden className="animate-pulse rounded-xl bg-zinc-800/30" style={{ height: CHART_H + 64 }} />;
  }

  const peak = Math.max(1, ...months.map((m) => m.flown + m.dropped));
  const top = Math.max(2, Math.ceil(peak / 2) * 2);
  const ticks = [0, top / 2, top];
  const label = (m: PulseMonth, o: Intl.DateTimeFormatOptions) => fmt.date(m.start, o);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300">{t.chart.title}</p>
        <ul className="flex items-center gap-4 text-[11px] text-zinc-400">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px] bg-amber-600" />
            {t.chart.flown}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px] bg-rose-600" />
            {t.chart.dropped}
          </li>
        </ul>
      </div>

      <div className="mt-4 flex gap-2">
        {/* ось Y */}
        <div className="relative w-4 shrink-0 text-right text-[10px] tabular-nums text-zinc-500" style={{ height: CHART_H }}>
          {ticks.map((v) => (
            <span key={v} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(v / top) * 100}%` }}>
              {v}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: CHART_H }}>
            {ticks.map((v) => (
              <div key={v} aria-hidden className="absolute inset-x-0 h-px bg-zinc-800" style={{ bottom: `${(v / top) * 100}%` }} />
            ))}

            <div className="absolute inset-0 flex items-end">
              {months.map((m, i) => {
                const total = m.flown + m.dropped;
                const name = label(m, { month: "long", year: "numeric" });
                const tip = t.chart.tip(m.flown, m.dropped);
                return (
                  <div
                    key={m.start}
                    tabIndex={0}
                    role="img"
                    aria-label={`${name}: ${tip}`}
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive((a) => (a === i ? null : a))}
                    className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end rounded-md outline-none focus-visible:bg-zinc-800/40"
                  >
                    {total > 0 && (
                      <div
                        className={`flex w-[min(24px,62%)] flex-col gap-[2px] transition-opacity ${
                          active !== null && active !== i ? "opacity-50" : "opacity-100"
                        }`}
                        style={{ height: `${(total / top) * 100}%` }}
                      >
                        {m.dropped > 0 && (
                          <div className="w-full shrink-0 rounded-t-[4px] bg-rose-600" style={{ flexGrow: m.dropped, minHeight: 4 }} />
                        )}
                        {m.flown > 0 && (
                          <div
                            className={`w-full bg-amber-600 ${m.dropped > 0 ? "" : "rounded-t-[4px]"}`}
                            style={{ flexGrow: m.flown }}
                          />
                        )}
                      </div>
                    )}

                    {active === i && (
                      <div
                        role="presentation"
                        className={`pointer-events-none absolute z-10 w-max max-w-[11rem] rounded-lg border border-zinc-700/80 bg-zinc-950/95 px-2.5 py-2 text-[11px] shadow-xl backdrop-blur ${
                          i < 2 ? "left-0" : i > months.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                        }`}
                        style={{ bottom: `calc(${(Math.max(total, 0.5) / top) * 100}% + 8px)` }}
                      >
                        <p className="text-zinc-400 first-letter:uppercase">{name}</p>
                        <p className="mt-1 flex items-center gap-1.5">
                          <span aria-hidden className="h-0.5 w-3 rounded-full bg-amber-600" />
                          <span className="font-semibold text-zinc-50">{m.flown}</span>
                          <span className="text-zinc-400">{t.chart.flown}</span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5">
                          <span aria-hidden className="h-0.5 w-3 rounded-full bg-rose-600" />
                          <span className="font-semibold text-zinc-50">{m.dropped}</span>
                          <span className="text-zinc-400">{t.chart.dropped}</span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ось X: месяцы */}
          <div aria-hidden className="mt-2 flex">
            {months.map((m, i) => (
              // на узком экране — каждый второй месяц, подпись может выйти за свой столбец
              <span
                key={m.start}
                className={`flex-1 whitespace-nowrap text-center text-[10px] text-zinc-500 ${i % 2 === 1 ? "max-sm:invisible" : ""}`}
              >
                {label(m, { month: "short" }).replace(".", "")}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="group/table mt-4">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-amber-200 sm:min-h-0 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 transition-transform group-open/table:rotate-90" aria-hidden />
          {cm.table}
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800/80">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">{t.chart.month}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t.chart.flown}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t.chart.dropped}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 tabular-nums">
              {months.map((m) => (
                <tr key={m.start}>
                  <th scope="row" className="px-3 py-1.5 font-normal text-zinc-300 first-letter:uppercase">
                    {label(m, { month: "long", year: "numeric" })}
                  </th>
                  <td className="px-3 py-1.5 text-right text-zinc-100">{m.flown}</td>
                  <td className={`px-3 py-1.5 text-right ${m.dropped > 0 ? "text-rose-200" : "text-zinc-500"}`}>{m.dropped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ОЦЕНКА УЧАСТНИЦЫ
 * ══════════════════════════════════════════════════════════════════ */

function StarPicker({ value, onChange, t, label }: { value: number; onChange: (n: number) => void; t: Dict; label: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center" onPointerLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t.pending.stars(n)}
          onClick={() => onChange(n)}
          onPointerEnter={() => setHover(n)}
          className="flex size-11 items-center justify-center rounded-full transition hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 sm:size-9"
        >
          <Star
            className={`size-5 transition ${n <= shown ? "fill-amber-200 text-amber-200" : "text-zinc-600"}`}
            strokeWidth={1.5}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}

type ReviewState = "idle" | "open" | "sending" | "sent";

function ReviewRow({ p, t }: { p: PendingReview["participants"][number]; t: Dict }) {
  const [state, setState] = useState<ReviewState>("idle");
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState("");
  const formId = useId();

  const toggle = (tag: ReviewTag) => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  // Пока бэкенда нет — имитация. Подключение: insert в partner_reviews
  // (tour_id, subject_id, direction 'manager_to_resident', rating, tags, comment)
  const submit = () => {
    setState("sending");
    window.setTimeout(() => setState("sent"), 900);
  };

  return (
    <li className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={ROUTES.resident(p.id)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition-colors hover:text-amber-100"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-gradient-to-br from-amber-200/25 to-zinc-800">
            <span className={`${cormorant.className} text-base font-semibold text-amber-100`}>{initials(p.name)}</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-zinc-100">{p.name}</span>
            <span className="mt-1 block">
              <TrustBadge trust={p.trust} />
            </span>
          </span>
        </Link>
        {state === "sent" ? (
          <Pill tone="emerald" icon={Check}>
            {t.pending.sent}
          </Pill>
        ) : (
          state === "idle" && (
            <button type="button" className={BTN_GHOST} onClick={() => setState("open")}>
              <Star className="size-3.5" aria-hidden />
              {t.pending.rate}
            </button>
          )
        )}
      </div>

      {(state === "open" || state === "sending") && (
        <form
          id={formId}
          className="mt-3 border-t border-zinc-800/70 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating > 0 && state === "open") submit();
          }}
        >
          <StarPicker value={rating} onChange={setRating} t={t} label={`${t.pending.rate}: ${p.name}`} />

          <div className="mt-2 flex flex-wrap gap-1.5">
            {REVIEW_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(tag)}
                  className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[11px] transition sm:min-h-8 ${
                    on
                      ? "border-amber-200/50 bg-amber-200/15 text-amber-100"
                      : "border-zinc-700/80 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {on && <Check className="size-3" aria-hidden />}
                  {t.tags[tag]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">{t.pending.criteriaHint}</p>

          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.pending.comment}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 280))}
              rows={2}
              className="mt-1.5 w-full resize-y rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/40 focus:outline-none focus:ring-2 focus:ring-amber-200/20"
            />
            <span className="mt-1 flex justify-between gap-3 text-[11px] text-zinc-500">
              <span>{t.pending.commentHint}</span>
              <span className="tabular-nums">{comment.length}/280</span>
            </span>
          </label>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className={BTN_GHOST} onClick={() => setState("idle")} disabled={state === "sending"}>
              {t.pending.cancel}
            </button>
            <button type="submit" className={BTN_GOLD} disabled={rating === 0 || state === "sending"} aria-busy={state === "sending"}>
              {state === "sending" ? (
                <>
                  <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
                  {t.pending.sending}
                </>
              ) : (
                t.pending.send
              )}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function PendingPanel({ pending, t, cm, fmt }: { pending: PendingReview[]; t: Dict; cm: Common; fmt: Fmt }) {
  const total = pending.reduce((s, p) => s + p.participants.length, 0);
  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.pending.eyebrow} title={t.pending.title} icon={ClipboardCheck} count={total} />
      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">{t.pending.empty}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {pending.map((tour) => (
            <div key={tour.tourId}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <Link
                  href={ROUTES.dealRoom(tour.tourId)}
                  className={`${cormorant.className} text-lg font-medium text-zinc-100 transition-colors hover:text-amber-100`}
                >
                  {fmt.city(tour.city)} · {cm.projects[tour.project]}
                </Link>
                <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <PlaneLanding className="size-3" aria-hidden />
                  {t.pending.returned(fmt.ago(tour.returnedAt))}
                </span>
              </div>
              <ul className="mt-2 space-y-2">
                {tour.participants.map((p) => (
                  <ReviewRow key={p.id} p={p} t={t} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * О ВАС · УЧАСТНИЦЫ
 * ══════════════════════════════════════════════════════════════════ */

function CriteriaPanel({
  criteria,
  reviews,
  t,
}: {
  criteria: { key: ManagerCriterion; count: number }[];
  reviews: number;
  t: Dict;
}) {
  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.about.eyebrow} title={t.about.title} icon={Activity} />
      <ul className="mt-5 space-y-3.5">
        {criteria.map((c) => {
          const pct = reviews > 0 ? (c.count / reviews) * 100 : 0;
          return (
            <li key={c.key}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-zinc-200">{t.criteria[c.key]}</span>
                <span className="shrink-0 tabular-nums text-zinc-500">{t.about.of(c.count, reviews)}</span>
              </div>
              <div
                role="meter"
                aria-label={t.criteria[c.key]}
                aria-valuemin={0}
                aria-valuemax={reviews}
                aria-valuenow={c.count}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-950/60"
              >
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-200" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function FeedbackPanel({ data, t, cm, fmt }: { data: PulseData; t: Dict; cm: Common; fmt: Fmt }) {
  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.feedback.eyebrow} title={t.feedback.title} icon={MessageSquareQuote} />
      {data.feedback.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">{t.feedback.empty}</p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {data.feedback.map((f) => (
            <li
              key={f.id}
              className="rounded-xl border border-amber-200/10 bg-gradient-to-br from-amber-200/[0.05] via-zinc-900/30 to-transparent p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <Stars rating={f.rating} />
                <span className="text-[11px] text-zinc-500">{fmt.ago(f.at)}</span>
              </div>
              {f.quote && <p className={`${cormorant.className} mt-2 text-[15px] leading-snug text-zinc-100`}>«{f.quote}»</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {f.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-zinc-800 bg-zinc-900/70 px-2 py-0.5 text-[10px] text-zinc-300">
                    {t.criteria[tag]}
                  </span>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-zinc-500">
                {t.feedback.anonymous} · {fmt.city(f.city)} · {cm.projects[f.project]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CrewPanel({ crew, t, fmt }: { crew: CrewStat[]; t: Dict; fmt: Fmt }) {
  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.crew.eyebrow} title={t.crew.title} icon={Users} />
      {crew.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-400">{t.crew.empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800/70">
          {crew.map((c) => (
            <li key={c.id}>
              <Link
                href={ROUTES.resident(c.id)}
                className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-zinc-900/60"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-gradient-to-br from-amber-200/25 to-zinc-800">
                  <span className={`${cormorant.className} text-sm font-semibold text-amber-100`}>{initials(c.name)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-zinc-100 group-hover:text-amber-100">{c.name}</span>
                    <span className="shrink-0 text-[11px] text-zinc-500">{t.crew.tours(c.tours)}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <TrustBadge trust={c.trust} />
                    <span className="text-[11px] text-zinc-500">{t.crew.last(fmt.ago(c.lastAt))}</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function PartnerPulsePage() {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const [data] = useState(buildPulseMock);
  const m = data.manager;

  const stats = useMemo(
    () => [
      { label: t.stats.rating, value: m.rating !== null ? fmt.num(m.rating, 1) : "—", icon: Star, tone: "gold" as const },
      { label: t.stats.reviews, value: fmt.num(m.reviews), icon: MessageSquareQuote },
      { label: t.stats.tours, value: fmt.num(m.toursDone), icon: PlaneLanding },
      {
        label: t.stats.replacements,
        value: `${data.replacements.closed}/${data.replacements.total}`,
        icon: RefreshCw,
        tone: data.replacements.closed === data.replacements.total ? ("emerald" as const) : ("amber" as const),
      },
    ],
    [t, m, fmt, data.replacements],
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        demo={cm.demo}
        demoHint={cm.demoHint}
        actions={
          <Link href={ROUTES.keys} className={LINK_SUBTLE}>
            {t.keysLink}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        }
      />

      {/* Show Rate и месяцы */}
      <Panel className="mt-8 p-5 md:p-6">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] xl:items-center">
          <ShowRateRing flown={m.flown} total={m.confirmed} t={t} />
          <MonthlyChart months={data.months} t={t} cm={cm} fmt={fmt} />
        </div>
      </Panel>

      <StatStrip items={stats} />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <PendingPanel pending={data.pending} t={t} cm={cm} fmt={fmt} />
          <FeedbackPanel data={data} t={t} cm={cm} fmt={fmt} />
        </div>
        <div className="min-w-0 space-y-6">
          <CriteriaPanel criteria={data.criteria} reviews={m.reviews} t={t} />
          <CrewPanel crew={data.crew} t={t} fmt={fmt} />
        </div>
      </div>
    </PageShell>
  );
}
