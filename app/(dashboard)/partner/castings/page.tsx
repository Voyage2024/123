"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · КАСТИНГИ — app/(dashboard)/partner/castings/page.tsx
 *
 * Рынок менеджера: все его брифы сеткой.
 *   Шапка     число активных, «Готова», рукопожатия, что закрывается за 24 ч
 *   Фильтры   Активные · Открыт · Шорт-лист · Архив · Все + поиск по городу и брифу
 *   Карточка  город, даты, условия (гонорар, кто платит перелёт и отель),
 *             требования, слепой шорт-лист, свежесть Live Snap и Trusted
 *
 * Правило слепого отбора то же, что в Штабе: до рукопожатия — замок и код
 * (ссылка в слепую карточку кандидатки), после — инициалы и профиль.
 * Вся карточка — ссылка на кастинг; аватары и «Комната тура» поверх неё.
 *
 * Данные: RPC public.partner_castings_list() через usePartnerFeed.
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  BedDouble,
  Camera,
  ChevronRight,
  Clock,
  Hourglass,
  Languages,
  Lock,
  MessagesSquare,
  Plane,
  Plus,
  Ruler,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { DAY, HOUR } from "@/app/(dashboard)/partner/_lib/clock";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { pl, ru, usePartnerFormat, type Common, type Fmt } from "@/app/(dashboard)/partner/_lib/format";
import { parseCastings, type CastingBrief, type CastingStage, type CastingsData } from "@/app/(dashboard)/partner/_lib/castings";
import { usePartnerFeed } from "@/app/(dashboard)/partner/_lib/usePartnerFeed";
import { PartnerGuide } from "@/app/(dashboard)/partner/_components/PartnerGuide";
import { SNAP_RING, isFreshSnap, snapState } from "@/app/(dashboard)/partner/_components/TrustSignals";
import {
  BTN_GOLD,
  EmptyFilter,
  FeedGate,
  FilterTabs,
  OVERLAY_LINK,
  PILL,
  PageHeader,
  PageShell,
  Pill,
  SearchField,
  StatStrip,
  clamp,
  cormorant,
  initials,
  type Tone,
} from "@/app/(dashboard)/partner/_components/PartnerUI";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type FilterKey = "active" | "open" | "shortlist" | "archive" | "all";

type Dict = {
  eyebrow: string;
  title: string;
  subtitle: string;
  create: string;
  blindRule: string;
  firstCasting: string;
  stats: { active: string; ready: string; handshakes: string; closing: string };
  filters: Record<FilterKey, string> & { label: string };
  searchPlaceholder: string;
  stage: Record<CastingStage, string>;
  closing: string;
  fresh: (n: number) => string;
  days: (n: number) => string;
  ready: (n: number, slots: number) => string;
  fee: string;
  feeOpen: string;
  flight: string;
  hotel: string;
  height: (cm: number) => string;
  waiting: string;
  snaps: (fresh: number, total: number) => string;
  trusted: (n: number, total: number) => string;
  handshakes: (n: number) => string;
  avatar: (code: string, snap: string, trusted: boolean) => string;
  avatarOpen: (name: string, code: string, snap: string, trusted: boolean) => string;
  noSnap: string;
  closesIn: (d: string) => string;
  closedAt: (ago: string) => string;
  cancelledAt: (ago: string) => string;
  open: string;
  room: string;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Market · Castings",
    title: "Castings",
    subtitle: "Your briefs and the blind selection. Names and profiles open only after the handshake.",
    create: "New casting",
    blindRule: "Blind selection: before the handshake you see a code, Live Snap and Trusted — no name, no contacts.",
    firstCasting: "No castings yet. Publish the first brief — residents who match will see it and reply “Ready”.",
    stats: { active: "Active castings", ready: "“Ready” replies", handshakes: "Handshakes", closing: "Closing within 24 h" },
    filters: { label: "Casting filter", active: "Active", open: "Open", shortlist: "Shortlist", archive: "Archive", all: "All" },
    searchPlaceholder: "City or brief text",
    stage: { open: "Open", shortlist: "Shortlist", closed: "Closed", cancelled: "Cancelled" },
    closing: "Closing soon",
    fresh: (n) => `+${n} new`,
    days: (n) => `${n} ${pl(n, "day", "days")}`,
    ready: (n, s) => `${n} “Ready” · ${s} ${pl(s, "spot", "spots")}`,
    fee: "Fee",
    feeOpen: "negotiable",
    flight: "Flight",
    hotel: "Hotel",
    height: (cm) => `from ${cm} cm`,
    waiting: "Waiting for the first “Ready”",
    snaps: (f, t) => `Live Snap ≤ 24 h · ${f}/${t}`,
    trusted: (n, t) => `Trusted · ${n}/${t}`,
    handshakes: (n) => `Handshake · ${n}`,
    avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — open candidate card`,
    avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — open profile`,
    noSnap: "no Live Snap",
    closesIn: (d) => `Closes in ${d}`,
    closedAt: (a) => `Closed ${a}`,
    cancelledAt: (a) => `Cancelled ${a}`,
    open: "Open",
    room: "Tour room",
  },
  RU: {
    eyebrow: "Рынок · Кастинги",
    title: "Кастинги",
    subtitle: "Ваши брифы и слепой отбор. Имя и профиль открываются только после рукопожатия.",
    create: "Новый кастинг",
    blindRule: "Слепой отбор: до рукопожатия вы видите код, Live Snap и Trusted — без имени и контактов.",
    firstCasting: "Кастингов пока нет. Опубликуйте первый бриф — подходящие резидентки увидят его и ответят «Готова».",
    stats: { active: "Активные кастинги", ready: "Ответы «Готова»", handshakes: "Рукопожатия", closing: "Закрываются за 24 ч" },
    filters: { label: "Фильтр кастингов", active: "Активные", open: "Открыт", shortlist: "Шорт-лист", archive: "Архив", all: "Все" },
    searchPlaceholder: "Город или текст брифа",
    stage: { open: "Открыт", shortlist: "Шорт-лист", closed: "Закрыт", cancelled: "Отменён" },
    closing: "Скоро закрытие",
    fresh: (n) => `+${n} ${ru(n, "новый", "новых", "новых")}`,
    days: (n) => `${n} ${ru(n, "день", "дня", "дней")}`,
    ready: (n, s) => `${n} «Готова» · ${s} ${ru(s, "место", "места", "мест")}`,
    fee: "Гонорар",
    feeOpen: "договорной",
    flight: "Перелёт",
    hotel: "Отель",
    height: (cm) => `от ${cm} см`,
    waiting: "Ждём первые «Готова»",
    snaps: (f, t) => `Live Snap ≤ 24 ч · ${f}/${t}`,
    trusted: (n, t) => `Trusted · ${n}/${t}`,
    handshakes: (n) => `Рукопожатие · ${n}`,
    avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — открыть карточку кандидатки`,
    avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — открыть профиль`,
    noSnap: "нет Live Snap",
    closesIn: (d) => `Закрытие через ${d}`,
    closedAt: (a) => `Закрыт ${a}`,
    cancelledAt: (a) => `Отменён ${a}`,
    open: "Открыть",
    room: "Комната тура",
  },
  ES: {
    eyebrow: "Mercado · Castings",
    title: "Castings",
    subtitle: "Tus briefs y la selección a ciegas. El nombre y el perfil se abren solo tras el apretón de manos.",
    create: "Nuevo casting",
    blindRule: "Selección a ciegas: antes del apretón de manos ves un código, Live Snap y Trusted, sin nombre ni contactos.",
    firstCasting: "Aún no hay castings. Publica el primer brief: las residentes que encajen lo verán y responderán «Lista».",
    stats: { active: "Castings activos", ready: "Respuestas «Lista»", handshakes: "Apretones de manos", closing: "Cierran en 24 h" },
    filters: { label: "Filtro de castings", active: "Activos", open: "Abierto", shortlist: "Preselección", archive: "Archivo", all: "Todos" },
    searchPlaceholder: "Ciudad o texto del brief",
    stage: { open: "Abierto", shortlist: "Preselección", closed: "Cerrado", cancelled: "Cancelado" },
    closing: "Cierra pronto",
    fresh: (n) => `+${n} ${pl(n, "nueva", "nuevas")}`,
    days: (n) => `${n} ${pl(n, "día", "días")}`,
    ready: (n, s) => `${n} «Lista» · ${s} ${pl(s, "plaza", "plazas")}`,
    fee: "Caché",
    feeOpen: "a convenir",
    flight: "Vuelo",
    hotel: "Hotel",
    height: (cm) => `desde ${cm} cm`,
    waiting: "Esperando las primeras «Lista»",
    snaps: (f, t) => `Live Snap ≤ 24 h · ${f}/${t}`,
    trusted: (n, t) => `Trusted · ${n}/${t}`,
    handshakes: (n) => `Apretón de manos · ${n}`,
    avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — abrir ficha de la candidata`,
    avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — abrir perfil`,
    noSnap: "sin Live Snap",
    closesIn: (d) => `Cierra en ${d}`,
    closedAt: (a) => `Cerrado ${a}`,
    cancelledAt: (a) => `Cancelado ${a}`,
    open: "Abrir",
    room: "Sala del tour",
  },
  PT: {
    eyebrow: "Mercado · Castings",
    title: "Castings",
    subtitle: "Seus briefs e a seleção às cegas. Nome e perfil abrem só depois do aperto de mão.",
    create: "Novo casting",
    blindRule: "Seleção às cegas: antes do aperto de mão você vê um código, Live Snap e Trusted, sem nome nem contatos.",
    firstCasting: "Ainda não há castings. Publique o primeiro brief — as residentes compatíveis vão vê-lo e responder «Pronta».",
    stats: { active: "Castings ativos", ready: "Respostas «Pronta»", handshakes: "Apertos de mão", closing: "Fecham em 24 h" },
    filters: { label: "Filtro de castings", active: "Ativos", open: "Aberto", shortlist: "Pré-seleção", archive: "Arquivo", all: "Todos" },
    searchPlaceholder: "Cidade ou texto do brief",
    stage: { open: "Aberto", shortlist: "Pré-seleção", closed: "Encerrado", cancelled: "Cancelado" },
    closing: "Fecha em breve",
    fresh: (n) => `+${n} ${pl(n, "nova", "novas")}`,
    days: (n) => `${n} ${pl(n, "dia", "dias")}`,
    ready: (n, s) => `${n} «Pronta» · ${s} ${pl(s, "vaga", "vagas")}`,
    fee: "Cachê",
    feeOpen: "a combinar",
    flight: "Voo",
    hotel: "Hotel",
    height: (cm) => `a partir de ${cm} cm`,
    waiting: "Aguardando as primeiras «Pronta»",
    snaps: (f, t) => `Live Snap ≤ 24 h · ${f}/${t}`,
    trusted: (n, t) => `Trusted · ${n}/${t}`,
    handshakes: (n) => `Aperto de mão · ${n}`,
    avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — abrir ficha da candidata`,
    avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — abrir perfil`,
    noSnap: "sem Live Snap",
    closesIn: (d) => `Fecha em ${d}`,
    closedAt: (a) => `Encerrado ${a}`,
    cancelledAt: (a) => `Cancelado ${a}`,
    open: "Abrir",
    room: "Sala do tour",
  },
};

/* ══════════════════════════════════════════════════════════════════
 * ЛОГИКА
 * ══════════════════════════════════════════════════════════════════ */

const ACTIVE: CastingStage[] = ["open", "shortlist"];
const isActive = (c: CastingBrief) => ACTIVE.includes(c.stage);

function matchesFilter(c: CastingBrief, f: FilterKey) {
  if (f === "all") return true;
  if (f === "active") return isActive(c);
  if (f === "archive") return !isActive(c);
  return c.stage === f;
}

/** Активные — по сроку закрытия, архив — свежие сверху */
function byUrgency(a: CastingBrief, b: CastingBrief) {
  const aa = isActive(a);
  const bb = isActive(b);
  if (aa !== bb) return aa ? -1 : 1;
  return aa ? a.closesAt - b.closesAt : b.closesAt - a.closesAt;
}

const SHOWN_AVATARS = 6;

const BLIND_AVATAR = [
  "from-amber-200/40 to-zinc-800",
  "from-zinc-400/40 to-zinc-800",
  "from-amber-500/30 to-zinc-900",
  "from-rose-200/25 to-zinc-800",
];

/* ══════════════════════════════════════════════════════════════════
 * КАРТОЧКА БРИФА
 * ══════════════════════════════════════════════════════════════════ */

function stageTone(c: CastingBrief, closingSoon: boolean): Tone {
  if (c.stage === "closed" || c.stage === "cancelled") return "zinc";
  if (closingSoon) return "amber";
  return c.stage === "shortlist" ? "gold" : "emerald";
}

function BriefCard({ c, t, cm, fmt }: { c: CastingBrief; t: Dict; cm: Common; fmt: Fmt }) {
  const active = isActive(c);
  const ready = c.responders.length;
  const closingSoon = active && fmt.ready && c.closesAt - fmt.now < 6 * HOUR;
  const fill = clamp(ready / c.slots, 0, 1);
  const days = Math.round((c.endsAt - c.startsAt) / DAY) + 1;
  const ordered = [...c.responders].sort((a, b) => Number(b.handshake) - Number(a.handshake));
  const shown = ordered.slice(0, SHOWN_AVATARS);
  const extra = Math.max(0, ready - shown.length);
  const freshSnaps = c.responders.filter((r) => isFreshSnap(r.snapAt, fmt.now)).length;
  const trusted = c.responders.filter((r) => r.trusted).length;
  const handshakes = c.responders.filter((r) => r.handshake && r.residentId).length;
  const title = `${fmt.city(c.city)} · ${cm.projects[c.project]}`;

  const terms = [
    { icon: Banknote, label: t.fee, value: c.fee ? fmt.money(c.fee.amount, c.fee.currency) : t.feeOpen },
    { icon: Plane, label: t.flight, value: cm.payer[c.flightPaidBy] },
    { icon: BedDouble, label: t.hotel, value: cm.payer[c.hotelPaidBy] },
  ];

  return (
    <article
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-zinc-900/40 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-colors duration-300 hover:border-amber-200/30 ${
        c.stage === "cancelled" ? "border-zinc-800/60 opacity-70" : "border-zinc-800/80"
      }`}
    >
      <Link href={ROUTES.casting(c.id)} aria-label={title} className={OVERLAY_LINK} />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-amber-300/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />

      {/* город · даты · стадия */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.26em] text-zinc-500">
            {cm.projects[c.project]} · {t.days(days)}
          </p>
          <h3 className={`${cormorant.className} mt-1 truncate text-[1.7rem] font-medium leading-tight text-zinc-50`}>
            {fmt.city(c.city)}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">{fmt.range(c.startsAt, c.endsAt)}</p>
          {c.organizer?.official && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-amber-200/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
              <BadgeCheck className="size-3" aria-hidden />
              {c.organizer.name} · Official Club
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Pill tone={stageTone(c, closingSoon)}>{closingSoon ? t.closing : t.stage[c.stage]}</Pill>
          {c.fresh > 0 && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">{t.fresh(c.fresh)}</span>
          )}
        </div>
      </div>

      {/* условия брифа */}
      <dl className="mt-4 grid grid-cols-3 divide-x divide-zinc-800/80 rounded-xl border border-zinc-800/70 bg-zinc-950/40">
        {terms.map(({ icon: Icon, label, value }) => (
          <div key={label} className="min-w-0 px-2.5 py-2">
            <dt className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              <Icon className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="mt-0.5 break-words text-xs leading-snug text-zinc-100 first-letter:uppercase">{value}</dd>
          </div>
        ))}
      </dl>

      {/* требования и текст брифа */}
      {(c.heightMin !== null || c.languages.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.heightMin !== null && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${PILL.zinc}`}>
              <Ruler className="size-3" strokeWidth={1.75} aria-hidden />
              {t.height(c.heightMin)}
            </span>
          )}
          {c.languages.length > 0 && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${PILL.zinc}`}>
              <Languages className="size-3" strokeWidth={1.75} aria-hidden />
              {c.languages.join(" · ")}
            </span>
          )}
        </div>
      )}
      {c.note && <p className={`${cormorant.className} mt-3 line-clamp-2 text-[15px] leading-snug text-zinc-300`}>{c.note}</p>}

      {/* «Готова» из мест */}
      <div className="mt-4">
        <p className="text-xs text-zinc-300">{t.ready(ready, c.slots)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ${
              active ? "bg-gradient-to-r from-amber-500 to-amber-200" : "bg-zinc-600"
            }`}
            style={{ width: `${fill * 100}%` }}
          />
        </div>
      </div>

      {/* слепой шорт-лист: кольцо — Live Snap, звезда — Trusted, инициалы — рукопожатие */}
      <div className="mt-4">
        {ready === 0 ? (
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <Hourglass className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
            {t.waiting}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 py-0.5 pl-0.5">
            {shown.map((r, i) => {
              const snap = snapState(r.snapAt, fmt.now);
              const snapLabel = r.snapAt === null ? t.noSnap : `Live Snap ${fmt.ready ? fmt.since(r.snapAt) : ""}`.trim();
              const revealed = r.handshake && !!r.residentId && !!r.name;
              const label = revealed
                ? t.avatarOpen(r.name ?? "", r.code, snapLabel, r.trusted)
                : t.avatar(r.code, snapLabel, r.trusted);
              return (
                <Link
                  key={r.code}
                  href={revealed && r.residentId ? ROUTES.resident(r.residentId) : ROUTES.castingCandidate(c.id, r.code)}
                  title={label}
                  aria-label={label}
                  className={`relative z-[2] flex size-8 items-center justify-center rounded-full border-2 border-zinc-900 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                    revealed ? "bg-gradient-to-br from-amber-200/40 to-zinc-800" : `bg-gradient-to-br ${BLIND_AVATAR[i % BLIND_AVATAR.length]}`
                  } ${SNAP_RING[snap]}`}
                >
                  {revealed ? (
                    <span className={`${cormorant.className} text-[13px] font-semibold leading-none text-amber-50`}>
                      {initials(r.name ?? "")}
                    </span>
                  ) : (
                    <Lock className="size-3 text-zinc-200/60" strokeWidth={1.75} aria-hidden />
                  )}
                  {r.trusted && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-amber-200 ring-2 ring-zinc-900"
                    >
                      <Star className="size-2 fill-zinc-950 text-zinc-950" />
                    </span>
                  )}
                </Link>
              );
            })}
            {extra > 0 && (
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-zinc-900 bg-zinc-800 text-[10px] font-medium text-zinc-300">
                +{extra}
              </span>
            )}
          </div>
        )}
      </div>

      {ready > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {active && (
            <SignalChip tone={freshSnaps > 0 ? "emerald" : "zinc"} icon={Camera}>
              {t.snaps(freshSnaps, ready)}
            </SignalChip>
          )}
          <SignalChip tone={trusted > 0 ? "gold" : "zinc"} icon={ShieldCheck}>
            {t.trusted(trusted, ready)}
          </SignalChip>
          {handshakes > 0 && (
            <SignalChip tone="emerald" icon={BadgeCheck}>
              {t.handshakes(handshakes)}
            </SignalChip>
          )}
        </div>
      )}

      {/* низ: срок · действие */}
      <div className="mt-auto pt-5">
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 pt-4 text-xs">
          <span className={`flex min-w-0 items-center gap-1.5 ${closingSoon ? "text-amber-200" : "text-zinc-400"}`}>
            <Clock className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {!fmt.ready
                ? "—"
                : active
                  ? t.closesIn(fmt.until(c.closesAt))
                  : c.stage === "cancelled"
                    ? t.cancelledAt(fmt.ago(c.closesAt))
                    : t.closedAt(fmt.ago(c.closesAt))}
            </span>
          </span>
          {c.tourId ? (
            <Link
              href={ROUTES.dealRoom(c.tourId)}
              className="relative z-[2] -my-2 flex min-h-11 shrink-0 items-center gap-1.5 text-amber-200/90 transition-colors hover:text-amber-100 sm:min-h-0"
            >
              <MessagesSquare className="size-3.5" aria-hidden />
              {t.room}
            </Link>
          ) : (
            <span className="flex shrink-0 items-center gap-1 text-amber-200/90 transition-transform duration-300 group-hover:translate-x-0.5">
              {t.open}
              <ChevronRight className="size-3.5" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function SignalChip({ tone, icon: Icon, children }: { tone: Tone; icon: LucideIcon; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${PILL[tone]}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function PartnerCastingsPage() {
  const { lang, c: cm } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const feed = usePartnerFeed("partner_castings_list", parseCastings);
  return (
    <FeedGate feed={feed} c={cm} eyebrow={t.eyebrow} title={t.title}>
      {(data) => <CastingsView data={data} />}
    </FeedGate>
  );
}

function CastingsView({ data }: { data: CastingsData }) {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const [filter, setFilter] = useState<FilterKey>("active");
  const [query, setQuery] = useState("");

  const all = data.castings;
  const active = all.filter(isActive);

  const counts: Record<FilterKey, number> = {
    active: active.length,
    open: all.filter((c) => c.stage === "open").length,
    shortlist: all.filter((c) => c.stage === "shortlist").length,
    archive: all.length - active.length,
    all: all.length,
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((c) => matchesFilter(c, filter))
      .filter((c) => {
        if (!q) return true;
        const hay = [c.city, fmt.city(c.city), cm.projects[c.project], c.note ?? ""].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort(byUrgency);
  }, [all, filter, query, fmt, cm]);

  const readyTotal = active.reduce((s, c) => s + c.responders.length, 0);
  const handshakes = active.reduce((s, c) => s + c.responders.filter((r) => r.handshake).length, 0);
  const closing = fmt.ready ? active.filter((c) => c.closesAt - fmt.now <= DAY).length : null;

  const filterItems = (["active", "open", "shortlist", "archive", "all"] as FilterKey[]).map((key) => ({
    key,
    label: t.filters[key],
    count: counts[key],
  }));

  return (
    <PageShell>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link href={ROUTES.newCasting} className={BTN_GOLD}>
            <Plus className="size-4" aria-hidden />
            {t.create}
          </Link>
        }
      />

      <StatStrip
        items={[
          { label: t.stats.active, value: fmt.num(active.length), icon: Sparkles },
          { label: t.stats.ready, value: fmt.num(readyTotal), icon: Users },
          { label: t.stats.handshakes, value: fmt.num(handshakes), icon: BadgeCheck, tone: handshakes > 0 ? "emerald" : undefined },
          {
            label: t.stats.closing,
            value: closing === null ? "—" : fmt.num(closing),
            icon: Clock,
            tone: closing ? "amber" : undefined,
          },
        ]}
      />

      <PartnerGuide page="castings" />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <FilterTabs items={filterItems} value={filter} onChange={setFilter} label={t.filters.label} />
        <SearchField value={query} onChange={setQuery} placeholder={t.searchPlaceholder} label={cm.search} clearLabel={cm.clear} />
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-amber-200/60" strokeWidth={1.5} aria-hidden />
        {t.blindRule}
      </p>

      <div className="mt-5">
        {all.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-amber-200/20 bg-amber-200/[0.03] p-6 sm:flex-row sm:items-center">
            <Sparkles className="size-5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
            {/* Кнопка «Создать» уже есть в шапке страницы — здесь только подсказка. */}
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-zinc-300">{t.firstCasting}</p>
          </div>
        ) : visible.length === 0 ? (
          <EmptyFilter
            text={cm.nothing}
            reset={cm.reset}
            onReset={() => {
              setFilter("all");
              setQuery("");
            }}
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-4">
            {visible.map((c) => (
              <BriefCard key={c.id} c={c} t={t} cm={cm} fmt={fmt} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
