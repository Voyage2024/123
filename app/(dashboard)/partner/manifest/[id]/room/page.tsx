"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · DEAL ROOM (КОМНАТА ТУРА)
 * app/(dashboard)/partner/manifest/[id]/room/page.tsx
 *
 * Здесь менеджер закрывает главный риск тура — деньги и срывы:
 *
 *   Digital Contract  условия (перелёт, отель, гонорар, отмена) → «Подписать
 *                     и отправить на подпись» → участницы подписывают в
 *                     Telegram. Подписи по каждой стороне, напоминания,
 *                     история версий. Условия меняются только новой версией.
 *   Состав            документы, Live Snap, Trusted, Telegram у каждой
 *                     участницы; имя — ссылка на профиль.
 *   Лог тура          кто и когда загрузил документы, подписал, заменил,
 *                     напомнил. Пишет сервер, править нельзя.
 *
 * Данные: _lib/useDealRoom — демо или RPC partner_deal_room
 * (NEXT_PUBLIC_PARTNER_DATA=live). Действия: _lib/actions → очередь Telegram.
 * Тур закрыт — комната только для чтения.
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BadgeCheck,
  Check,
  ChevronRight,
  Clock,
  FileCheck,
  FileText,
  History,
  Lock,
  PenLine,
  Plane,
  Repeat,
  RotateCw,
  ScrollText,
  Send,
  ShieldAlert,
  Unlink,
  UserMinus,
  UserPlus,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { MIN, UNITS, fmtDur, useNow, type Units } from "../../../_lib/clock";
import type { ContractTerms, ProjectKey } from "../../../_lib/command";
import {
  applyReminderLocally,
  applySentLocally,
  roomContract,
  type DealRoomData,
  type RoomEvent,
  type RoomEventKind,
  type RoomParty,
  type RoomTourStatus,
} from "../../../_lib/dealRoom";
import { useDealRoom } from "../../../_lib/useDealRoom";
import { notifyTour, sendContract, type NotifyResult } from "../../../_lib/actions";
import { ROUTES } from "../../../_lib/routes";
import { cityLabel } from "../../../_lib/cities";
import { ContractSeal, LiveSnapBadge, TrustBadge } from "../../../_components/TrustSignals";
import { TelegramAction } from "../../../_components/TelegramAction";
import { ContractEditor } from "../../../_components/ContractEditor";
import { cormorant } from "@/app/components/profile/fonts";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type LogFilter = "all" | "contract" | "docs" | "crew" | "telegram";

type Dict = {
  locale: string;
  crumbs: { command: string; manifest: string };
  eyebrow: string;
  demo: string;
  title: string;
  privacy: string;
  departs: string;
  departsIn: (d: string) => string;
  departed: string;
  status: Record<RoomTourStatus, string>;
  projects: Record<ProjectKey, string>;
  readOnly: string;
  state: {
    loading: string;
    retry: string;
    error: { forbidden: string; missing: string; network: string; unknown: string };
    hint: { forbidden: string; missing: string; network: string; unknown: string };
  };
  contract: {
    eyebrow: string;
    title: string;
    edit: string;
    create: string;
    noContract: string;
    signatures: string;
    you: string;
    role: { manager: string; participant: string };
    signed: (time: string) => string;
    waiting: string;
    remind: string;
    remindAll: string;
    noTelegram: string;
    sentBanner: (v: number, queued: number) => string;
    sentMissing: (names: string) => string;
    history: (n: number) => string;
    current: string;
    replaced: (v: number) => string;
    byLine: (name: string, date: string, a: number, b: number) => string;
  };
  crew: {
    eyebrow: string;
    title: string;
    remindDocs: string;
    docsOk: (date: string) => string;
    docsMissing: string;
    instead: (name: string) => string;
    telegramOn: string;
    telegramOff: string;
    empty: string;
  };
  log: {
    eyebrow: string;
    title: string;
    filters: Record<LogFilter, string>;
    empty: string;
    today: string;
    yesterday: string;
    roles: { manager: string; participant: string; admin: string; system: string };
    text: {
      contract_sent: (v: number) => string;
      contract_signed: (v: number) => string;
      docs_uploaded: (doc: string) => string;
      docs_verified: string;
      member_joined: string;
      member_replaced: string;
      member_status: Record<string, string>;
      reminder_sent: { docs_reminder: string; contract_reminder: string };
      tour_status: (s: string) => string;
    };
    docs: { passport: string; snaps: string; visa: string; other: string };
    instead: (name: string) => string;
    recipients: (n: number) => string;
  };
};

const ru = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
  return c;
};
const one = (n: number, a: string, b: string) => (n === 1 ? a : b);

const T: Record<Lang, Dict> = {
  EN: {
    locale: "en-GB",
    crumbs: { command: "Command", manifest: "Manifest" },
    eyebrow: "Deal Room",
    demo: "Demo data",
    title: "Tour room",
    privacy: "Visible only to you, the tour participants and the club administrator.",
    departs: "Departure",
    departsIn: (d) => `in ${d}`,
    departed: "departed",
    status: { confirmed: "Confirmed", in_tour: "On tour", closed: "Closed", cancelled: "Cancelled" },
    projects: { shoot: "shoot", show: "show", campaign: "campaign", event: "event" },
    readOnly: "The tour is closed — this room is read-only. Terms and the log are kept.",
    state: {
      loading: "Loading the room…",
      retry: "Retry",
      error: {
        forbidden: "This room is for the tour’s manager",
        missing: "The database isn’t updated yet",
        network: "No connection to the server",
        unknown: "Couldn’t load the room",
      },
      hint: {
        forbidden: "Only the manager of this tour and the club administrator can open it.",
        missing: "Apply the partner_deal_room migration in Supabase, then reload.",
        network: "Check your connection — the room will retry automatically.",
        unknown: "Try again in a minute. If it repeats, send the error to the admin.",
      },
    },
    contract: {
      eyebrow: "Digital Contract",
      title: "Terms and signatures",
      edit: "Change terms",
      create: "Draft the terms",
      noContract: "No terms have been set for this tour.",
      signatures: "Signatures",
      you: "you",
      role: { manager: "Manager", participant: "Participant" },
      signed: (t) => `Signed · ${t}`,
      waiting: "Awaiting signature",
      remind: "Remind",
      remindAll: "Remind everyone who hasn’t signed",
      noTelegram: "Telegram not linked",
      sentBanner: (v, q) => `v${v} sent for signature · ${q} ${one(q, "participant", "participants")} notified in Telegram`,
      sentMissing: (n) => `No Telegram — tell them in person: ${n}`,
      history: (n) => `Version history · ${n}`,
      current: "in force",
      replaced: (v) => `replaced by v${v}`,
      byLine: (name, date, a, b) => `${name} · ${date} · signed ${a}/${b}`,
    },
    crew: {
      eyebrow: "Crew",
      title: "Line-up",
      remindDocs: "Remind about documents",
      docsOk: (d) => `Documents verified · ${d}`,
      docsMissing: "Awaiting documents",
      instead: (n) => `replacing ${n}`,
      telegramOn: "Telegram linked",
      telegramOff: "No Telegram",
      empty: "Nobody in the line-up yet.",
    },
    log: {
      eyebrow: "Log",
      title: "Tour log",
      filters: { all: "All", contract: "Contract", docs: "Documents", crew: "Line-up", telegram: "Telegram" },
      empty: "No events yet.",
      today: "Today",
      yesterday: "Yesterday",
      roles: { manager: "manager", participant: "participant", admin: "administrator", system: "Voyage" },
      text: {
        contract_sent: (v) => `Terms v${v} sent for signature`,
        contract_signed: (v) => `Signed v${v}`,
        docs_uploaded: (d) => `${d} uploaded`,
        docs_verified: "Documents verified",
        member_joined: "Joined the line-up",
        member_replaced: "Replacement in the line-up",
        member_status: {
          flown: "Arrived", released: "Withdrew in advance", late_drop: "Late drop-out", no_show: "No-show", confirmed: "Back in the line-up",
        },
        reminder_sent: { docs_reminder: "Telegram reminder: documents", contract_reminder: "Telegram reminder: signature" },
        tour_status: (s) => `Tour status: ${s}`,
      },
      docs: { passport: "Passport", snaps: "Live Snaps", visa: "Visa", other: "Document" },
      instead: (n) => `replacing ${n}`,
      recipients: (n) => `${n} ${one(n, "recipient", "recipients")}`,
    },
  },

  RU: {
    locale: "ru-RU",
    crumbs: { command: "Штаб", manifest: "Манифест" },
    eyebrow: "Deal Room",
    demo: "Демо-данные",
    title: "Комната тура",
    privacy: "Видят только вы, участницы тура и администратор клуба.",
    departs: "Вылет",
    departsIn: (d) => `через ${d}`,
    departed: "вылетели",
    status: { confirmed: "Подтверждён", in_tour: "В туре", closed: "Закрыт", cancelled: "Отменён" },
    projects: { shoot: "съёмка", show: "показ", campaign: "кампейн", event: "ивент" },
    readOnly: "Тур закрыт — комната только для чтения. Условия и лог сохранены.",
    state: {
      loading: "Загружаем комнату…",
      retry: "Повторить",
      error: {
        forbidden: "Комната доступна менеджеру тура",
        missing: "База ещё не обновлена",
        network: "Нет связи с сервером",
        unknown: "Не удалось загрузить комнату",
      },
      hint: {
        forbidden: "Открыть её могут только менеджер этого тура и администратор клуба.",
        missing: "Примените миграцию partner_deal_room в Supabase и обновите страницу.",
        network: "Проверьте интернет — комната повторит попытку сама.",
        unknown: "Попробуйте через минуту. Если повторится — отправьте ошибку администратору.",
      },
    },
    contract: {
      eyebrow: "Digital Contract",
      title: "Условия и подписи",
      edit: "Изменить условия",
      create: "Составить условия",
      noContract: "Условия для этого тура не заданы.",
      signatures: "Подписи",
      you: "вы",
      role: { manager: "Менеджер", participant: "Участница" },
      signed: (t) => `Подписано · ${t}`,
      waiting: "Ждём подписи",
      remind: "Напомнить",
      remindAll: "Напомнить всем, кто не подписал",
      noTelegram: "Telegram не подключён",
      sentBanner: (v, q) =>
        `Версия v${v} отправлена на подпись · в Telegram получили ${q} ${ru(q, "участница", "участницы", "участниц")}`,
      sentMissing: (n) => `Без Telegram — сообщите лично: ${n}`,
      history: (n) => `История версий · ${n}`,
      current: "действует",
      replaced: (v) => `заменена v${v}`,
      byLine: (name, date, a, b) => `${name} · ${date} · подписи ${a}/${b}`,
    },
    crew: {
      eyebrow: "Crew",
      title: "Состав",
      remindDocs: "Напомнить о документах",
      docsOk: (d) => `Документы проверены · ${d}`,
      docsMissing: "Ждём документы",
      instead: (n) => `вместо ${n}`,
      telegramOn: "Telegram подключён",
      telegramOff: "Нет Telegram",
      empty: "В составе пока никого.",
    },
    log: {
      eyebrow: "Log",
      title: "Лог тура",
      filters: { all: "Все", contract: "Контракт", docs: "Документы", crew: "Состав", telegram: "Telegram" },
      empty: "Событий пока нет.",
      today: "Сегодня",
      yesterday: "Вчера",
      roles: { manager: "менеджер", participant: "участница", admin: "администратор", system: "Voyage" },
      text: {
        contract_sent: (v) => `Условия v${v} отправлены на подпись`,
        contract_signed: (v) => `Подпись под v${v}`,
        docs_uploaded: (d) => `Загружен документ: ${d}`,
        docs_verified: "Документы проверены",
        member_joined: "В составе тура",
        member_replaced: "Замена в составе",
        member_status: {
          flown: "Долетела", released: "Снялась заранее", late_drop: "Поздний срыв", no_show: "Не прилетела", confirmed: "Вернулась в состав",
        },
        reminder_sent: { docs_reminder: "Напоминание о документах в Telegram", contract_reminder: "Напоминание о подписи в Telegram" },
        tour_status: (s) => `Статус тура: ${s}`,
      },
      docs: { passport: "паспорт", snaps: "Live Snaps", visa: "виза", other: "документ" },
      instead: (n) => `вместо ${n}`,
      recipients: (n) => `${n} ${ru(n, "получательница", "получательницы", "получательниц")}`,
    },
  },

  ES: {
    locale: "es-ES",
    crumbs: { command: "Cuartel", manifest: "Manifiesto" },
    eyebrow: "Deal Room",
    demo: "Datos de demostración",
    title: "Sala del tour",
    privacy: "Solo la ven tú, las participantes del tour y el administrador del club.",
    departs: "Salida",
    departsIn: (d) => `en ${d}`,
    departed: "ya salió",
    status: { confirmed: "Confirmado", in_tour: "En tour", closed: "Cerrado", cancelled: "Cancelado" },
    projects: { shoot: "sesión", show: "desfile", campaign: "campaña", event: "evento" },
    readOnly: "El tour está cerrado: la sala es de solo lectura. Las condiciones y el registro se conservan.",
    state: {
      loading: "Cargando la sala…",
      retry: "Reintentar",
      error: {
        forbidden: "La sala es para el gerente del tour",
        missing: "La base de datos aún no está actualizada",
        network: "Sin conexión con el servidor",
        unknown: "No se pudo cargar la sala",
      },
      hint: {
        forbidden: "Solo pueden abrirla el gerente de este tour y el administrador del club.",
        missing: "Aplica la migración partner_deal_room en Supabase y recarga.",
        network: "Revisa tu conexión: la sala lo reintentará sola.",
        unknown: "Inténtalo en un minuto. Si se repite, envía el error al administrador.",
      },
    },
    contract: {
      eyebrow: "Digital Contract",
      title: "Condiciones y firmas",
      edit: "Cambiar condiciones",
      create: "Redactar condiciones",
      noContract: "No hay condiciones para este tour.",
      signatures: "Firmas",
      you: "tú",
      role: { manager: "Gerente", participant: "Participante" },
      signed: (t) => `Firmado · ${t}`,
      waiting: "Falta la firma",
      remind: "Recordar",
      remindAll: "Recordar a quien no ha firmado",
      noTelegram: "Telegram no vinculado",
      sentBanner: (v, q) => `v${v} enviada a firma · ${q} ${one(q, "participante avisada", "participantes avisadas")} en Telegram`,
      sentMissing: (n) => `Sin Telegram, avisa en persona: ${n}`,
      history: (n) => `Historial de versiones · ${n}`,
      current: "vigente",
      replaced: (v) => `sustituida por v${v}`,
      byLine: (name, date, a, b) => `${name} · ${date} · firmas ${a}/${b}`,
    },
    crew: {
      eyebrow: "Crew",
      title: "Equipo",
      remindDocs: "Recordar documentos",
      docsOk: (d) => `Documentos verificados · ${d}`,
      docsMissing: "Faltan documentos",
      instead: (n) => `en lugar de ${n}`,
      telegramOn: "Telegram vinculado",
      telegramOff: "Sin Telegram",
      empty: "Aún no hay nadie en el equipo.",
    },
    log: {
      eyebrow: "Log",
      title: "Registro del tour",
      filters: { all: "Todo", contract: "Contrato", docs: "Documentos", crew: "Equipo", telegram: "Telegram" },
      empty: "Aún no hay eventos.",
      today: "Hoy",
      yesterday: "Ayer",
      roles: { manager: "gerente", participant: "participante", admin: "administrador", system: "Voyage" },
      text: {
        contract_sent: (v) => `Condiciones v${v} enviadas a firma`,
        contract_signed: (v) => `Firma de la v${v}`,
        docs_uploaded: (d) => `Documento subido: ${d}`,
        docs_verified: "Documentos verificados",
        member_joined: "Entró en el equipo",
        member_replaced: "Reemplazo en el equipo",
        member_status: {
          flown: "Viajó", released: "Se retiró con antelación", late_drop: "Baja tardía", no_show: "No se presentó", confirmed: "Volvió al equipo",
        },
        reminder_sent: { docs_reminder: "Recordatorio de documentos en Telegram", contract_reminder: "Recordatorio de firma en Telegram" },
        tour_status: (s) => `Estado del tour: ${s}`,
      },
      docs: { passport: "pasaporte", snaps: "Live Snaps", visa: "visado", other: "documento" },
      instead: (n) => `en lugar de ${n}`,
      recipients: (n) => `${n} ${one(n, "destinataria", "destinatarias")}`,
    },
  },

  PT: {
    locale: "pt-BR",
    crumbs: { command: "Quartel", manifest: "Manifesto" },
    eyebrow: "Deal Room",
    demo: "Dados de demonstração",
    title: "Sala do tour",
    privacy: "Só você, as participantes do tour e o administrador do clube veem esta sala.",
    departs: "Partida",
    departsIn: (d) => `em ${d}`,
    departed: "já partiu",
    status: { confirmed: "Confirmado", in_tour: "Em tour", closed: "Encerrado", cancelled: "Cancelado" },
    projects: { shoot: "ensaio", show: "desfile", campaign: "campanha", event: "evento" },
    readOnly: "O tour foi encerrado — a sala é só leitura. Condições e registro ficam salvos.",
    state: {
      loading: "Carregando a sala…",
      retry: "Tentar de novo",
      error: {
        forbidden: "A sala é do gerente do tour",
        missing: "O banco de dados ainda não foi atualizado",
        network: "Sem conexão com o servidor",
        unknown: "Não foi possível carregar a sala",
      },
      hint: {
        forbidden: "Só o gerente deste tour e o administrador do clube podem abri-la.",
        missing: "Aplique a migração partner_deal_room no Supabase e recarregue.",
        network: "Verifique sua conexão — a sala tentará de novo sozinha.",
        unknown: "Tente em um minuto. Se repetir, envie o erro ao administrador.",
      },
    },
    contract: {
      eyebrow: "Digital Contract",
      title: "Condições e assinaturas",
      edit: "Alterar condições",
      create: "Definir condições",
      noContract: "Nenhuma condição definida para este tour.",
      signatures: "Assinaturas",
      you: "você",
      role: { manager: "Gerente", participant: "Participante" },
      signed: (t) => `Assinado · ${t}`,
      waiting: "Aguardando assinatura",
      remind: "Lembrar",
      remindAll: "Lembrar quem não assinou",
      noTelegram: "Telegram não vinculado",
      sentBanner: (v, q) => `v${v} enviada para assinatura · ${q} ${one(q, "participante avisada", "participantes avisadas")} no Telegram`,
      sentMissing: (n) => `Sem Telegram — avise pessoalmente: ${n}`,
      history: (n) => `Histórico de versões · ${n}`,
      current: "em vigor",
      replaced: (v) => `substituída pela v${v}`,
      byLine: (name, date, a, b) => `${name} · ${date} · assinaturas ${a}/${b}`,
    },
    crew: {
      eyebrow: "Crew",
      title: "Equipe",
      remindDocs: "Lembrar dos documentos",
      docsOk: (d) => `Documentos verificados · ${d}`,
      docsMissing: "Aguardando documentos",
      instead: (n) => `no lugar de ${n}`,
      telegramOn: "Telegram vinculado",
      telegramOff: "Sem Telegram",
      empty: "Ainda não há ninguém na equipe.",
    },
    log: {
      eyebrow: "Log",
      title: "Registro do tour",
      filters: { all: "Tudo", contract: "Contrato", docs: "Documentos", crew: "Equipe", telegram: "Telegram" },
      empty: "Ainda não há eventos.",
      today: "Hoje",
      yesterday: "Ontem",
      roles: { manager: "gerente", participant: "participante", admin: "administrador", system: "Voyage" },
      text: {
        contract_sent: (v) => `Condições v${v} enviadas para assinatura`,
        contract_signed: (v) => `Assinatura da v${v}`,
        docs_uploaded: (d) => `Documento enviado: ${d}`,
        docs_verified: "Documentos verificados",
        member_joined: "Entrou na equipe",
        member_replaced: "Substituição na equipe",
        member_status: {
          flown: "Embarcou", released: "Saiu com antecedência", late_drop: "Desistência tardia", no_show: "Não compareceu", confirmed: "Voltou à equipe",
        },
        reminder_sent: { docs_reminder: "Lembrete de documentos no Telegram", contract_reminder: "Lembrete de assinatura no Telegram" },
        tour_status: (s) => `Status do tour: ${s}`,
      },
      docs: { passport: "passaporte", snaps: "Live Snaps", visa: "visto", other: "documento" },
      instead: (n) => `no lugar de ${n}`,
      recipients: (n) => `${n} ${one(n, "destinatária", "destinatárias")}`,
    },
  },
};

/* ══════════════════════════════════════════════════════════════════
 * ФОРМАТИРОВАНИЕ И ТОКЕНЫ
 * ══════════════════════════════════════════════════════════════════ */

function makeFmt(t: Dict, u: Units, now: number) {
  const ready = now > 0;
  const df = (o: Intl.DateTimeFormatOptions) => (at: number) => (ready ? new Intl.DateTimeFormat(t.locale, o).format(at) : "—");
  return {
    ready,
    now,
    until: (at: number) => (ready ? fmtDur((at - now) / MIN, u) : "—"),
    since: (at: number) => (ready ? fmtDur((now - at) / MIN, u) : "—"),
    time: df({ hour: "2-digit", minute: "2-digit" }),
    day: df({ day: "numeric", month: "short" }),
    dayTime: df({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    full: df({ weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    dayKey: (at: number) => {
      const d = new Date(at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    },
  };
}
type Fmt = ReturnType<typeof makeFmt>;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const BTN_GHOST =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-4 text-xs tracking-wide text-zinc-200 transition hover:border-amber-200/40 hover:text-amber-100 active:scale-[0.98] sm:min-h-9";
const BTN_GOLD =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-200 px-4 text-xs font-medium tracking-wide text-zinc-950 shadow-[0_0_24px_-8px_rgba(253,230,138,0.6)] transition hover:bg-amber-100 active:scale-[0.98] sm:min-h-9";

type Tone = "gold" | "emerald" | "amber" | "rose" | "zinc";
const DOT_TONE: Record<Tone, string> = {
  gold: "border-amber-200/35 bg-amber-200/10 text-amber-200",
  emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  rose: "border-rose-400/35 bg-rose-500/10 text-rose-300",
  zinc: "border-zinc-700 bg-zinc-900 text-zinc-400",
};
const STATUS_TONE: Record<RoomTourStatus, string> = {
  confirmed: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  in_tour: "border-amber-200/30 bg-amber-200/10 text-amber-100",
  closed: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  cancelled: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

const EVENT_META: Record<RoomEventKind, { icon: LucideIcon; tone: Tone; filter: LogFilter }> = {
  contract_sent: { icon: ScrollText, tone: "gold", filter: "contract" },
  contract_signed: { icon: PenLine, tone: "emerald", filter: "contract" },
  docs_uploaded: { icon: FileText, tone: "zinc", filter: "docs" },
  docs_verified: { icon: FileCheck, tone: "emerald", filter: "docs" },
  member_joined: { icon: UserPlus, tone: "zinc", filter: "crew" },
  member_replaced: { icon: Repeat, tone: "amber", filter: "crew" },
  member_status: { icon: UserMinus, tone: "rose", filter: "crew" },
  reminder_sent: { icon: Send, tone: "gold", filter: "telegram" },
  tour_status: { icon: Plane, tone: "zinc", filter: "crew" },
};

/* ══════════════════════════════════════════════════════════════════
 * АТОМЫ
 * ══════════════════════════════════════════════════════════════════ */

function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  icon: Icon,
  count,
  action,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          <Icon className="size-3.5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
          {eyebrow}
        </p>
        <h2 className={`${cormorant.className} mt-1.5 flex items-center gap-2.5 text-2xl font-medium text-zinc-50 md:text-[1.7rem]`}>
          <span className="truncate">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/10 px-1.5 font-sans text-[11px] font-medium text-amber-100">
              {count}
            </span>
          )}
        </h2>
      </div>
      {action}
    </div>
  );
}

/** Аватар-инициалы участницы — ссылка на профиль */
function PartyAvatar({ p, size = "md" }: { p: { id: string; name: string; role: RoomParty["role"] }; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  const look =
    p.role === "manager"
      ? "border-zinc-700 bg-zinc-800 text-zinc-300"
      : "border-amber-200/30 bg-gradient-to-br from-amber-200/25 to-zinc-800 text-amber-100";
  const inner = (
    <span className={`${cormorant.className} flex ${box} shrink-0 items-center justify-center rounded-full border font-semibold ${look}`}>
      {initials(p.name)}
    </span>
  );
  return p.role === "participant" ? (
    <Link href={ROUTES.resident(p.id)} aria-label={p.name} className="shrink-0 rounded-full transition hover:ring-2 hover:ring-amber-200/40">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Имя: участница — ссылка на профиль, остальные — текст */
function NameLink({ id, name, participant, className = "" }: { id: string | null; name: string; participant: boolean; className?: string }) {
  return participant && id ? (
    <Link href={ROUTES.resident(id)} className={`text-zinc-100 underline-offset-4 transition hover:text-amber-100 hover:underline ${className}`}>
      {name}
    </Link>
  ) : (
    <span className={`text-zinc-200 ${className}`}>{name}</span>
  );
}

function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-48 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-amber-500/[0.06] blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_60%)]" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ШАПКА
 * ══════════════════════════════════════════════════════════════════ */

function RoomHeader({ d, t, fmt, demo, lang }: { d: DealRoomData; t: Dict; fmt: Fmt; demo: boolean; lang: Lang }) {
  const { tour } = d;
  const ahead = fmt.ready && tour.departsAt > fmt.now;
  const city = cityLabel(tour.city, lang);
  const what = `${city} · ${t.projects[tour.project]}`;

  return (
    <header>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <Link href={ROUTES.command} className="transition hover:text-amber-200">
          {t.crumbs.command}
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link href={ROUTES.manifest} className="transition hover:text-amber-200">
          {t.crumbs.manifest}
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <Link href={ROUTES.tour(tour.id)} className="truncate text-zinc-300 transition hover:text-amber-200">
          {what}
        </Link>
      </nav>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 flex-[1_1_26rem]">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-amber-200/70">
              <span aria-hidden className="h-px w-8 bg-gradient-to-r from-amber-200/0 to-amber-200/60" />
              {t.eyebrow}
            </p>
            {demo && (
              <span className="rounded-full border border-zinc-700/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
                {t.demo}
              </span>
            )}
          </div>
          <h1 className={`${cormorant.className} mt-3 text-[2.4rem] font-medium leading-[1.05] text-zinc-50 md:text-[3.25rem]`}>
            {t.title}
            <span className="text-zinc-500"> · </span>
            <span className="bg-gradient-to-r from-amber-100 via-amber-200 to-amber-500 bg-clip-text text-transparent">
              {city}
            </span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-400">
            {tour.iata && <span className="font-mono text-xs tracking-wider text-amber-200/90">{tour.iata}</span>}
            <span>{t.projects[tour.project]}</span>
            {tour.flightNo && <span className="text-zinc-500">{tour.flightNo}</span>}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${STATUS_TONE[tour.status]}`}
            >
              {t.status[tour.status]}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <Lock className="size-3.5 shrink-0 text-zinc-500" strokeWidth={1.5} aria-hidden />
            {t.privacy}
          </p>
        </div>

        {/* табло вылета */}
        <div className="min-w-0 flex-[0_1_18rem] rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-200/[0.07] via-zinc-900/60 to-zinc-950/80 p-4 backdrop-blur-xl">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
            <Plane className="size-3.5 text-amber-200/70" strokeWidth={1.5} aria-hidden />
            {t.departs}
          </p>
          <p className={`${cormorant.className} mt-1.5 text-2xl font-medium leading-tight text-zinc-50 first-letter:uppercase`}>
            {fmt.full(tour.departsAt)}
          </p>
          <p className={`mt-1 text-xs ${ahead ? "text-amber-200/90" : "text-zinc-500"}`}>
            {fmt.ready ? (ahead ? t.departsIn(fmt.until(tour.departsAt)) : t.departed) : "—"}
          </p>
        </div>
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * DIGITAL CONTRACT
 * ══════════════════════════════════════════════════════════════════ */

type SentState = { version: number; result: NotifyResult } | null;

function ContractPanel({
  d,
  t,
  fmt,
  onSent,
  onReminded,
}: {
  d: DealRoomData;
  t: Dict;
  fmt: Fmt;
  onSent: (terms: ContractTerms, version: number, result: NotifyResult) => void;
  onReminded: (count: number) => void;
}) {
  const contract = roomContract(d);
  const current = d.versions[0] ?? null;
  const [editing, setEditing] = useState(false);
  const [lastSent, setLastSent] = useState<SentState>(null);
  const participants = d.parties.filter((p) => p.role === "participant");
  const unsigned = participants.filter((p) => p.signedAt === null);
  const canEdit = !d.readOnly && d.tour.status === "confirmed" && d.me.role === "manager";
  const showEditor = canEdit && (editing || !current);
  const nextVersion = (current?.version ?? 0) + 1;

  const submit = (terms: ContractTerms) =>
    sendContract(d.tour.id, terms, {
      // демо: кому из участниц дойдёт через Telegram
      queued: participants.filter((p) => p.telegram).length,
      missing: participants.filter((p) => !p.telegram).map((p) => p.name),
      throttled: 0,
      version: nextVersion,
    });

  const remindMock = (list: RoomParty[]): NotifyResult => ({
    queued: list.filter((p) => p.telegram).length,
    missing: list.filter((p) => !p.telegram).map((p) => p.name),
    throttled: 0,
  });

  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader
        eyebrow={t.contract.eyebrow}
        title={t.contract.title}
        icon={ScrollText}
        action={
          canEdit && current && !editing ? (
            <button type="button" onClick={() => setEditing(true)} className={BTN_GHOST}>
              <PenLine className="size-3.5" aria-hidden />
              {t.contract.edit}
            </button>
          ) : null
        }
      />

      {lastSent && (
        <div
          role="status"
          className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3.5"
        >
          <Send className="mt-0.5 size-4 shrink-0 text-emerald-300" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 text-xs leading-relaxed">
            <p className="text-emerald-100">{t.contract.sentBanner(lastSent.version, lastSent.result.queued)}</p>
            {lastSent.result.missing.length > 0 && (
              <p className="mt-0.5 text-amber-200/90">{t.contract.sentMissing(lastSent.result.missing.join(", "))}</p>
            )}
          </div>
        </div>
      )}

      {showEditor ? (
        <div className="mt-5">
          <ContractEditor
            current={current?.terms ?? null}
            currentVersion={current?.version ?? null}
            participants={participants.length}
            onSubmit={submit}
            onCancel={current ? () => setEditing(false) : undefined}
            onSent={(terms, result) => {
              const version = result.version ?? nextVersion;
              setLastSent({ version, result });
              setEditing(false);
              onSent(terms, version, result);
            }}
          />
        </div>
      ) : !contract ? (
        <p className="mt-5 rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-400">{t.contract.noContract}</p>
      ) : (
        <>
          <div className="mt-5">
            <ContractSeal contract={contract} variant="card" />
          </div>

          {/* подписи по сторонам */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.contract.signatures}</p>
              {canEdit && unsigned.length > 0 && (
                <TelegramAction
                  label={t.contract.remindAll}
                  run={() => notifyTour(d.tour.id, "contract_reminder", undefined, remindMock(unsigned))}
                  onDone={(r) => onReminded(r.queued)}
                />
              )}
            </div>
            <ul className="mt-3 divide-y divide-zinc-800/70 rounded-xl border border-zinc-800/80 bg-zinc-950/40">
              {d.parties.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                  <PartyAvatar p={p} size="sm" />
                  <div className="min-w-0 flex-[1_1_10rem]">
                    <p className="truncate text-sm">
                      <NameLink id={p.id} name={p.name} participant={p.role === "participant"} />
                      {p.id === d.me.id && <span className="text-zinc-500"> · {t.contract.you}</span>}
                    </p>
                    <p className="text-[11px] text-zinc-500">{t.contract.role[p.role]}</p>
                  </div>
                  {p.signedAt !== null ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-200">
                      <Check className="size-3.5" aria-hidden />
                      {t.contract.signed(fmt.dayTime(p.signedAt))}
                    </span>
                  ) : (
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-200">
                        <Clock className="size-3.5" aria-hidden />
                        {t.contract.waiting}
                      </span>
                      {canEdit && p.role === "participant" &&
                        (p.telegram ? (
                          <TelegramAction
                            label={t.contract.remind}
                            run={() => notifyTour(d.tour.id, "contract_reminder", [p.id], remindMock([p]))}
                            onDone={(r) => onReminded(r.queued)}
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                            <Unlink className="size-3" aria-hidden />
                            {t.contract.noTelegram}
                          </span>
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {d.versions.length > 0 && <VersionHistory d={d} t={t} fmt={fmt} />}
    </Panel>
  );
}

function VersionHistory({ d, t, fmt }: { d: DealRoomData; t: Dict; fmt: Fmt }) {
  const total = d.parties.length;
  return (
    <details className="group mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/30 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs text-zinc-300 transition hover:text-amber-100">
        <span className="flex items-center gap-2">
          <History className="size-3.5 text-amber-200/70" strokeWidth={1.5} aria-hidden />
          {t.contract.history(d.versions.length)}
        </span>
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <ol className="space-y-3 border-t border-zinc-800/80 p-4">
        {d.versions.map((v, i) => (
          <li key={v.version} className="flex gap-3">
            <span
              className={`mt-0.5 flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md border px-1.5 font-mono text-[11px] ${
                i === 0 ? "border-amber-200/40 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-500"
              }`}
            >
              v{v.version}
            </span>
            <div className="min-w-0">
              <p className={`text-xs ${i === 0 ? "text-zinc-100" : "text-zinc-400"}`}>
                {i === 0 ? t.contract.current : t.contract.replaced(d.versions[i - 1].version)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {t.contract.byLine(v.createdBy, fmt.dayTime(v.createdAt), v.signatures.length, i === 0 ? total : v.signatures.length)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СОСТАВ
 * ══════════════════════════════════════════════════════════════════ */

function CrewPanel({ d, t, fmt, onReminded }: { d: DealRoomData; t: Dict; fmt: Fmt; onReminded: (n: number) => void }) {
  const crew = d.parties.filter((p) => p.role === "participant");
  const noDocs = crew.filter((p) => p.docsAt === null);
  const canAct = !d.readOnly && d.tour.status !== "cancelled";

  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.crew.eyebrow} title={t.crew.title} icon={Users} count={crew.length} />

      {canAct && noDocs.length > 0 && (
        <TelegramAction
          className="mt-4"
          align="start"
          label={t.crew.remindDocs}
          run={() =>
            notifyTour(d.tour.id, "docs_reminder", undefined, {
              queued: noDocs.filter((p) => p.telegram).length,
              missing: noDocs.filter((p) => !p.telegram).map((p) => p.name),
              throttled: 0,
            })
          }
          onDone={(r) => onReminded(r.queued)}
        />
      )}

      {crew.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-500">{t.crew.empty}</p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {crew.map((p) => (
            <li key={p.id} className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5">
              <div className="flex items-start gap-3">
                <PartyAvatar p={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        <NameLink id={p.id} name={p.name} participant />
                      </p>
                      {p.replaces && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-200/80">
                          <Repeat className="size-3 shrink-0" aria-hidden />
                          {t.crew.instead(p.replaces)}
                        </p>
                      )}
                    </div>
                    <span
                      title={p.telegram ? t.crew.telegramOn : t.crew.telegramOff}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                        p.telegram ? "border-sky-400/25 bg-sky-400/10 text-sky-200" : "border-dashed border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {p.telegram ? <Send className="size-2.5" aria-hidden /> : <Unlink className="size-2.5" aria-hidden />}
                      <span className="sr-only sm:not-sr-only">{p.telegram ? "Telegram" : t.crew.telegramOff}</span>
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.docsAt !== null ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                        <BadgeCheck className="size-3" aria-hidden />
                        {t.crew.docsOk(fmt.day(p.docsAt))}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                        <FileText className="size-3" aria-hidden />
                        {t.crew.docsMissing}
                      </span>
                    )}
                    <LiveSnapBadge at={p.snapAt} now={fmt.now} />
                    {p.trust && <TrustBadge trust={p.trust} />}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ЛОГ ТУРА
 * ══════════════════════════════════════════════════════════════════ */

function eventTitle(e: RoomEvent, t: Dict) {
  const x = t.log.text;
  switch (e.kind) {
    case "contract_sent":
      return x.contract_sent(e.version ?? 1);
    case "contract_signed":
      return x.contract_signed(e.version ?? 1);
    case "docs_uploaded":
      return x.docs_uploaded(t.log.docs[e.doc ?? "other"]);
    case "docs_verified":
      return x.docs_verified;
    case "member_joined":
      return x.member_joined;
    case "member_replaced":
      return x.member_replaced;
    case "member_status":
      return x.member_status[e.to ?? ""] ?? x.member_status.confirmed;
    case "reminder_sent":
      return x.reminder_sent[e.template ?? "docs_reminder"];
    case "tour_status":
      return x.tour_status(t.status[(e.to as RoomTourStatus) ?? "confirmed"] ?? e.to ?? "");
  }
}

function eventTone(e: RoomEvent): Tone {
  if (e.kind === "member_status") return e.to === "flown" || e.to === "confirmed" ? "emerald" : e.to === "released" ? "zinc" : "rose";
  return EVENT_META[e.kind].tone;
}

function EventMeta({ e, t }: { e: RoomEvent; t: Dict }) {
  const parts: ReactNode[] = [];
  // о ком событие — ссылка на профиль
  if (e.subject) {
    parts.push(<NameLink key="s" id={e.subject.id} name={e.subject.name} participant />);
    if (e.replaced) parts.push(<span key="r">{t.log.instead(e.replaced)}</span>);
  }
  if (e.kind === "reminder_sent" && e.count) parts.push(<span key="c">{t.log.recipients(e.count)}</span>);
  // кто сделал — если это не та же участница
  if (e.actor.role === "system") {
    if (!e.subject) parts.push(<span key="a">{t.log.roles.system}</span>);
  } else if (e.actor.name && e.actor.id !== e.subject?.id) {
    parts.push(
      <span key="a">
        <NameLink id={e.actor.id} name={e.actor.name} participant={e.actor.role === "participant"} />
        {e.actor.role !== "participant" && <span className="text-zinc-500"> · {t.log.roles[e.actor.role]}</span>}
      </span>,
    );
  }
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-400">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className="text-zinc-600">·</span>}
          {p}
        </span>
      ))}
    </p>
  );
}

function EventLog({ d, t, fmt }: { d: DealRoomData; t: Dict; fmt: Fmt }) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const filters: LogFilter[] = ["all", "contract", "docs", "crew", "telegram"];
  const events = d.events.filter((e) => filter === "all" || EVENT_META[e.kind].filter === filter);

  // по дням: «Сегодня», «Вчера», дата
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: RoomEvent[] }[] = [];
    for (const e of events) {
      const key = fmt.dayKey(e.at);
      let g = out.find((x) => x.key === key);
      if (!g) {
        const label = !fmt.ready
          ? fmt.day(e.at)
          : key === fmt.dayKey(fmt.now)
            ? t.log.today
            : key === fmt.dayKey(fmt.now - 24 * 60 * MIN)
              ? t.log.yesterday
              : fmt.day(e.at);
        g = { key, label, items: [] };
        out.push(g);
      }
      g.items.push(e);
    }
    return out;
  }, [events, fmt, t]);

  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.log.eyebrow} title={t.log.title} icon={History} />

      <div role="radiogroup" aria-label={t.log.title} className="mt-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-9 rounded-full border px-3 text-xs transition ${
              filter === f
                ? "border-amber-200/50 bg-amber-200/10 text-amber-100"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
            }`}
          >
            {t.log.filters[f]}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="mt-5 text-sm text-zinc-500">{t.log.empty}</p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500 first-letter:uppercase">{g.label}</p>
              <ol className="relative">
                {g.items.map((e, i) => {
                  const Icon = EVENT_META[e.kind].icon;
                  const last = i === g.items.length - 1;
                  return (
                    <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {!last && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-zinc-800" />}
                      <span className={`relative flex size-8 shrink-0 items-center justify-center rounded-full border ${DOT_TONE[eventTone(e)]}`}>
                        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 text-sm leading-snug text-zinc-100">{eventTitle(e, t)}</p>
                          <time
                            dateTime={new Date(e.at).toISOString()}
                            title={fmt.full(e.at)}
                            className="shrink-0 font-mono text-[11px] text-zinc-500"
                          >
                            {fmt.time(e.at)}
                          </time>
                        </div>
                        <EventMeta e={e} t={t} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СОСТОЯНИЯ
 * ══════════════════════════════════════════════════════════════════ */

function RoomSkeleton({ t }: { t: Dict }) {
  const block = "animate-pulse rounded-2xl border border-zinc-800/80 bg-zinc-900/40";
  return (
    <div role="status" aria-live="polite" className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <span className="sr-only">{t.state.loading}</span>
      <div className="space-y-6">
        <div className={`h-96 ${block}`} />
        <div className={`h-72 ${block}`} />
      </div>
      <div className={`h-[32rem] ${block}`} />
    </div>
  );
}

function RoomError({ t, reason, onRetry }: { t: Dict; reason: keyof Dict["state"]["error"]; onRetry: () => void }) {
  const Icon = reason === "network" ? WifiOff : ShieldAlert;
  return (
    <Panel className="mt-8 p-6 md:p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10 text-rose-300">
          <Icon className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`${cormorant.className} text-2xl font-medium text-zinc-50`}>{t.state.error[reason]}</h2>
          <p className="mt-1 text-sm text-zinc-400">{t.state.hint[reason]}</p>
        </div>
        {reason === "forbidden" ? (
          <Link href={ROUTES.command} className={BTN_GHOST}>
            {t.crumbs.command}
          </Link>
        ) : (
          <button type="button" onClick={onRetry} className={BTN_GOLD}>
            <RotateCw className="size-3.5" aria-hidden />
            {t.state.retry}
          </button>
        )}
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function DealRoomPage() {
  const params = useParams<{ id: string }>();
  const tourId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? "");
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const now = useNow();
  const fmt = useMemo(() => makeFmt(t, UNITS[lang] ?? UNITS.EN, now), [t, lang, now]);
  const { source, data, loading, error, refresh, update } = useDealRoom(tourId);
  const demo = source === "mock";

  // после действия: демо — меняем данные на месте, live — перечитываем комнату
  const afterSent = (terms: ContractTerms, version: number) => {
    if (demo) update((d) => applySentLocally(d, terms, version));
    else refresh();
  };
  const afterReminder = (template: "docs_reminder" | "contract_reminder") => (count: number) => {
    if (demo) update((d) => applyReminderLocally(d, template, count));
    else refresh();
  };

  return (
    <div className="relative isolate min-h-full overflow-x-clip bg-zinc-950 text-zinc-100">
      <Ambient />
      <div className="mx-auto w-full max-w-[90rem] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pt-10 lg:px-10">
        {data && <RoomHeader d={data} t={t} fmt={fmt} demo={demo} lang={lang} />}
        {!data && loading && <RoomSkeleton t={t} />}
        {!data && !loading && error && <RoomError t={t} reason={error.reason} onRetry={refresh} />}

        {data && (
          <>
            {data.readOnly && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-300">
                <Lock className="size-4 shrink-0 text-zinc-400" strokeWidth={1.5} aria-hidden />
                {t.readOnly}
              </div>
            )}

            {/* ≥ xl: слева контракт и лог, справа состав; на телефоне — контракт, состав, лог */}
            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
              <div className="min-w-0 xl:col-start-1 xl:row-start-1">
                <ContractPanel
                  d={data}
                  t={t}
                  fmt={fmt}
                  onSent={(terms, version) => afterSent(terms, version)}
                  onReminded={afterReminder("contract_reminder")}
                />
              </div>
              <aside className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-1">
                <CrewPanel d={data} t={t} fmt={fmt} onReminded={afterReminder("docs_reminder")} />
              </aside>
              <div className="min-w-0 xl:col-start-1 xl:row-start-2">
                <EventLog d={data} t={t} fmt={fmt} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
