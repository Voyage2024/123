"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · МАНИФЕСТ — app/(dashboard)/partner/manifest/page.tsx
 *
 * Операции менеджера: табло всех туров, как в аэропорту.
 *   Шапка    ближайший вылет с обратным отсчётом
 *   Цифры    вылеты за 7 дней, что требует действий, кто в туре, закрыто
 *   Фильтры  Активные · Требуют действий · В туре · Закрытые · Отменённые · Все
 *            + поиск по городу, коду аэропорта, рейсу и имени участницы
 *   Табло    время · рейс · направление · состав · контракт · статус
 *
 * Строка ведёт в Комнату тура (рабочее место тура). Имена участниц —
 * ссылки на профиль, поверх строки. ≥ xl — таблица, ниже — карточки.
 *
 * Данные: RPC public.partner_manifest() через usePartnerFeed.
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  FileText,
  FileX2,
  MessagesSquare,
  PenLine,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { DAY } from "../_lib/clock";
import { ROUTES } from "../_lib/routes";
import type { Contract, FlightStatus } from "../_lib/command";
import { pl, ru, usePartnerFormat, type Common, type Fmt } from "../_lib/format";
import { parseManifest,
  type ManifestData, type TourRow, type TourStatus } from "../_lib/manifest";
import { usePartnerFeed } from "../_lib/usePartnerFeed";
import { isSealed } from "../_components/TrustSignals";
import {
  EDGE,
  EmptyFilter,
  FilterTabs,
  OVERLAY_LINK,
  FeedGate,
  PageHeader,
  PageShell,
  Panel,
  Pill,
  SearchField,
  StatStrip,
  cormorant,
  type Tone,
} from "../_components/PartnerUI";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type FilterKey = "active" | "action" | "in_tour" | "closed" | "cancelled" | "all";

type Dict = {
  eyebrow: string;
  title: string;
  subtitle: string;
  next: { label: string; none: string; in: (d: string) => string };
  stats: { week: string; action: string; inTour: string; closed: string };
  filters: Record<FilterKey, string> & { label: string };
  searchPlaceholder: string;
  board: { title: string; cols: { time: string; flight: string; route: string; crew: string; contract: string; status: string } };
  readiness: Record<FlightStatus, string>;
  status: Record<Exclude<TourStatus, "confirmed">, string>;
  outcome: (flown: number, total: number) => string;
  departsIn: (d: string) => string;
  departedAgo: (d: string) => string;
  returnsIn: (d: string) => string;
  crew: (n: number) => string;
  docs: (a: number, b: number) => string;
  docsOk: string;
  docsMissing: string;
  replacement: string;
  seal: { none: string; sealed: string; pending: string; version: (v: number) => string };
  room: string;
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Operations · Manifest",
    title: "Manifest",
    subtitle: "The board of your tours, from confirmation to closing. Each row opens the tour room.",
    next: { label: "Next departure", none: "No departures scheduled", in: (d) => `in ${d}` },
    stats: { week: "Departures · 7 days", action: "Need action", inTour: "On tour now", closed: "Closed tours" },
    filters: { label: "Tour filter", active: "Active", action: "Need action", in_tour: "On tour", closed: "Closed", cancelled: "Cancelled", all: "All" },
    searchPlaceholder: "City, airport, flight or name",
    board: {
      title: "Departures",
      cols: { time: "Departure", flight: "Flight", route: "Destination", crew: "Crew", contract: "Contract", status: "Status" },
    },
    readiness: { confirmed: "Confirmed", contract: "Awaiting signatures", docs: "Awaiting documents", replacement: "Drop → Replaced" },
    status: { in_tour: "On tour", closed: "Closed", cancelled: "Cancelled" },
    outcome: (f, t) => `${f}/${t} flew`,
    departsIn: (d) => `departs in ${d}`,
    departedAgo: (d) => `${d} ago`,
    returnsIn: (d) => `back in ${d}`,
    crew: (n) => `${n} ${pl(n, "participant", "participants")}`,
    docs: (a, b) => `documents ${a}/${b}`,
    docsOk: "documents verified",
    docsMissing: "awaiting documents",
    replacement: "Replacement:",
    seal: { none: "No contract", sealed: "Signed by all", pending: "Signing", version: (v) => `v${v}` },
    room: "Tour room",
  },
  RU: {
    eyebrow: "Операции · Манифест",
    title: "Манифест",
    subtitle: "Табло ваших туров — от подтверждения до закрытия. Строка открывает Комнату тура.",
    next: { label: "Ближайший вылет", none: "Вылетов не запланировано", in: (d) => `через ${d}` },
    stats: { week: "Вылеты · 7 дней", action: "Требуют действий", inTour: "В туре сейчас", closed: "Закрытые туры" },
    filters: {
      label: "Фильтр туров",
      active: "Активные",
      action: "Требуют действий",
      in_tour: "В туре",
      closed: "Закрытые",
      cancelled: "Отменённые",
      all: "Все",
    },
    searchPlaceholder: "Город, аэропорт, рейс или имя",
    board: {
      title: "Вылеты",
      cols: { time: "Вылет", flight: "Рейс", route: "Направление", crew: "Состав", contract: "Контракт", status: "Статус" },
    },
    readiness: { confirmed: "Подтверждено", contract: "Ждём подписи", docs: "Ждём документы", replacement: "Срыв → Замена" },
    status: { in_tour: "В туре", closed: "Закрыт", cancelled: "Отменён" },
    outcome: (f, t) => `долетели ${f}/${t}`,
    departsIn: (d) => `вылет через ${d}`,
    departedAgo: (d) => `${d} назад`,
    returnsIn: (d) => `возвращение через ${d}`,
    crew: (n) => `${n} ${ru(n, "участница", "участницы", "участниц")}`,
    docs: (a, b) => `документы ${a}/${b}`,
    docsOk: "документы проверены",
    docsMissing: "ждём документы",
    replacement: "Замена:",
    seal: { none: "Нет контракта", sealed: "Подписан всеми", pending: "Подписание", version: (v) => `v${v}` },
    room: "Комната тура",
  },
  ES: {
    eyebrow: "Operaciones · Manifiesto",
    title: "Manifiesto",
    subtitle: "El panel de tus tours, de la confirmación al cierre. Cada fila abre la sala del tour.",
    next: { label: "Próxima salida", none: "No hay salidas programadas", in: (d) => `en ${d}` },
    stats: { week: "Salidas · 7 días", action: "Requieren acción", inTour: "De tour ahora", closed: "Tours cerrados" },
    filters: {
      label: "Filtro de tours",
      active: "Activos",
      action: "Requieren acción",
      in_tour: "De tour",
      closed: "Cerrados",
      cancelled: "Cancelados",
      all: "Todos",
    },
    searchPlaceholder: "Ciudad, aeropuerto, vuelo o nombre",
    board: {
      title: "Salidas",
      cols: { time: "Salida", flight: "Vuelo", route: "Destino", crew: "Equipo", contract: "Contrato", status: "Estado" },
    },
    readiness: { confirmed: "Confirmado", contract: "Faltan firmas", docs: "Faltan documentos", replacement: "Baja → Reemplazo" },
    status: { in_tour: "De tour", closed: "Cerrado", cancelled: "Cancelado" },
    outcome: (f, t) => `viajaron ${f}/${t}`,
    departsIn: (d) => `sale en ${d}`,
    departedAgo: (d) => `hace ${d}`,
    returnsIn: (d) => `regreso en ${d}`,
    crew: (n) => `${n} ${pl(n, "participante", "participantes")}`,
    docs: (a, b) => `documentos ${a}/${b}`,
    docsOk: "documentos verificados",
    docsMissing: "faltan documentos",
    replacement: "Reemplazo:",
    seal: { none: "Sin contrato", sealed: "Firmado por todos", pending: "En firma", version: (v) => `v${v}` },
    room: "Sala del tour",
  },
  PT: {
    eyebrow: "Operações · Manifesto",
    title: "Manifesto",
    subtitle: "O painel dos seus tours, da confirmação ao encerramento. Cada linha abre a sala do tour.",
    next: { label: "Próximo embarque", none: "Nenhum embarque programado", in: (d) => `em ${d}` },
    stats: { week: "Embarques · 7 dias", action: "Exigem ação", inTour: "Em tour agora", closed: "Tours encerrados" },
    filters: {
      label: "Filtro de tours",
      active: "Ativos",
      action: "Exigem ação",
      in_tour: "Em tour",
      closed: "Encerrados",
      cancelled: "Cancelados",
      all: "Todos",
    },
    searchPlaceholder: "Cidade, aeroporto, voo ou nome",
    board: {
      title: "Embarques",
      cols: { time: "Embarque", flight: "Voo", route: "Destino", crew: "Equipe", contract: "Contrato", status: "Status" },
    },
    readiness: { confirmed: "Confirmado", contract: "Aguardando assinaturas", docs: "Aguardando documentos", replacement: "Desistência → Substituta" },
    status: { in_tour: "Em tour", closed: "Encerrado", cancelled: "Cancelado" },
    outcome: (f, t) => `embarcaram ${f}/${t}`,
    departsIn: (d) => `embarque em ${d}`,
    departedAgo: (d) => `há ${d}`,
    returnsIn: (d) => `volta em ${d}`,
    crew: (n) => `${n} ${pl(n, "participante", "participantes")}`,
    docs: (a, b) => `documentos ${a}/${b}`,
    docsOk: "documentos verificados",
    docsMissing: "aguardando documentos",
    replacement: "Substituta:",
    seal: { none: "Sem contrato", sealed: "Assinado por todos", pending: "Em assinatura", version: (v) => `v${v}` },
    room: "Sala do tour",
  },
};

/* ══════════════════════════════════════════════════════════════════
 * ЛОГИКА
 * ══════════════════════════════════════════════════════════════════ */

const needsAction = (r: TourRow) => r.status === "confirmed" && r.readiness !== null && r.readiness !== "confirmed";
const isActive = (r: TourRow) => r.status === "confirmed" || r.status === "in_tour";

function matches(r: TourRow, f: FilterKey) {
  switch (f) {
    case "active":
      return isActive(r);
    case "action":
      return needsAction(r);
    case "all":
      return true;
    default:
      return r.status === f;
  }
}

/** Активные — по времени вылета, закрытые и отменённые — свежие сверху */
function boardOrder(a: TourRow, b: TourRow) {
  const aa = isActive(a);
  const bb = isActive(b);
  if (aa !== bb) return aa ? -1 : 1;
  return aa ? a.departsAt - b.departsAt : b.departsAt - a.departsAt;
}

// Красный — только срыв; «ждём» — янтарный, как в Штабе
const READINESS_TONE: Record<FlightStatus, Tone> = { confirmed: "emerald", contract: "amber", docs: "amber", replacement: "rose" };
const READINESS_ICON: Record<FlightStatus, LucideIcon> = { confirmed: Check, contract: PenLine, docs: FileText, replacement: RefreshCw };

function rowTone(r: TourRow): Tone {
  if (r.status === "confirmed") return READINESS_TONE[r.readiness ?? "confirmed"];
  if (r.status === "in_tour") return "gold";
  return "zinc";
}

/* ══════════════════════════════════════════════════════════════════
 * ДЕТАЛИ ТАБЛО
 * ══════════════════════════════════════════════════════════════════ */

/** Код аэропорта перекидными табличками */
function FlapCode({ code, muted }: { code: string; muted?: boolean }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={code} role="img">
      {code.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden
          className={`relative flex h-7 w-[1.375rem] items-center justify-center overflow-hidden rounded-[4px] border bg-gradient-to-b from-zinc-800 to-zinc-950 font-mono text-[15px] font-semibold leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-black/70 ${
            muted ? "border-zinc-800 text-zinc-500" : "border-zinc-700/80 text-amber-200"
          }`}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function SealMini({ contract, t }: { contract: Contract | null; t: Dict }) {
  if (!contract) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
        <FileX2 className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
        {t.seal.none}
      </span>
    );
  }
  const sealed = isSealed(contract);
  const Icon = sealed ? ShieldCheck : PenLine;
  return (
    <span className="flex min-w-0 items-start gap-2">
      <Icon
        className={`mt-0.5 size-3.5 shrink-0 ${sealed ? "text-emerald-300" : "text-amber-300"}`}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0">
        <span className={`block truncate text-xs ${sealed ? "text-emerald-100" : "text-amber-100"}`}>
          {sealed ? t.seal.sealed : t.seal.pending}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] tracking-wide text-zinc-500">
          {t.seal.version(contract.version)} · {contract.signed}/{contract.required}
        </span>
      </span>
    </span>
  );
}

function StatusCell({ r, t }: { r: TourRow; t: Dict }) {
  const tone = rowTone(r);
  if (r.status === "confirmed") {
    const key = r.readiness ?? "confirmed";
    return (
      <Pill tone={tone} icon={READINESS_ICON[key]}>
        {t.readiness[key]}
      </Pill>
    );
  }
  return (
    <span className="flex flex-col items-start gap-1 lg:items-end">
      <Pill tone={tone} icon={r.status === "in_tour" ? Plane : undefined}>
        {t.status[r.status]}
      </Pill>
      {r.outcome && (
        <span className={`text-[11px] ${r.outcome.dropped > 0 ? "text-rose-200/80" : "text-zinc-500"}`}>
          {t.outcome(r.outcome.flown, r.outcome.flown + r.outcome.dropped)}
        </span>
      )}
    </span>
  );
}

function TimeCell({ r, t, fmt }: { r: TourRow; t: Dict; fmt: Fmt }) {
  const sub =
    !fmt.ready
      ? "—"
      : r.status === "confirmed"
        ? t.departsIn(fmt.until(r.departsAt))
        : r.status === "in_tour" && r.returnsAt
          ? t.returnsIn(fmt.until(r.returnsAt))
          : t.departedAgo(fmt.since(r.departsAt));
  const soon = r.status === "confirmed" && fmt.ready && r.departsAt - fmt.now < DAY;
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 first-letter:uppercase">
        {fmt.date(r.departsAt, { weekday: "short", day: "numeric", month: "short" })}
      </p>
      <p className={`${cormorant.className} mt-0.5 text-[1.65rem] font-medium leading-none tabular-nums text-zinc-50`}>
        {fmt.date(r.departsAt, { hour: "2-digit", minute: "2-digit" })}
      </p>
      <p className={`mt-1 text-[11px] ${soon ? "text-amber-200" : "text-zinc-500"}`}>{sub}</p>
    </div>
  );
}

function CrewCell({ r, t }: { r: TourRow; t: Dict }) {
  const docsReady = r.crew.filter((c) => c.docs).length;
  const live = r.status === "confirmed" || r.status === "in_tour";
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1.5">
        {r.crew.map((c, i) => {
          const tone =
            !live
              ? "border-zinc-700/80 bg-zinc-800/40 text-zinc-300 hover:border-zinc-500"
              : c.docs
                ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100 hover:border-emerald-300/60"
                : "border-amber-400/30 bg-amber-400/[0.07] text-amber-100 hover:border-amber-300/60";
          const cls = `relative z-[2] inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border px-2 text-[11px] transition ${tone}`;
          const hint = c.docs ? t.docsOk : t.docsMissing;
          const body = (
            <>
              {live &&
                (c.docs ? <Check className="size-3 shrink-0" aria-hidden /> : <FileText className="size-3 shrink-0" aria-hidden />)}
              <span className="truncate">{c.name}</span>
            </>
          );
          return c.id ? (
            <Link key={c.id} href={ROUTES.resident(c.id)} title={live ? `${c.name} · ${hint}` : c.name} className={cls}>
              {body}
            </Link>
          ) : (
            <span key={`${c.name}-${i}`} className={cls}>
              {body}
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-500">
        {t.crew(r.crew.length)}
        {live && ` · ${t.docs(docsReady, r.crew.length)}`}
      </p>
    </div>
  );
}

/**
 * Три раскладки строки по ширине контента (сайдбар съедает 288 px):
 *   телефон и планшет  карточка: время · статус / рейс / состав / контракт
 *   ≥ lg               две строки: время | рейс · статус / время | состав · контракт
 *   ≥ 1360 px          таблица табло в одну строку
 */
const ROW_LAYOUT = [
  "lg:grid-cols-[8.5rem_minmax(0,1fr)_auto] lg:gap-y-3 lg:[grid-template-areas:'time_route_status'_'time_crew_seal']",
  "min-[1360px]:grid-cols-[9rem_minmax(0,1.1fr)_minmax(0,1fr)_9.5rem_11rem] min-[1360px]:items-center min-[1360px]:gap-y-0",
  "min-[1360px]:rounded-none min-[1360px]:border-x-0 min-[1360px]:border-b-0 min-[1360px]:border-t min-[1360px]:bg-transparent",
  "min-[1360px]:py-5 min-[1360px]:[grid-template-areas:'time_route_crew_seal_status'] min-[1360px]:first:border-t-0",
].join(" ");

function BoardRow({ r, t, cm, fmt }: { r: TourRow; t: Dict; cm: Common; fmt: Fmt }) {
  const tone = rowTone(r);
  const muted = r.status === "closed" || r.status === "cancelled";
  const title = `${fmt.city(r.city)} · ${cm.projects[r.project]}`;

  return (
    <li
      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4 pl-5 transition-colors [grid-template-areas:'time_status'_'route_route'_'crew_crew'_'seal_seal'] before:absolute before:inset-y-4 before:left-0 before:w-[3px] before:rounded-r-full hover:border-zinc-700 hover:bg-zinc-900/50 ${ROW_LAYOUT} ${EDGE[tone]} ${
        r.status === "cancelled" ? "opacity-60" : ""
      }`}
    >
      <Link href={ROUTES.dealRoom(r.id)} aria-label={`${title} — ${t.room}`} className={OVERLAY_LINK} />

      <div className="[grid-area:time]">
        <TimeCell r={r} t={t} fmt={fmt} />
      </div>

      <div className="min-w-0 [grid-area:route]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {r.iata && <FlapCode code={r.iata} muted={muted} />}
          <div className="min-w-0">
            <p className={`${cormorant.className} truncate text-xl font-medium leading-tight text-zinc-50`}>{fmt.city(r.city)}</p>
            <p className="truncate text-[11px] text-zinc-500">
              {cm.projects[r.project]}
              {r.flightNo && (
                <>
                  {" · "}
                  <span className="font-mono tracking-wider text-zinc-400">{r.flightNo}</span>
                </>
              )}
            </p>
          </div>
        </div>
        {r.replacement && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-rose-200/90">
            <RefreshCw className="size-3 shrink-0" aria-hidden />
            {t.replacement}
            {r.replacementId ? (
              <Link
                href={ROUTES.resident(r.replacementId)}
                className="relative z-[2] font-medium text-rose-100 underline-offset-4 hover:underline"
              >
                {r.replacement}
              </Link>
            ) : (
              <span className="font-medium text-rose-100">{r.replacement}</span>
            )}
          </p>
        )}
      </div>

      <div className="min-w-0 [grid-area:crew]">
        <CrewCell r={r} t={t} />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-zinc-800/70 pt-3 [grid-area:seal] lg:justify-end lg:gap-5 lg:self-end lg:border-0 lg:pt-0 min-[1360px]:justify-start min-[1360px]:self-auto">
        <SealMini contract={r.contract} t={t} />
        <span className="flex shrink-0 items-center gap-1 text-xs text-amber-200/90 min-[1360px]:hidden">
          <MessagesSquare className="size-3.5" aria-hidden />
          {t.room}
        </span>
      </div>

      <div className="flex items-start justify-end gap-2 [grid-area:status] min-[1360px]:items-center">
        <StatusCell r={r} t={t} />
        <ChevronRight
          className="hidden size-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-200 min-[1360px]:block"
          aria-hidden
        />
      </div>
    </li>
  );
}

/** Карточка ближайшего вылета в шапке */
function NextDeparture({ r, t, cm, fmt }: { r: TourRow | null; t: Dict; cm: Common; fmt: Fmt }) {
  if (!r) {
    return (
      <div className="flex min-w-0 flex-[1_1_18rem] items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 text-sm text-zinc-400 backdrop-blur-xl">
        <PlaneLanding className="size-5 shrink-0 text-zinc-500" strokeWidth={1.5} aria-hidden />
        {t.next.none}
      </div>
    );
  }
  return (
    <Link
      href={ROUTES.dealRoom(r.id)}
      className="group relative flex min-w-0 flex-[1_1_18rem] items-center gap-4 overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-200/[0.07] via-zinc-900/60 to-zinc-950/80 p-4 backdrop-blur-xl transition-colors hover:border-amber-200/35 sm:max-w-md"
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-amber-300/10 blur-2xl" />
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-zinc-950/60 shadow-[0_0_24px_-6px_rgba(253,230,138,0.45)]">
        <PlaneTakeoff className="size-5 text-amber-200" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.next.label}</p>
        <p className={`${cormorant.className} truncate text-2xl font-semibold leading-tight text-zinc-50`}>
          {r.iata && <span className="mr-2 font-sans text-sm font-medium tracking-[0.2em] text-amber-200">{r.iata}</span>}
          {fmt.city(r.city)}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-zinc-400">
          {fmt.ready ? t.next.in(fmt.until(r.departsAt)) : "—"} · {cm.projects[r.project]}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-200" aria-hidden />
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function PartnerManifestPage() {
  const { lang, c: cm } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const feed = usePartnerFeed("partner_manifest", parseManifest);
  return (
    <FeedGate feed={feed} c={cm} eyebrow={t.eyebrow} title={t.title}>
      {(data) => <ManifestView data={data} />}
    </FeedGate>
  );
}

function ManifestView({ data }: { data: ManifestData }) {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const [filter, setFilter] = useState<FilterKey>("active");
  const [query, setQuery] = useState("");

  const tours = data.tours;

  const counts = useMemo(() => {
    const keys: FilterKey[] = ["active", "action", "in_tour", "closed", "cancelled", "all"];
    return Object.fromEntries(keys.map((k) => [k, tours.filter((r) => matches(r, k)).length])) as Record<FilterKey, number>;
  }, [tours]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tours
      .filter((r) => matches(r, filter))
      .filter((r) => {
        if (!q) return true;
        const hay = [r.city, fmt.city(r.city), r.iata ?? "", r.flightNo ?? "", cm.projects[r.project], ...r.crew.map((c) => c.name)]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort(boardOrder);
  }, [tours, filter, query, fmt, cm]);

  const upcoming = tours.filter((r) => r.status === "confirmed").sort((a, b) => a.departsAt - b.departsAt);
  const next = fmt.ready ? (upcoming.find((r) => r.departsAt > fmt.now) ?? null) : (upcoming[0] ?? null);
  const week = fmt.ready ? upcoming.filter((r) => r.departsAt > fmt.now && r.departsAt - fmt.now <= 7 * DAY).length : null;

  const filterItems = (["active", "action", "in_tour", "closed", "cancelled", "all"] as FilterKey[]).map((key) => ({
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
        aside={<NextDeparture r={next} t={t} cm={cm} fmt={fmt} />}
      />

      <StatStrip
        items={[
          { label: t.stats.week, value: week === null ? "—" : fmt.num(week), icon: PlaneTakeoff },
          {
            label: t.stats.action,
            value: fmt.num(counts.action),
            icon: AlertTriangle,
            tone: counts.action > 0 ? "amber" : undefined,
          },
          { label: t.stats.inTour, value: fmt.num(counts.in_tour), icon: Plane, tone: counts.in_tour > 0 ? "gold" : undefined },
          { label: t.stats.closed, value: fmt.num(counts.closed), icon: PlaneLanding },
        ]}
      />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <FilterTabs items={filterItems} value={filter} onChange={setFilter} label={t.filters.label} />
        <SearchField value={query} onChange={setQuery} placeholder={t.searchPlaceholder} label={cm.search} clearLabel={cm.clear} />
      </div>

      <div className="mt-5">
        {visible.length === 0 ? (
          <EmptyFilter
            text={cm.nothing}
            reset={cm.reset}
            onReset={() => {
              setFilter("all");
              setQuery("");
            }}
          />
        ) : (
          <Panel className="p-3 sm:p-4 min-[1360px]:px-6 min-[1360px]:py-2" label={t.board.title}>
            {/* шапка табло — только в табличном режиме */}
            <div
              aria-hidden
              className="hidden grid-cols-[9rem_minmax(0,1.1fr)_minmax(0,1fr)_9.5rem_11rem] gap-x-4 border-b border-zinc-800/80 pb-3 pl-5 pt-3 text-[10px] uppercase tracking-[0.24em] text-zinc-500 min-[1360px]:grid"
            >
              <span>{t.board.cols.time}</span>
              <span>
                {t.board.cols.flight} · {t.board.cols.route}
              </span>
              <span>{t.board.cols.crew}</span>
              <span>{t.board.cols.contract}</span>
              <span className="text-right">{t.board.cols.status}</span>
            </div>
            <ol className="space-y-3 min-[1360px]:space-y-0">
              {visible.map((r) => (
                <BoardRow key={r.id} r={r} t={t} cm={cm} fmt={fmt} />
              ))}
            </ol>
          </Panel>
        )}
      </div>
    </PageShell>
  );
}
