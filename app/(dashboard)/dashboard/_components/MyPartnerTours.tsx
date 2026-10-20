"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Мои туры с менеджерами клуба
 * app/(dashboard)/dashboard/_components/MyPartnerTours.tsx
 *
 * Туры, в которые резидентка попала через кастинг: статус, итог, баллы
 * и честная оценка менеджера после возвращения. Отзыв анонимен для
 * менеджера (на Пульсе он видит только город, проект и теги) и уходит
 * на модерацию. Данные — RPC partner_resident_tours(), запись —
 * insert в partner_reviews (direction resident_to_manager) под RLS.
 * ──────────────────────────────────────────────────────────────────── */

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Plane, PlaneLanding, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Lang } from "@/app/context/LanguageContext";
import { PROJECTS, TIERS, list, num, obj, oneOf, str, time, type KeyTier, type ProjectKey } from "../../partner/_lib/command";
import { usePartnerFormat, type Fmt } from "../../partner/_lib/format";
import { usePartnerFeed } from "../../partner/_lib/usePartnerFeed";

type TourStatus = "confirmed" | "in_tour" | "closed";
type MyStatus = "confirmed" | "flown" | "released" | "late_drop" | "no_show";
type ManagerTag = "fair_terms" | "paid_on_time" | "safe" | "professional" | "communicative";

type MyTour = {
  id: string;
  city: string;
  project: ProjectKey;
  departsAt: number;
  returnsAt: number | null;
  tourStatus: TourStatus;
  myStatus: MyStatus;
  managerId: string | null;
  manager: { name: string | null; tier: KeyTier | null; rating: number | null };
  points: number | null;
  canReview: boolean;
  myReview: { rating: number; status: string } | null;
};

function parseTours(raw: unknown): MyTour[] {
  return list<MyTour>(obj(raw).tours, (r) => {
    const id = str(r.id);
    const project = oneOf(r.project, PROJECTS);
    const departsAt = time(r.departs_at);
    if (!id || !project || departsAt === null) return null;
    const m = obj(r.manager);
    const rv = r.my_review ? obj(r.my_review) : null;
    return {
      id,
      city: str(r.city) ?? "—",
      project,
      departsAt,
      returnsAt: time(r.returns_at),
      tourStatus: oneOf(r.tour_status, ["confirmed", "in_tour", "closed"] as const) ?? "confirmed",
      myStatus: oneOf(r.my_status, ["confirmed", "flown", "released", "late_drop", "no_show"] as const) ?? "confirmed",
      managerId: str(r.manager_id),
      manager: { name: str(m.name), tier: oneOf(m.tier, TIERS), rating: num(m.rating) },
      points: num(r.points),
      canReview: r.can_review === true,
      myReview: rv && num(rv.rating) !== null ? { rating: num(rv.rating) as number, status: str(rv.status) ?? "pending" } : null,
    };
  });
}

type Dict = {
  eyebrow: string;
  title: string;
  text: string;
  empty: string;
  tour: Record<TourStatus, string>;
  me: Record<MyStatus, string>;
  points: (n: number) => string;
  rate: string;
  tags: Record<ManagerTag, string>;
  comment: string;
  commentHint: string;
  send: string;
  cancel: string;
  sent: string;
  failed: string;
  yourRating: (n: number, pending: boolean) => string;
  history: string;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Tours with club managers",
    title: "My tours",
    text: "Everything you flew with managers through castings. After the tour, rate the manager — they see only the city, the project and your tags, never your name.",
    empty: "No tours yet. Reply “Ready” to a casting — once the handshake happens, the tour appears here.",
    tour: { confirmed: "Confirmed", in_tour: "On tour", closed: "Closed" },
    me: { confirmed: "In crew", flown: "Flew", released: "Released", late_drop: "Late drop", no_show: "No-show" },
    points: (n) => `+${n} points`,
    rate: "Rate the manager",
    tags: { fair_terms: "As in the brief", paid_on_time: "Paid on time", safe: "Felt safe", professional: "Well organised", communicative: "Responsive" },
    comment: "A few words (optional)",
    commentHint: "Moderated before it appears",
    send: "Send review",
    cancel: "Cancel",
    sent: "Thank you — the review is with the moderators.",
    failed: "Couldn’t send — try again.",
    yourRating: (n, p) => `Your rating: ${n}/5${p ? " · in moderation" : ""}`,
    history: "Points history",
  },
  RU: {
    eyebrow: "Туры с менеджерами клуба",
    title: "Мои туры",
    text: "Всё, куда вы летали с менеджерами через кастинги. После тура оцените менеджера — он увидит только город, проект и ваши теги, но не имя.",
    empty: "Туров пока нет. Ответьте «Готова» на кастинг — после рукопожатия тур появится здесь.",
    tour: { confirmed: "Подтверждён", in_tour: "В туре", closed: "Закрыт" },
    me: { confirmed: "В составе", flown: "Долетела", released: "Снята", late_drop: "Поздний срыв", no_show: "Неявка" },
    points: (n) => `+${n} баллов`,
    rate: "Оценить менеджера",
    tags: { fair_terms: "Как в брифе", paid_on_time: "Оплата вовремя", safe: "Было безопасно", professional: "Хорошая организация", communicative: "На связи" },
    comment: "Пара слов (необязательно)",
    commentHint: "Проходит модерацию перед публикацией",
    send: "Отправить отзыв",
    cancel: "Отмена",
    sent: "Спасибо — отзыв у модераторов.",
    failed: "Не удалось отправить — повторите.",
    yourRating: (n, p) => `Ваша оценка: ${n}/5${p ? " · на модерации" : ""}`,
    history: "История баллов",
  },
  ES: {
    eyebrow: "Tours con gerentes del club",
    title: "Mis tours",
    text: "Todo lo que volaste con gerentes a través de castings. Tras el tour, valora al gerente: solo verá la ciudad, el proyecto y tus etiquetas, nunca tu nombre.",
    empty: "Aún no hay tours. Responde «Lista» a un casting: tras el apretón de manos, el tour aparecerá aquí.",
    tour: { confirmed: "Confirmado", in_tour: "En tour", closed: "Cerrado" },
    me: { confirmed: "En el equipo", flown: "Voló", released: "Liberada", late_drop: "Baja tardía", no_show: "Ausencia" },
    points: (n) => `+${n} puntos`,
    rate: "Valorar al gerente",
    tags: { fair_terms: "Como en el brief", paid_on_time: "Pago puntual", safe: "Me sentí segura", professional: "Buena organización", communicative: "Disponible" },
    comment: "Unas palabras (opcional)",
    commentHint: "Se modera antes de publicarse",
    send: "Enviar reseña",
    cancel: "Cancelar",
    sent: "Gracias: la reseña está con moderación.",
    failed: "No se pudo enviar: inténtalo de nuevo.",
    yourRating: (n, p) => `Tu valoración: ${n}/5${p ? " · en moderación" : ""}`,
    history: "Historial de puntos",
  },
  PT: {
    eyebrow: "Tours com gerentes do clube",
    title: "Meus tours",
    text: "Tudo o que você voou com gerentes por castings. Depois do tour, avalie o gerente — ele vê só a cidade, o projeto e suas tags, nunca seu nome.",
    empty: "Ainda não há tours. Responda «Pronta» a um casting — depois do aperto de mão o tour aparece aqui.",
    tour: { confirmed: "Confirmado", in_tour: "Em tour", closed: "Fechado" },
    me: { confirmed: "Na equipe", flown: "Voou", released: "Liberada", late_drop: "Desistência tardia", no_show: "Ausência" },
    points: (n) => `+${n} pontos`,
    rate: "Avaliar o gerente",
    tags: { fair_terms: "Como no brief", paid_on_time: "Pagamento em dia", safe: "Me senti segura", professional: "Boa organização", communicative: "Disponível" },
    comment: "Algumas palavras (opcional)",
    commentHint: "Passa por moderação antes de publicar",
    send: "Enviar avaliação",
    cancel: "Cancelar",
    sent: "Obrigada — a avaliação está com a moderação.",
    failed: "Não foi possível enviar — tente de novo.",
    yourRating: (n, p) => `Sua avaliação: ${n}/5${p ? " · em moderação" : ""}`,
    history: "Histórico de pontos",
  },
};

const TAGS: ManagerTag[] = ["fair_terms", "paid_on_time", "safe", "professional", "communicative"];
const TIER_LABEL: Record<KeyTier, string> = { silver: "Silver Key", gold: "Gold Key", platinum: "Platinum Key" };

export default function MyPartnerTours() {
  const { lang, c, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const feed = usePartnerFeed("partner_resident_tours", parseTours);

  // нет миграции или роль не резидентка — блок просто не показываем
  if (!feed.data && feed.error) return null;

  return (
    <section className="rounded-3xl border border-zinc-800/80 bg-zinc-900/30 p-5 backdrop-blur-xl md:p-7">
      <p className="text-[10px] uppercase tracking-[0.35em] text-amber-200/70">{t.eyebrow}</p>
      <h2 className="mt-2 font-serif text-2xl font-light text-zinc-50 md:text-3xl">{t.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{t.text}</p>

      {!feed.data ? (
        <div className="mt-5 h-24 animate-pulse rounded-2xl border border-zinc-800/60 bg-zinc-900/40" aria-busy="true" aria-label={c.feed.loading} />
      ) : feed.data.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-400">{t.empty}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {feed.data.map((tour) => (
            <TourRow key={tour.id} tour={tour} t={t} fmt={fmt} projects={c.projects} onReviewed={feed.refresh} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TourRow({
  tour,
  t,
  fmt,
  projects,
  onReviewed,
}: {
  tour: MyTour;
  t: Dict;
  fmt: Fmt;
  projects: Record<ProjectKey, string>;
  onReviewed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<ManagerTag[]>([]);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const flown = tour.myStatus === "flown";
  const dropped = tour.myStatus === "late_drop" || tour.myStatus === "no_show";

  const submit = async () => {
    setState("sending");
    if (!tour.managerId) {
      setState("failed");
      return;
    }
    const { error } = await supabase.from("partner_reviews").insert({
      tour_id: tour.id,
      subject_id: tour.managerId,
      direction: "resident_to_manager",
      rating,
      tags,
      comment: comment.trim() ? comment.trim().slice(0, 280) : null,
    });
    if (error && error.code !== "23505") {
      setState("failed");
      return;
    }
    setState("sent");
    setOpen(false);
    onReviewed();
  };

  return (
    <li className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/[0.06] text-amber-200">
          {tour.tourStatus === "closed" ? <PlaneLanding className="size-4" strokeWidth={1.5} aria-hidden /> : <Plane className="size-4" strokeWidth={1.5} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-100">
            {fmt.city(tour.city)} · {projects[tour.project]}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {fmt.date(tour.departsAt, { day: "numeric", month: "short", year: "numeric" })}
            {tour.manager.name ? ` · ${tour.manager.name}` : ""}
            {tour.manager.tier ? ` · ${TIER_LABEL[tour.manager.tier]}` : ""}
            {tour.manager.rating !== null ? ` · ★ ${fmt.num(tour.manager.rating, 1)}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
            flown
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
              : dropped
                ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                : "border-zinc-700 bg-zinc-800/60 text-zinc-300"
          }`}
        >
          {tour.tourStatus === "closed" ? t.me[tour.myStatus] : t.tour[tour.tourStatus]}
        </span>
        {tour.points !== null && tour.points > 0 && (
          <Link href="/dashboard/gamification#points-history" className="text-xs font-medium text-amber-200 hover:text-amber-100">
            {t.points(tour.points)}
          </Link>
        )}
      </div>

      {tour.myReview && <p className="mt-3 text-[11px] text-zinc-500">{t.yourRating(tour.myReview.rating, tour.myReview.status === "pending")}</p>}
      {state === "sent" && <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300"><Check className="size-3.5" aria-hidden />{t.sent}</p>}

      {tour.canReview && !tour.myReview && state !== "sent" && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-200/30 px-4 text-xs text-amber-100 transition hover:bg-amber-200/10"
        >
          <Star className="size-3.5" aria-hidden />
          {t.rate}
        </button>
      )}

      {open && (
        <form
          className="mt-4 border-t border-zinc-800/70 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (rating > 0 && state !== "sending") void submit();
          }}
        >
          <div role="radiogroup" aria-label={t.rate} className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n}/5`}
                onClick={() => setRating(n)}
                className="flex size-10 items-center justify-center rounded-full transition hover:bg-zinc-800/60"
              >
                <Star className={`size-5 ${n <= rating ? "fill-amber-300 text-amber-300" : "text-zinc-600"}`} strokeWidth={1.5} aria-hidden />
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== tag) : [...cur, tag]))}
                  className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[11px] transition ${
                    on ? "border-amber-200/50 bg-amber-200/15 text-amber-100" : "border-zinc-700/80 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {on && <Check className="size-3" aria-hidden />}
                  {t.tags[tag]}
                </button>
              );
            })}
          </div>
          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.comment}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 280))}
              rows={2}
              className="mt-1.5 w-full resize-y rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 focus:border-amber-200/40 focus:outline-none focus:ring-2 focus:ring-amber-200/20"
            />
            <span className="mt-1 flex justify-between text-[11px] text-zinc-500">
              <span>{t.commentHint}</span>
              <span className="tabular-nums">{comment.length}/280</span>
            </span>
          </label>
          {state === "failed" && (
            <p role="alert" className="mt-2 text-xs text-rose-300">
              {t.failed}
            </p>
          )}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={state === "sending"} className="min-h-10 rounded-full border border-zinc-700 px-4 text-xs text-zinc-300">
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={rating === 0 || state === "sending"}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-amber-200 px-4 text-xs font-semibold text-zinc-950 disabled:opacity-50"
            >
              {state === "sending" && <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />}
              {t.send}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
