"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЗИДЕНТКА — лента кастингов
 * app/(dashboard)/dashboard/_components/CastingFeed.tsx
 *
 * Самостоятельный блок: можно поставить на главную кабинета целиком
 * (page.tsx рядом) или вставить в уже существующую страницу <CastingFeed />.
 *
 *   «Открыта к турам»  тумблер: выключен — анкета скрыта от менеджеров,
 *                      новые кастинги не приходят
 *   Фильтры            Все · Новые · Мои отклики
 *   Карточка           посадочный талон: бриф целиком сверху, отрывной
 *                      корешок с кнопкой «Готова в тур» снизу
 *
 * Состояния отклика на корешке:
 *   нет отклика  → «Готова в тур»
 *   отправка     → «Отправляем…» (кнопка заблокирована)
 *   ready        → «Вы откликнулись · ожидание ответа менеджера», можно отозвать
 *   option       → «Вы в шорт-листе», опцион до даты
 *   selected     → рукопожатие, детали придут в Telegram
 *   ошибка       → причина и «Повторить»
 *
 * Все обращения к базе: лента — в _lib/castingFeed.ts (RPC partner_resident_feed),
 * отклики и тумблер — в _lib/actions.ts.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  BedDouble,
  Check,
  Clock,
  EyeOff,
  Handshake,
  Hourglass,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  Plane,
  Ruler,
  Sparkles,
  Star,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { DAY } from "@/app/(dashboard)/partner/_lib/clock";
import type { ProjectKey } from "@/app/(dashboard)/partner/_lib/command";
import { pl, ru, usePartnerFormat, type Common, type Fmt } from "@/app/(dashboard)/partner/_lib/format";
import {
  BTN_GOLD,
  FilterTabs,
  ICON_RING,
  PILL,
  Pill,
  SectionHeader,
  TIER_LABEL,
  TIER_TEXT,
  cormorant,
} from "@/app/(dashboard)/partner/_components/PartnerUI";
import {
  fetchCastingFeed,
  type CastingFeedData,
  type FeedCasting,
  type ResidentProfile,
  type ResponseStatus,
} from "@/app/(dashboard)/dashboard/_lib/castingFeed";
import { applyToCasting, markCastingsSeen, setOpenToTours, withdrawResponse, type ActionResult } from "@/app/(dashboard)/dashboard/_lib/actions";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type FilterKey = "all" | "new" | "mine";
type Failure = Exclude<ActionResult, { ok: true }>["reason"];

type Dict = {
  eyebrow: string;
  title: string;
  rule: string;
  open: { label: string; on: string; off: string };
  hidden: { title: string; text: string };
  filters: Record<FilterKey, string> & { label: string };
  empty: Record<FilterKey, string>;
  isNew: string;
  closingSoon: string;
  days: (n: number) => string;
  terms: { fee: string; feeOpen: string; slots: string; flight: string; hotel: string };
  slots: (n: number) => string;
  height: (cm: number) => string;
  fits: string;
  manager: string;
  managerNew: string;
  organizerClub: string;
  tours: (n: number) => string;
  closesIn: (d: string) => string;
  apply: string;
  applying: string;
  applyHint: string;
  applied: string;
  waiting: (ago: string) => string;
  withdraw: string;
  withdrawing: string;
  option: string;
  optionUntil: (date: string, left: string) => string;
  selected: string;
  selectedHint: string;
  error: Record<Failure, string>;
  retry: string;
  loading: string;
  loadError: string;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Castings",
    title: "Castings for you",
    rule: "You see the full brief before answering. The manager’s name and contacts open after the handshake.",
    open: { label: "Open to tours", on: "Managers see your profile and send you castings.", off: "Your profile is hidden from managers." },
    hidden: {
      title: "You are hidden from managers",
      text: "While the switch is off, new castings don’t reach you and managers don’t see your profile. Replies you already sent stay active.",
    },
    filters: { label: "Casting filter", all: "All", new: "New", mine: "My replies" },
    empty: {
      all: "No open castings that match your profile right now. We’ll message you in Telegram when one appears.",
      new: "Nothing new since your last visit.",
      mine: "You haven’t replied to any casting yet.",
    },
    isNew: "New",
    closingSoon: "Closing soon",
    days: (n) => `${n} ${pl(n, "day", "days")}`,
    terms: { fee: "Fee", feeOpen: "negotiable", slots: "Spots", flight: "Flight", hotel: "Hotel" },
    slots: (n) => `${n}`,
    height: (cm) => `from ${cm} cm`,
    fits: "matches your profile",
    manager: "Club manager",
    managerNew: "new",
    organizerClub: "Official club tour",
    tours: (n) => `${n} ${pl(n, "tour", "tours")}`,
    closesIn: (d) => `Replies close in ${d}`,
    apply: "Ready for the tour",
    applying: "Sending…",
    applyHint: "Until the handshake you can withdraw at no cost.",
    applied: "You replied",
    waiting: (a) => `Waiting for the manager · ${a}`,
    withdraw: "Withdraw reply",
    withdrawing: "Withdrawing…",
    option: "You’re on the shortlist",
    optionUntil: (d, l) => `The manager holds a spot for you until ${d} · ${l} left`,
    selected: "Handshake — you’re in the crew",
    selectedHint: "Terms and the contract will arrive in Telegram.",
    error: {
      closed: "Replies for this casting are closed.",
      forbidden: "Your account can’t reply yet — finish verification.",
      network: "Couldn’t send. Check your connection and try again.",
    },
    retry: "Try again",
    loading: "Loading castings…",
    loadError: "Couldn’t load castings. Refresh the page to try again.",
  },
  RU: {
    eyebrow: "Кастинги",
    title: "Кастинги для вас",
    rule: "Бриф виден целиком до ответа. Имя менеджера и контакты откроются после рукопожатия.",
    open: { label: "Открыта к турам", on: "Менеджеры видят вашу анкету и присылают кастинги.", off: "Ваша анкета скрыта от менеджеров." },
    hidden: {
      title: "Вы скрыты от менеджеров",
      text: "Пока тумблер выключен, новые кастинги не приходят, а анкета не видна менеджерам. Отклики, которые вы уже отправили, остаются в силе.",
    },
    filters: { label: "Фильтр кастингов", all: "Все", new: "Новые", mine: "Мои отклики" },
    empty: {
      all: "Сейчас нет открытых кастингов под ваш профиль. Напишем в Telegram, как только появится.",
      new: "С прошлого визита новых кастингов нет.",
      mine: "Вы пока ни на что не откликнулись.",
    },
    isNew: "Новый",
    closingSoon: "Скоро закрытие",
    days: (n) => `${n} ${ru(n, "день", "дня", "дней")}`,
    terms: { fee: "Гонорар", feeOpen: "договорной", slots: "Мест", flight: "Перелёт", hotel: "Отель" },
    slots: (n) => `${n}`,
    height: (cm) => `от ${cm} см`,
    fits: "подходит под ваш профиль",
    manager: "Менеджер клуба",
    managerNew: "новый",
    organizerClub: "Официальный тур клуба",
    tours: (n) => `${n} ${ru(n, "тур", "тура", "туров")}`,
    closesIn: (d) => `Приём откликов закроется через ${d}`,
    apply: "Готова в тур",
    applying: "Отправляем…",
    applyHint: "До рукопожатия отклик можно отозвать без последствий.",
    applied: "Вы откликнулись",
    waiting: (a) => `Ожидание ответа менеджера · ${a}`,
    withdraw: "Отозвать отклик",
    withdrawing: "Отзываем…",
    option: "Вы в шорт-листе",
    optionUntil: (d, l) => `Менеджер держит для вас место до ${d} · осталось ${l}`,
    selected: "Рукопожатие — вы в составе тура",
    selectedHint: "Условия и контракт придут в Telegram.",
    error: {
      closed: "Приём откликов на этот кастинг закрыт.",
      forbidden: "Откликаться можно после полной верификации.",
      network: "Не удалось отправить. Проверьте связь и попробуйте ещё раз.",
    },
    retry: "Повторить",
    loading: "Загружаем кастинги…",
    loadError: "Не удалось загрузить кастинги. Обновите страницу.",
  },
  ES: {
    eyebrow: "Castings",
    title: "Castings para ti",
    rule: "Ves el brief completo antes de responder. El nombre y los contactos del gerente se abren tras el apretón de manos.",
    open: { label: "Disponible para tours", on: "Los gerentes ven tu perfil y te envían castings.", off: "Tu perfil está oculto para los gerentes." },
    hidden: {
      title: "Estás oculta para los gerentes",
      text: "Mientras el interruptor esté apagado, no te llegan castings nuevos y los gerentes no ven tu perfil. Las respuestas ya enviadas siguen vigentes.",
    },
    filters: { label: "Filtro de castings", all: "Todos", new: "Nuevos", mine: "Mis respuestas" },
    empty: {
      all: "Ahora no hay castings abiertos para tu perfil. Te escribiremos por Telegram cuando aparezca uno.",
      new: "Nada nuevo desde tu última visita.",
      mine: "Aún no has respondido a ningún casting.",
    },
    isNew: "Nuevo",
    closingSoon: "Cierra pronto",
    days: (n) => `${n} ${pl(n, "día", "días")}`,
    terms: { fee: "Caché", feeOpen: "a convenir", slots: "Plazas", flight: "Vuelo", hotel: "Hotel" },
    slots: (n) => `${n}`,
    height: (cm) => `desde ${cm} cm`,
    fits: "encaja con tu perfil",
    manager: "Gerente del club",
    managerNew: "nuevo",
    organizerClub: "Tour oficial del club",
    tours: (n) => `${n} ${pl(n, "tour", "tours")}`,
    closesIn: (d) => `Las respuestas cierran en ${d}`,
    apply: "Lista para el tour",
    applying: "Enviando…",
    applyHint: "Hasta el apretón de manos puedes retirarla sin consecuencias.",
    applied: "Has respondido",
    waiting: (a) => `Esperando al gerente · ${a}`,
    withdraw: "Retirar respuesta",
    withdrawing: "Retirando…",
    option: "Estás en la preselección",
    optionUntil: (d, l) => `El gerente te reserva la plaza hasta ${d} · quedan ${l}`,
    selected: "Apretón de manos: estás en el equipo",
    selectedHint: "Las condiciones y el contrato llegarán por Telegram.",
    error: {
      closed: "Las respuestas a este casting están cerradas.",
      forbidden: "Podrás responder tras la verificación completa.",
      network: "No se pudo enviar. Revisa la conexión e inténtalo de nuevo.",
    },
    retry: "Reintentar",
    loading: "Cargando castings…",
    loadError: "No se pudieron cargar los castings. Actualiza la página.",
  },
  PT: {
    eyebrow: "Castings",
    title: "Castings para você",
    rule: "Você vê o brief completo antes de responder. Nome e contatos do gerente abrem depois do aperto de mão.",
    open: { label: "Disponível para tours", on: "Os gerentes veem seu perfil e enviam castings.", off: "Seu perfil está oculto para os gerentes." },
    hidden: {
      title: "Você está oculta para os gerentes",
      text: "Com o botão desligado, castings novos não chegam e os gerentes não veem seu perfil. As respostas já enviadas continuam valendo.",
    },
    filters: { label: "Filtro de castings", all: "Todos", new: "Novos", mine: "Minhas respostas" },
    empty: {
      all: "Agora não há castings abertos para o seu perfil. Avisaremos no Telegram quando surgir um.",
      new: "Nada novo desde a sua última visita.",
      mine: "Você ainda não respondeu a nenhum casting.",
    },
    isNew: "Novo",
    closingSoon: "Fecha em breve",
    days: (n) => `${n} ${pl(n, "dia", "dias")}`,
    terms: { fee: "Cachê", feeOpen: "a combinar", slots: "Vagas", flight: "Voo", hotel: "Hotel" },
    slots: (n) => `${n}`,
    height: (cm) => `a partir de ${cm} cm`,
    fits: "combina com seu perfil",
    manager: "Gerente do clube",
    managerNew: "novo",
    organizerClub: "Tour oficial do clube",
    tours: (n) => `${n} ${pl(n, "tour", "tours")}`,
    closesIn: (d) => `As respostas fecham em ${d}`,
    apply: "Pronta para o tour",
    applying: "Enviando…",
    applyHint: "Até o aperto de mão você pode retirar sem consequências.",
    applied: "Você respondeu",
    waiting: (a) => `Aguardando o gerente · ${a}`,
    withdraw: "Retirar resposta",
    withdrawing: "Retirando…",
    option: "Você está na pré-seleção",
    optionUntil: (d, l) => `O gerente reserva a vaga para você até ${d} · faltam ${l}`,
    selected: "Aperto de mão — você está na equipe",
    selectedHint: "Condições e contrato chegarão pelo Telegram.",
    error: {
      closed: "As respostas para este casting estão encerradas.",
      forbidden: "Você poderá responder após a verificação completa.",
      network: "Não foi possível enviar. Verifique a conexão e tente de novo.",
    },
    retry: "Tentar de novo",
    loading: "Carregando castings…",
    loadError: "Não foi possível carregar os castings. Atualize a página.",
  },
};

/* ══════════════════════════════════════════════════════════════════
 * ЛОГИКА
 * ══════════════════════════════════════════════════════════════════ */

type Response = FeedCasting["response"];
type Pending = "apply" | "withdraw";

const ACTIVE_REPLY: ResponseStatus[] = ["ready", "option", "selected"];
const hasReply = (r: Response) => !!r && ACTIVE_REPLY.includes(r.status);

/** Опцион и рукопожатие — сверху, потом новые по сроку закрытия, отклики — внизу */
function rank(c: FeedCasting) {
  const s = c.response?.status;
  if (s === "option" || s === "selected") return 0;
  if (!hasReply(c.response)) return 1;
  return 2;
}

const PROJECT_GLOW: Record<ProjectKey, string> = {
  show: "from-amber-200/[0.09]",
  campaign: "from-amber-400/[0.08]",
  shoot: "from-zinc-200/[0.06]",
  event: "from-amber-300/[0.07]",
};

/* ══════════════════════════════════════════════════════════════════
 * «ОТКРЫТА К ТУРАМ»
 * ══════════════════════════════════════════════════════════════════ */

function OpenToToursSwitch({ value, busy, onChange, t }: { value: boolean; busy: boolean; onChange: (v: boolean) => void; t: Dict }) {
  return (
    <div
      className={`flex min-w-0 max-w-md flex-[1_1_20rem] items-center gap-4 rounded-2xl border p-4 backdrop-blur-xl transition-colors ${
        value ? "border-amber-200/25 bg-gradient-to-br from-amber-200/[0.08] via-zinc-900/60 to-zinc-950/80" : "border-zinc-800/80 bg-zinc-900/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{t.open.label}</p>
        <p className="mt-0.5 text-xs leading-snug text-zinc-400">{value ? t.open.on : t.open.off}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={t.open.label}
        aria-busy={busy}
        disabled={busy}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 disabled:opacity-70 ${
          value ? "border-amber-200/60 bg-amber-200" : "border-zinc-700 bg-zinc-800"
        }`}
      >
        <span
          className={`absolute flex size-6 items-center justify-center rounded-full shadow transition-transform duration-300 ${
            value ? "translate-x-[1.6rem] bg-zinc-950" : "translate-x-1 bg-zinc-400"
          }`}
        >
          {busy && <Loader2 className="size-3.5 text-amber-200 motion-safe:animate-spin" aria-hidden />}
        </span>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КОРЕШОК: кнопка и статус отклика
 * ══════════════════════════════════════════════════════════════════ */

function ApplyStub({
  response,
  pending,
  failure,
  onApply,
  onWithdraw,
  t,
  fmt,
}: {
  response: Response;
  pending: Pending | null;
  failure: Failure | null;
  onApply: () => void;
  onWithdraw: () => void;
  t: Dict;
  fmt: Fmt;
}) {
  const status = response?.status;

  // Опцион: менеджер держит место
  if (status === "option" && response) {
    return (
      <div className="rounded-xl border border-amber-200/35 bg-amber-200/[0.08] p-3.5">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-100">
          <Star className="size-4 shrink-0 fill-amber-200 text-amber-200" aria-hidden />
          {t.option}
        </p>
        {response.optionUntil !== null && (
          <p className="mt-1 text-xs leading-snug text-amber-100/70">
            {t.optionUntil(
              fmt.date(response.optionUntil, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
              fmt.until(response.optionUntil),
            )}
          </p>
        )}
      </div>
    );
  }

  // Рукопожатие
  if (status === "selected") {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] p-3.5">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-100">
          <Handshake className="size-4 shrink-0" aria-hidden />
          {t.selected}
        </p>
        <p className="mt-1 text-xs text-emerald-100/70">{t.selectedHint}</p>
      </div>
    );
  }

  // Откликнулась — ждёт менеджера
  if (status === "ready" && response) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="inline-flex min-h-12 w-full cursor-default items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.08] px-4 text-sm font-medium text-emerald-100"
        >
          <Check className="size-4" aria-hidden />
          {t.applied}
        </button>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-400">
          <Hourglass className="size-3.5 shrink-0 text-zinc-500" aria-hidden />
          {t.waiting(fmt.ago(response.at))}
        </p>
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={onWithdraw}
            disabled={pending === "withdraw"}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-200 hover:underline disabled:pointer-events-none sm:min-h-8"
          >
            {pending === "withdraw" ? (
              <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
            ) : (
              <Undo2 className="size-3.5" aria-hidden />
            )}
            {pending === "withdraw" ? t.withdrawing : t.withdraw}
          </button>
        </div>
        {failure && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-200">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
            {t.error[failure]}
          </p>
        )}
      </div>
    );
  }

  // Нет отклика (или отозван) — главная кнопка
  const sending = pending === "apply";
  return (
    <div>
      <button
        type="button"
        onClick={onApply}
        disabled={sending || failure === "closed" || failure === "forbidden"}
        aria-busy={sending}
        className={`${BTN_GOLD} min-h-12 w-full text-sm sm:min-h-12`}
      >
        {sending ? <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> : <Plane className="size-4" aria-hidden />}
        {sending ? t.applying : failure === "network" ? t.retry : t.apply}
      </button>
      {failure ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-200">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {t.error[failure]}
        </p>
      ) : (
        <p className="mt-2 text-center text-[11px] leading-snug text-zinc-500">{t.applyHint}</p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КАРТОЧКА-ТАЛОН
 * ══════════════════════════════════════════════════════════════════ */

function TicketCard({
  c,
  me,
  response,
  pending,
  failure,
  onApply,
  onWithdraw,
  t,
  cm,
  fmt,
}: {
  c: FeedCasting;
  me: ResidentProfile;
  response: Response;
  pending: Pending | null;
  failure: Failure | null;
  onApply: () => void;
  onWithdraw: () => void;
  t: Dict;
  cm: Common;
  fmt: Fmt;
}) {
  const days = Math.round((c.endsAt - c.startsAt) / DAY) + 1;
  const closingSoon = fmt.ready && c.closesAt - fmt.now < DAY;
  const replied = hasReply(response);
  const heightOk = c.heightMin === null || (me.height ?? 0) >= c.heightMin;
  const langOk = c.languages.every((l) => me.languages.includes(l));

  const terms: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Banknote, label: t.terms.fee, value: c.fee ? fmt.money(c.fee.amount, c.fee.currency) : t.terms.feeOpen },
    { icon: Users, label: t.terms.slots, value: t.slots(c.slots) },
    { icon: Plane, label: t.terms.flight, value: cm.payer[c.flightPaidBy] },
    { icon: BedDouble, label: t.terms.hotel, value: cm.payer[c.hotelPaidBy] },
  ];

  return (
    <article
      aria-label={`${fmt.city(c.city)} · ${cm.projects[c.project]}`}
      className={`group relative flex min-w-0 flex-col rounded-[1.4rem] border bg-gradient-to-b ${PROJECT_GLOW[c.project]} via-zinc-900/50 to-zinc-950/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl transition-colors duration-300 ${
        response?.status === "option" ? "border-amber-200/40 shadow-[0_0_40px_-18px_rgba(253,230,138,0.45)]" : "border-zinc-800/80 hover:border-amber-200/25"
      }`}
    >
      {/* ── бриф ── */}
      <div className="flex-1 p-5 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
            {cm.projects[c.project]} · {t.days(days)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.fresh && !replied && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-950">
                <Sparkles className="size-3" aria-hidden />
                {t.isNew}
              </span>
            )}
            {closingSoon && !replied && <Pill tone="amber">{t.closingSoon}</Pill>}
          </div>
        </div>

        <h3 className={`${cormorant.className} mt-2 text-[2.4rem] font-medium leading-none text-zinc-50`}>{fmt.city(c.city)}</h3>
        <p className="mt-2 text-sm text-zinc-300">{fmt.range(c.startsAt, c.endsAt)}</p>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-800/70">
          {terms.map(({ icon: Icon, label, value }) => (
            <div key={label} className="min-w-0 bg-zinc-950/80 px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
                <Icon className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="truncate">{label}</span>
              </dt>
              <dd className="mt-0.5 break-words text-sm leading-snug text-zinc-100 first-letter:uppercase">{value}</dd>
            </div>
          ))}
        </dl>

        {(c.heightMin !== null || c.languages.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {c.heightMin !== null && <Requirement icon={Ruler} text={t.height(c.heightMin)} ok={heightOk} />}
            {c.languages.length > 0 && <Requirement icon={Languages} text={c.languages.join(" · ")} ok={langOk} />}
            {heightOk && langOk && <span className="text-[11px] text-emerald-300/80">{t.fits}</span>}
          </div>
        )}

        {c.note && <p className={`${cormorant.className} mt-4 text-[17px] leading-snug text-zinc-200`}>«{c.note}»</p>}

        {/* тур клуба — имя и Official Club; партнёр — только репутация, без имени */}
        {c.organizer.official ? (
          <div className="mt-4 rounded-xl border border-amber-200/25 bg-amber-200/[0.05] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-100/70">{t.organizerClub}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-100">
              {c.organizer.name ?? "VOYAGE Management"}
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-amber-200/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                <BadgeCheck className="size-3" aria-hidden />
                Official Club
              </span>
            </p>
          </div>
        ) : null}
        <p className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          {t.manager}
          {!c.organizer.official && c.organizer.badge === "verified" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-emerald-100">
              <BadgeCheck className="size-3" aria-hidden />
              Verified
            </span>
          )}
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
          <KeyRound className="size-3.5 shrink-0 text-amber-200/70" aria-hidden />
          <span className={`bg-gradient-to-r ${TIER_TEXT[c.manager.tier]} bg-clip-text font-medium text-transparent`}>
            {TIER_LABEL[c.manager.tier]}
          </span>
          <span aria-hidden className="text-zinc-700">·</span>
          {c.manager.rating !== null ? (
            <span className="inline-flex items-center gap-1 text-zinc-300">
              <Star className="size-3 fill-amber-200 text-amber-200" aria-hidden />
              {fmt.num(c.manager.rating, 1)}
            </span>
          ) : (
            <span className="text-zinc-500">{t.managerNew}</span>
          )}
          <span aria-hidden className="text-zinc-700">·</span>
          <span>{t.tours(c.manager.tours)}</span>
        </p>
      </div>

      {/* ── линия отрыва ── */}
      <div aria-hidden className="relative h-0">
        <span className="absolute -left-3 -top-3 size-6 rounded-full border border-zinc-800/80 bg-zinc-950 [clip-path:inset(0_0_0_50%)]" />
        <span className="absolute -right-3 -top-3 size-6 rounded-full border border-zinc-800/80 bg-zinc-950 [clip-path:inset(0_50%_0_0)]" />
        <span className="absolute inset-x-5 top-0 border-t border-dashed border-zinc-700/80" />
      </div>

      {/* ── корешок ── */}
      <div className="p-5">
        {/* срок приёма важен, пока менеджер не выбрал: при опционе и рукопожатии он лишний */}
        {response?.status !== "option" && response?.status !== "selected" && (
          <p className={`mb-3 flex items-center gap-1.5 text-xs ${closingSoon ? "text-amber-200" : "text-zinc-400"}`}>
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {fmt.ready ? t.closesIn(fmt.until(c.closesAt)) : "—"}
          </p>
        )}
        <div aria-live="polite">
          <ApplyStub
            response={response}
            pending={pending}
            failure={failure}
            onApply={onApply}
            onWithdraw={onWithdraw}
            t={t}
            fmt={fmt}
          />
        </div>
      </div>
    </article>
  );
}

function Requirement({ icon: Icon, text, ok }: { icon: LucideIcon; text: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${ok ? PILL.emerald : PILL.zinc}`}>
      <Icon className="size-3" strokeWidth={1.75} aria-hidden />
      {text}
      {ok && <Check className="size-3" aria-hidden />}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ЛЕНТА
 * ══════════════════════════════════════════════════════════════════ */

/** Копия словаря без ключа (v = null) или с новым значением */
function patch<V>(cur: Record<string, V>, id: string, v: V | null): Record<string, V> {
  const next = { ...cur };
  if (v === null) delete next[id];
  else next[id] = v;
  return next;
}

/** Загрузка: пока идёт запрос — заголовок и строка «Загружаем»; при ошибке — текст вместо ленты */
export default function CastingFeed() {
  const { lang } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const [data, setData] = useState<CastingFeedData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchCastingFeed()
      .then((d) => {
        if (!alive) return;
        setData(d);
        void markCastingsSeen();
      })
      .catch((e: unknown) => {
        console.error("[castings] feed:", e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!data) {
    return (
      <section aria-busy={!failed} aria-label={t.title}>
        <SectionHeader eyebrow={t.eyebrow} title={t.title} icon={Sparkles} />
        <p className="mt-6 text-sm text-zinc-500">{failed ? t.loadError : t.loading}</p>
      </section>
    );
  }

  return <FeedBody data={data} />;
}

function FeedBody({ data }: { data: CastingFeedData }) {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [open, setOpen] = useState(data.me.openToTours);
  const [openBusy, setOpenBusy] = useState(false);
  const [responses, setResponses] = useState<Record<string, Response>>(() =>
    Object.fromEntries(data.castings.map((c) => [c.id, c.response])),
  );
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [failures, setFailures] = useState<Record<string, Failure>>({});

  // Порядок фиксируем при загрузке: карточка не прыгает по ленте после отклика
  const ordered = useMemo(
    () => [...data.castings].sort((a, b) => rank(a) - rank(b) || a.closesAt - b.closesAt),
    [data.castings],
  );

  const markPending = (id: string, v: Pending | null) => setPending((cur) => patch(cur, id, v));
  const markFailure = (id: string, v: Failure | null) => setFailures((cur) => patch(cur, id, v));

  /** Отклик: запись в базу — в _lib/actions.ts → applyToCasting */
  const handleApply = async (id: string) => {
    if (pending[id]) return;
    markFailure(id, null);
    markPending(id, "apply");
    const res = await applyToCasting(id);
    markPending(id, null);
    if (res.ok) {
      setResponses((cur) => ({ ...cur, [id]: { status: "ready", at: Date.now(), optionUntil: null } }));
    } else {
      markFailure(id, res.reason);
    }
  };

  const handleWithdraw = async (id: string) => {
    if (pending[id]) return;
    markFailure(id, null);
    markPending(id, "withdraw");
    const res = await withdrawResponse(id);
    markPending(id, null);
    if (res.ok) {
      setResponses((cur) => ({ ...cur, [id]: { status: "withdrawn", at: Date.now(), optionUntil: null } }));
    } else {
      markFailure(id, res.reason);
    }
  };

  const handleOpen = async (next: boolean) => {
    setOpen(next); // сразу — тумблер не должен «думать»
    setOpenBusy(true);
    const res = await setOpenToTours(next);
    setOpenBusy(false);
    if (!res.ok) setOpen(!next);
  };

  const isNew = (c: FeedCasting) => c.fresh && !hasReply(responses[c.id]);
  const isMine = (c: FeedCasting) => hasReply(responses[c.id]);
  const counts: Record<FilterKey, number> = {
    all: ordered.length,
    new: ordered.filter(isNew).length,
    mine: ordered.filter(isMine).length,
  };
  const visible = ordered.filter((c) => (filter === "new" ? isNew(c) : filter === "mine" ? isMine(c) : true));

  return (
    <section aria-label={t.title}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <SectionHeader eyebrow={t.eyebrow} title={t.title} icon={Sparkles} count={open ? counts.new : undefined} />
        </div>
        <OpenToToursSwitch value={open} busy={openBusy} onChange={handleOpen} t={t} />
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-amber-200/60" strokeWidth={1.5} aria-hidden />
        {t.rule}
      </p>

      {!open ? (
        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-dashed border-zinc-800 p-6 sm:flex-row sm:items-center">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${ICON_RING.zinc}`}>
            <EyeOff className="size-5" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={`${cormorant.className} text-xl font-medium text-zinc-100`}>{t.hidden.title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">{t.hidden.text}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <FilterTabs
              label={t.filters.label}
              value={filter}
              onChange={setFilter}
              items={(["all", "new", "mine"] as FilterKey[]).map((key) => ({ key, label: t.filters[key], count: counts[key] }))}
            />
          </div>

          {visible.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-400">{t.empty[filter]}</p>
          ) : (
            <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))] gap-5">
              {visible.map((c) => (
                <TicketCard
                  key={c.id}
                  c={c}
                  me={data.me}
                  response={responses[c.id]}
                  pending={pending[c.id] ?? null}
                  failure={failures[c.id] ?? null}
                  onApply={() => void handleApply(c.id)}
                  onWithdraw={() => void handleWithdraw(c.id)}
                  t={t}
                  cm={cm}
                  fmt={fmt}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
