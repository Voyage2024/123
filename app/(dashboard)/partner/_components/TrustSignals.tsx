"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · СИГНАЛЫ ДОВЕРИЯ — app/(dashboard)/partner/_components/TrustSignals.tsx
 *
 * Три ответа на боли менеджеров (CustDev), общие для всего пульта:
 *
 *   LiveSnapBadge  «Фото из студии, а приехала другая» → свежесть Live Snap:
 *                  снимок с камеры в приложении, время ставит сервер.
 *                  ≤ 24 ч — свежий, ≤ 7 дн — недавний, старше — устарел.
 *   TrustBadge     «Новым девочкам доверия нет» → Trusted: 3+ долетевших
 *                  тура, 3+ отзыва Ключей от 4,5, без срывов за год.
 *   ContractSeal   «Боюсь оплачивать билеты заранее» → Digital Contract:
 *                  кто платит за билет и отель, гонорар, окно отмены;
 *                  печать — когда подписали все стороны.
 *                  variant="inline" — строка Manifest, "card" — Deal Room.
 *
 * Компоненты сами берут язык из LanguageContext — их можно ставить
 * на любую страницу кабинета.
 * ──────────────────────────────────────────────────────────────────── */

import type { ReactNode } from "react";
import {
  Banknote,
  BedDouble,
  Camera,
  CameraOff,
  Check,
  Hourglass,
  Lock,
  PenLine,
  Plane,
  ShieldAlert,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { DAY, UNITS, fmtAge } from "../_lib/clock";
import type { Contract, Payer, Trust } from "../_lib/command";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

const ru = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
  return c;
};
const one = (n: number, a: string, b: string) => (n === 1 ? a : b);

type Dict = {
  locale: string;
  snap: { fresh: (age: string) => string; recent: (age: string) => string; stale: (age: string) => string; none: string; hint: string };
  trust: {
    trusted: string;
    tours: (n: number) => string;
    reviews: (n: number) => string;
    newbie: string;
    noReviews: string;
    hint: string;
  };
  contract: {
    title: string;
    sealed: string;
    pending: string;
    missing: string;
    sealedNote: string;
    pendingNote: string;
    missingNote: string;
    flight: string;
    hotel: string;
    fee: string;
    cancel: (h: number) => string;
    payer: Record<Payer, string>;
    signatures: (a: number, b: number) => string;
  };
};

const T: Record<Lang, Dict> = {
  EN: {
    locale: "en-GB",
    snap: {
      fresh: (a) => `Live Snap · ${a}`,
      recent: (a) => `Live Snap · ${a}`,
      stale: (a) => `Snap outdated · ${a}`,
      none: "No Live Snap",
      hint: "Taken with the in-app camera — no gallery uploads, no filters. The time is stamped by the server.",
    },
    trust: {
      trusted: "Trusted",
      tours: (n) => `${n} ${one(n, "tour", "tours")}`,
      reviews: (n) => `${n} ${one(n, "review", "reviews")}`,
      newbie: "New",
      noReviews: "no reviews yet",
      hint: "Trusted: 3+ completed tours, 3+ reviews from Keys rated 4.5+, no drop-outs in 12 months.",
    },
    contract: {
      title: "Digital Contract",
      sealed: "Signed by all",
      pending: "Awaiting signatures",
      missing: "No contract yet",
      sealedNote: "Terms are locked — nobody can change them retroactively.",
      pendingNote: "Don’t pay for tickets until everyone has signed.",
      missingNote: "Create the contract before buying tickets.",
      flight: "Ticket",
      hotel: "Hotel",
      fee: "Fee",
      cancel: (h) => `Free cancellation ≥ ${h}h`,
      payer: { manager: "manager", participant: "participant", split: "split" },
      signatures: (a, b) => `${a}/${b} signatures`,
    },
  },
  RU: {
    locale: "ru-RU",
    snap: {
      fresh: (a) => `Live Snap · ${a}`,
      recent: (a) => `Live Snap · ${a}`,
      stale: (a) => `Снап устарел · ${a}`,
      none: "Нет Live Snap",
      hint: "Снято камерой в приложении — без загрузки из галереи и фильтров. Время съёмки ставит сервер.",
    },
    trust: {
      trusted: "Trusted",
      tours: (n) => `${n} ${ru(n, "тур", "тура", "туров")}`,
      reviews: (n) => `${n} ${ru(n, "отзыв", "отзыва", "отзывов")}`,
      newbie: "Новая",
      noReviews: "без отзывов",
      hint: "Trusted: 3+ долетевших тура, 3+ отзыва Ключей от 4,5, без срывов за 12 месяцев.",
    },
    contract: {
      title: "Digital Contract",
      sealed: "Подписан всеми",
      pending: "Ждёт подписи",
      missing: "Контракт не создан",
      sealedNote: "Условия зафиксированы — изменить задним числом нельзя.",
      pendingNote: "Не оплачивайте билеты, пока не подписали все.",
      missingNote: "Создайте контракт до покупки билетов.",
      flight: "Билет",
      hotel: "Отель",
      fee: "Гонорар",
      cancel: (h) => `Бесплатная отмена ≥ ${h} ч`,
      payer: { manager: "менеджер", participant: "участница", split: "пополам" },
      signatures: (a, b) => `${a}/${b} ${ru(b, "подпись", "подписи", "подписей")}`,
    },
  },
  ES: {
    locale: "es-ES",
    snap: {
      fresh: (a) => `Live Snap · ${a}`,
      recent: (a) => `Live Snap · ${a}`,
      stale: (a) => `Snap antiguo · ${a}`,
      none: "Sin Live Snap",
      hint: "Tomado con la cámara de la app, sin galería ni filtros. La hora la fija el servidor.",
    },
    trust: {
      trusted: "Trusted",
      tours: (n) => `${n} ${one(n, "tour", "tours")}`,
      reviews: (n) => `${n} ${one(n, "reseña", "reseñas")}`,
      newbie: "Nueva",
      noReviews: "sin reseñas",
      hint: "Trusted: 3+ tours completados, 3+ reseñas de Llaves de 4,5+, sin bajas en 12 meses.",
    },
    contract: {
      title: "Digital Contract",
      sealed: "Firmado por todos",
      pending: "Pendiente de firma",
      missing: "Sin contrato",
      sealedNote: "Condiciones fijadas: nadie puede cambiarlas después.",
      pendingNote: "No pagues los billetes hasta que todos firmen.",
      missingNote: "Crea el contrato antes de comprar billetes.",
      flight: "Billete",
      hotel: "Hotel",
      fee: "Honorario",
      cancel: (h) => `Cancelación gratis ≥ ${h} h`,
      payer: { manager: "gerente", participant: "participante", split: "a medias" },
      signatures: (a, b) => `${a}/${b} firmas`,
    },
  },
  PT: {
    locale: "pt-BR",
    snap: {
      fresh: (a) => `Live Snap · ${a}`,
      recent: (a) => `Live Snap · ${a}`,
      stale: (a) => `Snap antigo · ${a}`,
      none: "Sem Live Snap",
      hint: "Feito com a câmera do app, sem galeria nem filtros. O horário é registrado pelo servidor.",
    },
    trust: {
      trusted: "Trusted",
      tours: (n) => `${n} ${one(n, "tour", "tours")}`,
      reviews: (n) => `${n} ${one(n, "avaliação", "avaliações")}`,
      newbie: "Nova",
      noReviews: "sem avaliações",
      hint: "Trusted: 3+ tours concluídos, 3+ avaliações de Chaves 4,5+, sem desistências em 12 meses.",
    },
    contract: {
      title: "Digital Contract",
      sealed: "Assinado por todos",
      pending: "Aguardando assinaturas",
      missing: "Sem contrato",
      sealedNote: "Condições travadas — ninguém pode alterá-las depois.",
      pendingNote: "Não pague as passagens até todos assinarem.",
      missingNote: "Crie o contrato antes de comprar passagens.",
      flight: "Passagem",
      hotel: "Hotel",
      fee: "Cachê",
      cancel: (h) => `Cancelamento grátis ≥ ${h} h`,
      payer: { manager: "gerente", participant: "participante", split: "dividido" },
      signatures: (a, b) => `${a}/${b} assinaturas`,
    },
  },
};

function useDict() {
  const { lang } = useLanguage();
  return { t: T[lang] ?? T.EN, units: UNITS[lang] ?? UNITS.EN };
}

/* ══════════════════════════════════════════════════════════════════
 * LIVE SNAP
 * ══════════════════════════════════════════════════════════════════ */

export type SnapState = "fresh" | "recent" | "stale" | "none" | "unknown";

/** now = 0 — время ещё неизвестно (сервер / гидрация) */
export function snapState(at: number | null, now: number): SnapState {
  if (at === null) return "none";
  if (!now) return "unknown";
  const age = now - at;
  if (age <= DAY) return "fresh";
  if (age <= 7 * DAY) return "recent";
  return "stale";
}

/** Кольцо вокруг аватара в слепом шорт-листе */
export const SNAP_RING: Record<SnapState, string> = {
  fresh: "ring-2 ring-emerald-400/80",
  recent: "ring-1 ring-zinc-500/60",
  stale: "ring-1 ring-amber-400/70",
  none: "ring-1 ring-zinc-700",
  unknown: "ring-1 ring-zinc-700",
};

const SNAP_TONE: Record<SnapState, string> = {
  fresh: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  recent: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  stale: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  none: "border-dashed border-zinc-700 text-zinc-500",
  unknown: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
};

const PILL_BASE =
  "inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 tracking-wide";

export function LiveSnapBadge({ at, now }: { at: number | null; now: number }) {
  const { t, units } = useDict();
  const state = snapState(at, now);
  const age = at !== null && now ? fmtAge(at, now, units) : "";
  const label =
    state === "none"
      ? t.snap.none
      : state === "unknown"
        ? "Live Snap"
        : state === "stale"
          ? t.snap.stale(age)
          : t.snap[state](age);
  const Icon = state === "none" ? CameraOff : Camera;

  return (
    <span className={`${PILL_BASE} ${SNAP_TONE[state]}`} title={t.snap.hint}>
      <Icon className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * TRUST
 * ══════════════════════════════════════════════════════════════════ */

export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const full = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${rating} / 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-3 ${i <= full ? "fill-amber-200 text-amber-200" : "text-zinc-700"}`}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function TrustBadge({ trust }: { trust: Trust }) {
  const { t } = useDict();
  const rating =
    trust.rating !== null
      ? new Intl.NumberFormat(t.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(trust.rating)
      : null;

  if (trust.trusted) {
    return (
      <span
        className={`${PILL_BASE} border-amber-200/40 bg-gradient-to-r from-amber-200/20 to-amber-500/10 text-amber-100 shadow-[0_0_16px_-6px_rgba(253,230,138,0.55)]`}
        title={t.trust.hint}
      >
        <ShieldCheck className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="font-semibold tracking-[0.08em]">{t.trust.trusted}</span>
        {rating && (
          <>
            <span aria-hidden className="text-amber-200/50">·</span>
            <Star className="size-2.5 shrink-0 fill-amber-200 text-amber-200" aria-hidden />
            {rating}
          </>
        )}
        <span aria-hidden className="text-amber-200/50">·</span>
        <span className="truncate">{t.trust.tours(trust.flown)}</span>
      </span>
    );
  }

  if (trust.reviews > 0 && rating) {
    return (
      <span className={`${PILL_BASE} border-zinc-700 bg-zinc-800/60 text-zinc-300`} title={t.trust.hint}>
        <Star className="size-2.5 shrink-0 fill-zinc-300 text-zinc-300" aria-hidden />
        {rating}
        <span aria-hidden className="text-zinc-500">·</span>
        <span className="truncate">{t.trust.reviews(trust.reviews)}</span>
      </span>
    );
  }

  return (
    <span className={`${PILL_BASE} border-dashed border-zinc-700 text-zinc-500`} title={t.trust.hint}>
      <span className="truncate">
        {trust.flown > 0 ? t.trust.tours(trust.flown) : t.trust.newbie} · {t.trust.noReviews}
      </span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * DIGITAL CONTRACT
 * ══════════════════════════════════════════════════════════════════ */

type SealState = "sealed" | "pending" | "missing";

function sealState(c: Contract | null): SealState {
  if (!c) return "missing";
  return c.required > 0 && c.signed >= c.required ? "sealed" : "pending";
}

const SEAL: Record<SealState, { box: string; icon: string; badge: string; text: string; Mark: LucideIcon }> = {
  sealed: {
    box: "border-emerald-400/20 bg-emerald-400/[0.04]",
    icon: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    badge: "bg-emerald-400 text-zinc-950",
    text: "text-emerald-200",
    Mark: Check,
  },
  pending: {
    box: "border-amber-400/25 bg-amber-400/[0.05]",
    icon: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    badge: "bg-amber-300 text-zinc-950",
    text: "text-amber-200",
    Mark: PenLine,
  },
  missing: {
    box: "border-rose-400/25 bg-rose-500/[0.06]",
    icon: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    badge: "bg-rose-400 text-zinc-950",
    text: "text-rose-200",
    Mark: ShieldAlert,
  },
};

function SealIcon({ state, size }: { state: SealState; size: "sm" | "lg" }) {
  const s = SEAL[state];
  const box = size === "lg" ? "size-12 rounded-2xl" : "size-9 rounded-xl";
  return (
    <span className={`relative flex shrink-0 items-center justify-center border ${box} ${s.icon}`}>
      <Lock className={size === "lg" ? "size-5" : "size-4"} strokeWidth={1.5} aria-hidden />
      <span
        aria-hidden
        className={`absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full ring-2 ring-zinc-950 ${s.badge}`}
      >
        <s.Mark className="size-2.5" strokeWidth={3} />
      </span>
    </span>
  );
}

function TermChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-300">
      <Icon className="size-3 shrink-0 text-zinc-500" strokeWidth={1.75} aria-hidden />
      {children}
    </span>
  );
}

export function ContractSeal({ contract, variant = "inline" }: { contract: Contract | null; variant?: "inline" | "card" }) {
  const { t } = useDict();
  const c = t.contract;
  const state = sealState(contract);
  const s = SEAL[state];
  const card = variant === "card";

  const headline = state === "sealed" ? c.sealed : state === "pending" ? c.pending : c.missing;
  const note = state === "sealed" ? c.sealedNote : state === "pending" ? c.pendingNote : c.missingNote;

  const fee = contract
    ? [
        contract.terms.feeAmount !== null && contract.terms.feeCurrency
          ? new Intl.NumberFormat(t.locale, {
              style: "currency",
              currency: contract.terms.feeCurrency,
              maximumFractionDigits: 0,
            }).format(contract.terms.feeAmount)
          : null,
        contract.terms.feeSplit,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className={`rounded-xl border ${s.box} ${card ? "p-5" : "p-3"}`}>
      {/* печать + статус; условия ниже на всю ширину — на телефоне встают по два в ряд */}
      <div className="flex items-center gap-3">
        <SealIcon state={state} size={card ? "lg" : "sm"} />
        <div className="min-w-0">
          <p className={`font-semibold uppercase tracking-[0.22em] text-zinc-400 ${card ? "text-[11px]" : "text-[10px]"}`}>
            {c.title}
            {contract && <span className="ml-1.5 font-mono normal-case tracking-normal text-zinc-500">v{contract.version}</span>}
          </p>
          <p className={`mt-0.5 font-medium ${s.text} ${card ? "text-sm" : "text-xs"}`}>
            {headline}
            {contract && <span className="font-normal text-zinc-400"> · {c.signatures(contract.signed, contract.required)}</span>}
          </p>
        </div>
      </div>

      {contract && (
        <div className={`flex flex-wrap ${card ? "mt-4 gap-2" : "mt-2.5 gap-1.5"}`}>
          <TermChip icon={Plane}>
            {c.flight}: {c.payer[contract.terms.flightPaidBy]}
          </TermChip>
          <TermChip icon={BedDouble}>
            {c.hotel}: {c.payer[contract.terms.hotelPaidBy]}
          </TermChip>
          <TermChip icon={Banknote}>
            {c.fee} {fee}
          </TermChip>
          {contract.terms.cancelFreeHours !== null && (
            <TermChip icon={Hourglass}>{c.cancel(contract.terms.cancelFreeHours)}</TermChip>
          )}
        </div>
      )}

      <p className={`mt-2 text-[11px] leading-snug ${state === "sealed" ? "text-zinc-500" : s.text}`}>{note}</p>
    </div>
  );
}

/** Есть ли у тура действующая печать (все подписали последнюю версию) */
export const isSealed = (c: Contract | null) => sealState(c) === "sealed";

/** Свежий снап, если сделан не позже суток назад */
export const isFreshSnap = (at: number | null, now: number) => snapState(at, now) === "fresh";
