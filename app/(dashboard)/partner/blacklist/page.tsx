"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · BLACKLIST — app/(dashboard)/partner/blacklist/page.tsx
 *
 * Разведка: глобальный чёрный список клуба. Для менеджера — только чтение:
 * на странице нет ни одной кнопки, которая что-то меняет. Записи ведёт
 * ассистент клуба (в базе insert/update/delete — только is_admin()).
 *
 *   Шапка    статус ваших составов (чисто / есть совпадение)
 *   Цифры    записей, подтверждено, на апелляции, из ваших туров
 *   Фильтры  причина · статус · поиск по коду и имени
 *   Список   код · участница · нарушение · дата · срок хранения · статус
 *
 * Имя и профиль видны только у бывших участниц ваших туров
 * (partner_can_reveal), остальные — код и замок. Доказательства
 * хранятся у клуба: менеджер видит только их число.
 *
 * Данные: RPC public.partner_blacklist_list() через usePartnerFeed.
 * Менеджер отправляет заявку на проверку, админ решает (подтвердить,
 * апелляция, снять, срок) — RPC partner_blacklist_report / _review / _add.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  ChevronRight,
  FileCheck2,
  Gavel,
  Hourglass,
  ImageOff,
  Loader2,
  Send,
  Infinity as InfinityIcon,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { ROUTES } from "../_lib/routes";
import type { BlacklistReason } from "../_lib/command";
import { pl, ru, usePartnerFormat, type Fmt } from "../_lib/format";
import { DAY } from "../_lib/clock";
import {
  addToBlacklist,
  fetchBlacklistCandidates,
  parseBlacklist,
  reportToBlacklist,
  reviewBlacklistEntry,
  type BlacklistCandidate,
  type BlacklistData,
  type BlacklistEntry,
} from "../_lib/blacklist";
import { usePartnerFeed } from "../_lib/usePartnerFeed";
import {
  BTN_GHOST,
  BTN_GOLD,
  EDGE,
  EmptyFilter,
  FilterTabs,
  ICON_RING,
  FeedGate,
  PageHeader,
  PageShell,
  Panel,
  Pill,
  SearchField,
  StatStrip,
  cormorant,
  initials,
} from "../_components/PartnerUI";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type ReasonFilter = "all" | BlacklistReason;
type StatusFilter = "any" | BlacklistEntry["status"];

type Dict = {
  eyebrow: string;
  title: string;
  subtitle: string;
  clean: string;
  dirty: string;
  readOnly: { title: string; text: string };
  stats: { total: string; confirmed: string; appeal: string; yours: string };
  reasonFilter: string;
  statusFilter: string;
  all: string;
  anyStatus: string;
  searchPlaceholder: string;
  cols: { code: string; who: string; reason: string; added: string; keep: string; status: string };
  reason: Record<BlacklistReason, string>;
  reasonShort: Record<BlacklistReason, string>;
  status: Record<BlacklistEntry["status"], string>;
  hidden: string;
  hiddenHint: string;
  yourTour: string;
  evidence: (n: number) => string;
  until: (date: string) => string;
  forever: string;
  openProfile: string;
  rules: { title: string; items: string[] };
};

const T: Record<Lang, Dict> = {
  EN: {
    eyebrow: "Intelligence · Blacklist",
    title: "Blacklist",
    subtitle: "The club’s global list. Entries are added by the Voyage assistant after the evidence is checked; a participant can appeal.",
    clean: "Your current crews are clean: no one from your active tours is on the list.",
    dirty: "A participant from your crew is on the list — check your tours.",
    readOnly: {
      title: "The club decides",
      text: "Only the club administration can add, change or remove an entry. Evidence stays with the club; managers see how many files were checked.",
    },
    stats: { total: "Entries", confirmed: "Confirmed", appeal: "Under appeal", yours: "From your tours" },
    reasonFilter: "Filter by violation",
    statusFilter: "Filter by status",
    all: "All",
    anyStatus: "Any status",
    searchPlaceholder: "Code or name",
    cols: { code: "Code", who: "Participant", reason: "Violation", added: "Added", keep: "Kept until", status: "Status" },
    reason: { noShow: "No-show on a confirmed tour", fakePhotos: "Fake photos", fraud: "Fraud / breach of the charter" },
    reasonShort: { noShow: "No-show", fakePhotos: "Fake photos", fraud: "Fraud" },
    status: { pending: "Under review", confirmed: "Confirmed", appeal: "Under appeal", revoked: "Revoked" },
    hidden: "Hidden",
    hiddenHint: "not from your tours",
    yourTour: "Was in your tour",
    evidence: (n) => `${n} ${pl(n, "piece of evidence", "pieces of evidence")} checked`,
    until: (d) => `until ${d}`,
    forever: "Permanent",
    openProfile: "Open profile",
    rules: {
      title: "How the list works",
      items: [
        "Reasons: a no-show on a confirmed tour without a valid reason, fake photos, fraud or a breach of the club charter.",
        "An entry appears only after the club assistant has checked the evidence.",
        "A participant can appeal through the club administration; meanwhile the entry is marked “Under appeal”.",
        "You see the name only of former participants of your own tours.",
      ],
    },
  },
  RU: {
    eyebrow: "Разведка · Blacklist",
    title: "Чёрный список",
    subtitle: "Глобальный список клуба. Записи вносит ассистент Voyage после проверки доказательств; участница может подать апелляцию.",
    clean: "Текущие составы чисты: никого из участниц ваших активных туров нет в списке.",
    dirty: "Участница из вашего состава попала в список — проверьте туры.",
    readOnly: {
      title: "Решает клуб",
      text: "Добавить, изменить или снять запись может только администрация клуба. Доказательства хранятся у клуба; менеджеру видно, сколько файлов проверено.",
    },
    stats: { total: "Записей в списке", confirmed: "Подтверждено", appeal: "На апелляции", yours: "Из ваших туров" },
    reasonFilter: "Фильтр по нарушению",
    statusFilter: "Фильтр по статусу",
    all: "Все",
    anyStatus: "Любой статус",
    searchPlaceholder: "Код или имя",
    cols: { code: "Код", who: "Участница", reason: "Нарушение", added: "Внесена", keep: "Хранится", status: "Статус" },
    reason: { noShow: "Срыв подтверждённого тура", fakePhotos: "Подделка фото", fraud: "Обман / нарушение устава" },
    reasonShort: { noShow: "Срыв тура", fakePhotos: "Подделка фото", fraud: "Обман" },
    status: { pending: "На проверке", confirmed: "Подтверждено", appeal: "На апелляции", revoked: "Снято" },
    hidden: "Скрыто",
    hiddenHint: "не из ваших туров",
    yourTour: "Была в вашем туре",
    evidence: (n) => `${n} ${ru(n, "доказательство проверено", "доказательства проверены", "доказательств проверено")}`,
    until: (d) => `до ${d}`,
    forever: "Бессрочно",
    openProfile: "Открыть профиль",
    rules: {
      title: "Как работает список",
      items: [
        "Причины: срыв подтверждённого тура без уважительной причины, подделка фото, обман или нарушение устава клуба.",
        "Запись появляется только после того, как ассистент клуба проверил доказательства.",
        "Участница может подать апелляцию через администрацию клуба — на это время запись помечена «На апелляции».",
        "Имя видно только у бывших участниц ваших туров.",
      ],
    },
  },
  ES: {
    eyebrow: "Inteligencia · Blacklist",
    title: "Lista negra",
    subtitle: "La lista global del club. Las entradas las añade la asistente de Voyage tras revisar las pruebas; la participante puede apelar.",
    clean: "Tus equipos actuales están limpios: nadie de tus tours activos está en la lista.",
    dirty: "Una participante de tu equipo está en la lista: revisa tus tours.",
    readOnly: {
      title: "Decide el club",
      text: "Solo la administración del club puede añadir, cambiar o retirar una entrada. Las pruebas se quedan en el club; el gerente ve cuántos archivos se revisaron.",
    },
    stats: { total: "Entradas", confirmed: "Confirmadas", appeal: "En apelación", yours: "De tus tours" },
    reasonFilter: "Filtrar por infracción",
    statusFilter: "Filtrar por estado",
    all: "Todas",
    anyStatus: "Cualquier estado",
    searchPlaceholder: "Código o nombre",
    cols: { code: "Código", who: "Participante", reason: "Infracción", added: "Añadida", keep: "Se conserva", status: "Estado" },
    reason: { noShow: "Baja en un tour confirmado", fakePhotos: "Fotos falsas", fraud: "Engaño / falta al reglamento" },
    reasonShort: { noShow: "Baja", fakePhotos: "Fotos falsas", fraud: "Engaño" },
    status: { pending: "En revisión", confirmed: "Confirmada", appeal: "En apelación", revoked: "Retirada" },
    hidden: "Oculto",
    hiddenHint: "no es de tus tours",
    yourTour: "Estuvo en tu tour",
    evidence: (n) => `${n} ${pl(n, "prueba revisada", "pruebas revisadas")}`,
    until: (d) => `hasta ${d}`,
    forever: "Sin plazo",
    openProfile: "Abrir perfil",
    rules: {
      title: "Cómo funciona la lista",
      items: [
        "Motivos: baja en un tour confirmado sin causa justificada, fotos falsas, engaño o falta al reglamento del club.",
        "Una entrada aparece solo después de que la asistente del club revisa las pruebas.",
        "La participante puede apelar a través de la administración del club; mientras tanto, la entrada figura «En apelación».",
        "Solo ves el nombre de antiguas participantes de tus propios tours.",
      ],
    },
  },
  PT: {
    eyebrow: "Inteligência · Blacklist",
    title: "Lista negra",
    subtitle: "A lista global do clube. As entradas são incluídas pela assistente do Voyage após checar as provas; a participante pode recorrer.",
    clean: "Suas equipes atuais estão limpas: ninguém dos seus tours ativos está na lista.",
    dirty: "Uma participante da sua equipe está na lista — verifique seus tours.",
    readOnly: {
      title: "O clube decide",
      text: "Só a administração do clube pode incluir, alterar ou retirar uma entrada. As provas ficam com o clube; o gerente vê quantos arquivos foram checados.",
    },
    stats: { total: "Entradas", confirmed: "Confirmadas", appeal: "Em recurso", yours: "Dos seus tours" },
    reasonFilter: "Filtrar por infração",
    statusFilter: "Filtrar por status",
    all: "Todas",
    anyStatus: "Qualquer status",
    searchPlaceholder: "Código ou nome",
    cols: { code: "Código", who: "Participante", reason: "Infração", added: "Incluída", keep: "Mantida", status: "Status" },
    reason: { noShow: "Desistência em tour confirmado", fakePhotos: "Fotos falsas", fraud: "Fraude / violação do estatuto" },
    reasonShort: { noShow: "Desistência", fakePhotos: "Fotos falsas", fraud: "Fraude" },
    status: { pending: "Em análise", confirmed: "Confirmada", appeal: "Em recurso", revoked: "Retirada" },
    hidden: "Oculto",
    hiddenHint: "não é dos seus tours",
    yourTour: "Esteve no seu tour",
    evidence: (n) => `${n} ${pl(n, "prova checada", "provas checadas")}`,
    until: (d) => `até ${d}`,
    forever: "Sem prazo",
    openProfile: "Abrir perfil",
    rules: {
      title: "Como a lista funciona",
      items: [
        "Motivos: desistência em tour confirmado sem justificativa, fotos falsas, fraude ou violação do estatuto do clube.",
        "Uma entrada só aparece depois que a assistente do clube checa as provas.",
        "A participante pode recorrer pela administração do clube; enquanto isso, a entrada fica «Em recurso».",
        "Você vê o nome só de ex-participantes dos seus próprios tours.",
      ],
    },
  },
};

const REASON_ICON: Record<BlacklistReason, LucideIcon> = { noShow: UserX, fakePhotos: ImageOff, fraud: Ban };

/** Заявки и решения по записям — отдельно от основного словаря */
type Extra = {
  report: string;
  reportText: string;
  who: string;
  pick: string;
  loading: string;
  noCandidates: string;
  why: string;
  evidence: string;
  evidenceHint: string;
  evidenceRule: string;
  send: string;
  cancel: string;
  sent: string;
  duplicate: string;
  failed: string;
  myPending: string;
  admin: {
    title: string;
    reporter: string;
    evidence: string;
    noEvidence: string;
    reviewed: string;
    confirm: string;
    appeal: string;
    revoke: string;
    year: string;
    forever: string;
    addTitle: string;
    addText: string;
    add: string;
    added: string;
    foreverHint: string;
  };
};

const X: Record<Lang, Extra> = {
  EN: {
    report: "Report to the club",
    reportText: "Managers don’t add entries themselves. Describe what happened with a participant of your tour — the club assistant checks the evidence and decides; until then the report is visible only to you.",
    who: "Participant",
    pick: "Choose from your tours",
    loading: "Loading…",
    noCandidates: "No participants from your tours yet",
    why: "Violation",
    evidence: "What happened",
    evidenceHint: "Dates, tour, messages, what was agreed and what happened. Files go to the club assistant in Telegram.",
    evidenceRule: "At least 10 characters. The participant never sees this text.",
    send: "Send for review",
    cancel: "Cancel",
    sent: "Report sent. The club will check it and decide.",
    duplicate: "You already have a report on this participant under review.",
    failed: "Couldn’t send — try again.",
    myPending: "Your report · waiting for the club’s decision",
    admin: {
      title: "Administration",
      reporter: "Reported by",
      evidence: "Evidence",
      noEvidence: "No text",
      reviewed: "Decided",
      confirm: "Confirm",
      appeal: "Mark as appeal",
      revoke: "Revoke",
      year: "Keep 12 months",
      forever: "Make permanent",
      addTitle: "Administration · direct entry",
      addText: "Add a confirmed entry right away. Managers’ reports appear in the list as “Under review” — decide on them below.",
      add: "Add entry",
      added: "Entry added.",
      foreverHint: "Permanent (by default a no-show is kept 12 months)",
    },
  },
  RU: {
    report: "Сообщить клубу",
    reportText: "Менеджер не вносит записи сам. Опишите, что случилось с участницей вашего тура, — ассистент клуба проверит доказательства и примет решение; до тех пор заявку видите только вы.",
    who: "Участница",
    pick: "Выберите из ваших туров",
    loading: "Загружаем…",
    noCandidates: "Участниц ваших туров пока нет",
    why: "Нарушение",
    evidence: "Что произошло",
    evidenceHint: "Даты, тур, переписка, о чём договорились и что вышло. Файлы — ассистенту клуба в Telegram.",
    evidenceRule: "Не меньше 10 символов. Участница этот текст не увидит.",
    send: "Отправить на проверку",
    cancel: "Отмена",
    sent: "Заявка отправлена. Клуб проверит её и примет решение.",
    duplicate: "Ваша заявка на эту участницу уже на проверке.",
    failed: "Не удалось отправить — повторите.",
    myPending: "Ваша заявка · ждёт решения клуба",
    admin: {
      title: "Администрация",
      reporter: "Заявитель",
      evidence: "Доказательства",
      noEvidence: "Без текста",
      reviewed: "Решение",
      confirm: "Подтвердить",
      appeal: "На апелляцию",
      revoke: "Снять",
      year: "Срок 12 месяцев",
      forever: "Бессрочно",
      addTitle: "Администрация · прямая запись",
      addText: "Внесите подтверждённую запись сразу. Заявки менеджеров стоят в списке со статусом «На проверке» — решение по ним ниже.",
      add: "Внести запись",
      added: "Запись внесена.",
      foreverHint: "Бессрочно (по умолчанию неявка хранится 12 месяцев)",
    },
  },
  ES: {
    report: "Informar al club",
    reportText: "Los gerentes no añaden entradas. Describe lo ocurrido con una participante de tu tour: el asistente del club revisa las pruebas y decide; mientras tanto solo tú ves el reporte.",
    who: "Participante",
    pick: "Elige de tus tours",
    loading: "Cargando…",
    noCandidates: "Aún no hay participantes de tus tours",
    why: "Infracción",
    evidence: "Qué pasó",
    evidenceHint: "Fechas, tour, mensajes, lo acordado y lo ocurrido. Los archivos, al asistente del club en Telegram.",
    evidenceRule: "Mínimo 10 caracteres. La participante no verá este texto.",
    send: "Enviar a revisión",
    cancel: "Cancelar",
    sent: "Reporte enviado. El club lo revisará y decidirá.",
    duplicate: "Ya tienes un reporte en revisión sobre esta participante.",
    failed: "No se pudo enviar: inténtalo de nuevo.",
    myPending: "Tu reporte · esperando la decisión del club",
    admin: {
      title: "Administración",
      reporter: "Reportado por",
      evidence: "Pruebas",
      noEvidence: "Sin texto",
      reviewed: "Decidido",
      confirm: "Confirmar",
      appeal: "Pasar a apelación",
      revoke: "Retirar",
      year: "Mantener 12 meses",
      forever: "Permanente",
      addTitle: "Administración · entrada directa",
      addText: "Añade una entrada confirmada al instante. Los reportes de gerentes aparecen como «En revisión»: decide abajo.",
      add: "Añadir entrada",
      added: "Entrada añadida.",
      foreverHint: "Permanente (por defecto una ausencia se guarda 12 meses)",
    },
  },
  PT: {
    report: "Informar o clube",
    reportText: "Gerentes não adicionam registros. Descreva o que houve com uma participante do seu tour — o assistente do clube verifica as provas e decide; até lá só você vê a denúncia.",
    who: "Participante",
    pick: "Escolha dos seus tours",
    loading: "Carregando…",
    noCandidates: "Ainda não há participantes dos seus tours",
    why: "Infração",
    evidence: "O que aconteceu",
    evidenceHint: "Datas, tour, mensagens, o combinado e o ocorrido. Arquivos vão ao assistente do clube no Telegram.",
    evidenceRule: "Mínimo de 10 caracteres. A participante não verá este texto.",
    send: "Enviar para análise",
    cancel: "Cancelar",
    sent: "Denúncia enviada. O clube vai analisar e decidir.",
    duplicate: "Você já tem uma denúncia em análise sobre esta participante.",
    failed: "Não foi possível enviar — tente de novo.",
    myPending: "Sua denúncia · aguardando decisão do clube",
    admin: {
      title: "Administração",
      reporter: "Denunciado por",
      evidence: "Provas",
      noEvidence: "Sem texto",
      reviewed: "Decidido",
      confirm: "Confirmar",
      appeal: "Marcar recurso",
      revoke: "Retirar",
      year: "Manter 12 meses",
      forever: "Permanente",
      addTitle: "Administração · registro direto",
      addText: "Adicione um registro confirmado na hora. Denúncias de gerentes aparecem como «Em análise» — decida abaixo.",
      add: "Adicionar registro",
      added: "Registro adicionado.",
      foreverHint: "Permanente (por padrão uma ausência fica 12 meses)",
    },
  },
};

/* ══════════════════════════════════════════════════════════════════
 * СТРОКА СПИСКА
 * ══════════════════════════════════════════════════════════════════ */

/** Таблица — от 1340 px (сайдбар съедает 288 px), ниже — карточки, на lg в две колонки */
const ROW_GRID = "min-[1340px]:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1.25fr)_8rem_8.5rem_9.5rem]";

const STATUS_TONE = { pending: "zinc", confirmed: "rose", appeal: "amber", revoked: "zinc" } as const;
const STATUS_ICON: Record<BlacklistEntry["status"], LucideIcon> = {
  pending: Hourglass,
  confirmed: ShieldAlert,
  appeal: Scale,
  revoked: ShieldCheck,
};

function EntryRow({
  e,
  t,
  x,
  fmt,
  isAdmin,
  onChanged,
}: {
  e: BlacklistEntry;
  t: Dict;
  x: Extra;
  fmt: Fmt;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const ReasonIcon = REASON_ICON[e.reason];
  const tone = STATUS_TONE[e.status];
  const StatusIcon = STATUS_ICON[e.status];
  const revealed = !!e.residentId && !!e.name;

  const body = (
    <>
      {/* код */}
      <div className="flex items-center justify-between gap-3 min-[1340px]:block">
        <span className="font-mono text-[13px] tracking-wider text-zinc-300">{e.code}</span>
        <span className="min-[1340px]:hidden">
          <Pill tone={tone} icon={StatusIcon}>
            {t.status[e.status]}
          </Pill>
        </span>
      </div>

      {/* участница */}
      <div className="flex min-w-0 items-center gap-3">
        {revealed ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-300/30 bg-gradient-to-br from-rose-300/20 to-zinc-800">
            <span className={`${cormorant.className} text-sm font-semibold text-rose-50`}>{initials(e.name ?? "")}</span>
          </span>
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
            <Lock className="size-3.5 text-zinc-500" strokeWidth={1.5} aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <span className={`block truncate text-sm ${revealed ? "text-zinc-100 group-hover:text-amber-100" : "text-zinc-500"}`}>
            {revealed ? e.name : t.hidden}
          </span>
          <span className={`block truncate text-[11px] ${revealed ? "text-rose-200/80" : "text-zinc-600"}`}>
            {revealed ? t.yourTour : t.hiddenHint}
          </span>
        </span>
      </div>

      {/* нарушение */}
      <div className="min-w-0">
        <p className="flex items-start gap-2 text-sm leading-snug text-zinc-100">
          <ReasonIcon className="mt-0.5 size-4 shrink-0 text-rose-300/80" strokeWidth={1.5} aria-hidden />
          <span>{t.reason[e.reason]}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 pl-6 text-[11px] text-zinc-500">
          <FileCheck2 className="size-3 shrink-0" aria-hidden />
          {t.evidence(e.evidence)}
        </p>
      </div>

      {/* даты: на телефоне — одной строкой */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs min-[1340px]:contents">
        <p className="min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 min-[1340px]:hidden">{t.cols.added} · </span>
          <span className="text-zinc-300">{fmt.date(e.at, { day: "numeric", month: "short", year: "numeric" })}</span>
          <span className="block text-[11px] text-zinc-500 max-[1339px]:inline max-[1339px]:before:content-['_·_']">{fmt.ago(e.at)}</span>
        </p>
        <p className="min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 min-[1340px]:hidden">{t.cols.keep} · </span>
          {e.expiresAt === null ? (
            <span className="inline-flex items-center gap-1 text-rose-200">
              <InfinityIcon className="size-3.5" aria-hidden />
              {t.forever}
            </span>
          ) : (
            <span className="text-zinc-300">{t.until(fmt.date(e.expiresAt, { day: "numeric", month: "short", year: "numeric" }))}</span>
          )}
        </p>
      </div>

      {/* статус */}
      <div className="hidden items-center justify-end gap-2 min-[1340px]:flex">
        <Pill tone={tone} icon={StatusIcon}>
          {t.status[e.status]}
        </Pill>
        {/* место под стрелку есть всегда — статусы стоят ровной колонкой */}
        <ChevronRight
          className={`size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-200 ${revealed ? "text-zinc-600" : "invisible"}`}
          aria-hidden
        />
      </div>
    </>
  );

  const cls = `group relative grid h-full content-start gap-3 rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4 pl-5 transition-colors before:absolute before:inset-y-4 before:left-0 before:w-[3px] before:rounded-r-full min-[1340px]:items-center min-[1340px]:gap-x-4 min-[1340px]:rounded-none min-[1340px]:border-0 min-[1340px]:bg-transparent min-[1340px]:py-4 ${ROW_GRID} ${EDGE[tone]}`;

  return (
    <li className="min-[1340px]:border-t min-[1340px]:border-zinc-800/70 min-[1340px]:first:border-t-0">
      {revealed && e.residentId ? (
        <Link href={ROUTES.resident(e.residentId)} title={t.openProfile} className={`${cls} hover:border-zinc-700 hover:bg-zinc-900/50`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
      {e.mine && e.status === "pending" && !isAdmin && (
        <p className="px-5 pb-3 text-[11px] text-zinc-500">{x.myPending}</p>
      )}
      {isAdmin && <AdminControls e={e} x={x} fmt={fmt} onChanged={onChanged} />}
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * АДМИН: решение по записи
 * ══════════════════════════════════════════════════════════════════ */

function AdminControls({ e, x, fmt, onChanged }: { e: BlacklistEntry; x: Extra; fmt: Fmt; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (key: string, status: "confirmed" | "appeal" | "revoked", expiresAt?: number | null) => {
    setBusy(key);
    setFailed(false);
    try {
      await reviewBlacklistEntry(e.id, status, expiresAt);
      onChanged();
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };
  const keep = e.status === "revoked" ? "confirmed" : e.status === "pending" ? "confirmed" : e.status;
  const btn = (key: string, label: string, act: () => void, gold = false) => (
    <button key={key} type="button" disabled={busy !== null} onClick={act} className={gold ? BTN_GOLD : BTN_GHOST}>
      {busy === key && <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />}
      {label}
    </button>
  );

  return (
    <div className="mx-5 mb-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs">
      <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/60">{x.admin.title}</p>
      <dl className="mt-2 grid gap-1.5 text-zinc-400 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <dt className="text-zinc-500">{x.admin.reporter}</dt>
        <dd className="text-zinc-200">{e.reporter ?? "—"}</dd>
        <dt className="text-zinc-500">{x.admin.evidence}</dt>
        <dd className="whitespace-pre-wrap break-words text-zinc-200">{e.evidenceText ?? x.admin.noEvidence}</dd>
        {e.reviewedAt !== null && (
          <>
            <dt className="text-zinc-500">{x.admin.reviewed}</dt>
            <dd className="text-zinc-300">{fmt.date(e.reviewedAt, { day: "numeric", month: "short", year: "numeric" })}</dd>
          </>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {e.status !== "confirmed" && btn("confirm", x.admin.confirm, () => void run("confirm", "confirmed"), true)}
        {e.status === "confirmed" && btn("appeal", x.admin.appeal, () => void run("appeal", "appeal"))}
        {e.status !== "revoked" && btn("revoke", x.admin.revoke, () => void run("revoke", "revoked"))}
        {btn("year", x.admin.year, () => void run("year", keep, Date.now() + 365 * DAY))}
        {btn("forever", x.admin.forever, () => void run("forever", keep, null))}
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-rose-300">
          {x.failed}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ЗАЯВКА: менеджер — на проверку клуба, админ — сразу в список
 * ══════════════════════════════════════════════════════════════════ */

const REASONS: BlacklistReason[] = ["noShow", "fakePhotos", "fraud"];

function ReportPanel({ t, x, fmt, isAdmin, onDone }: { t: Dict; x: Extra; fmt: Fmt; isAdmin: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<BlacklistCandidate[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [residentId, setResidentId] = useState("");
  const [reason, setReason] = useState<BlacklistReason>("noShow");
  const [evidence, setEvidence] = useState("");
  const [forever, setForever] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed" | "duplicate">("idle");

  useEffect(() => {
    if (!open || candidates) return;
    let alive = true;
    fetchBlacklistCandidates()
      .then((list) => alive && setCandidates(list))
      .catch(() => alive && setLoadFailed(true));
    return () => {
      alive = false;
    };
  }, [open, candidates]);

  const picked = candidates?.find((c) => c.residentId === residentId) ?? null;
  const valid = !!picked && evidence.trim().length >= 10;

  const submit = async (): Promise<boolean> => {
    if (!picked || !valid) return false;
    setState("sending");
    try {
      if (isAdmin) {
        await addToBlacklist({
          residentId: picked.residentId,
          reason,
          evidence: evidence.trim(),
          expiresAt: forever || reason !== "noShow" ? null : Date.now() + 365 * DAY,
        });
      } else {
        await reportToBlacklist({ residentId: picked.residentId, reason, evidence: evidence.trim(), tourId: picked.lastTourId });
      }
      setState("sent");
      setResidentId("");
      setEvidence("");
      setCandidates(null);
      onDone();
      return true;
    } catch (err) {
      setState(String((err as Error)?.message ?? "").includes("report_already_pending") ? "duplicate" : "failed");
      return false;
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-start gap-3">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${ICON_RING[isAdmin ? "rose" : "zinc"]}`}>
          {isAdmin ? <Gavel className="size-4" strokeWidth={1.5} aria-hidden /> : <Lock className="size-4" strokeWidth={1.5} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-300">
            {isAdmin ? x.admin.addTitle : t.readOnly.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{isAdmin ? x.admin.addText : x.reportText}</p>
        </div>
        {!open && (
          <button type="button" className={BTN_GHOST} onClick={() => setOpen(true)}>
            <Send className="size-3.5" aria-hidden />
            {isAdmin ? x.admin.add : x.report}
          </button>
        )}
      </div>

      {state === "sent" && !open && <p className="mt-3 text-xs text-emerald-300">{isAdmin ? x.admin.added : x.sent}</p>}

      {open && (
        <form
          className="mt-4 grid gap-3 border-t border-zinc-800/70 pt-4 md:grid-cols-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            void submit().then((ok) => ok && setOpen(false));
          }}
        >
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{x.who}</span>
            <select
              value={residentId}
              onChange={(ev) => setResidentId(ev.target.value)}
              disabled={!candidates}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 text-sm text-zinc-100 focus:border-amber-200/40 focus:outline-none"
            >
              <option value="">{candidates ? (candidates.length ? x.pick : x.noCandidates) : loadFailed ? x.failed : x.loading}</option>
              {candidates?.map((c) => (
                <option key={c.residentId} value={c.residentId}>
                  {c.name}
                  {c.lastCity ? ` · ${fmt.city(c.lastCity)}` : ""}
                  {c.lastAt ? ` · ${fmt.date(c.lastAt, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{x.why}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[11px] transition ${
                    reason === r ? "border-rose-300/50 bg-rose-400/15 text-rose-100" : "border-zinc-700/80 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {t.reasonShort[r]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block md:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{x.evidence}</span>
            <textarea
              value={evidence}
              onChange={(ev) => setEvidence(ev.target.value.slice(0, 4000))}
              rows={4}
              placeholder={x.evidenceHint}
              className="mt-1.5 w-full resize-y rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/40 focus:outline-none focus:ring-2 focus:ring-amber-200/20"
            />
            <span className="mt-1 flex justify-between gap-3 text-[11px] text-zinc-500">
              <span>{x.evidenceRule}</span>
              <span className="tabular-nums">{evidence.length}/4000</span>
            </span>
          </label>
          {isAdmin && reason === "noShow" && (
            <label className="flex items-center gap-2 text-xs text-zinc-300 md:col-span-2">
              <input type="checkbox" checked={forever} onChange={(ev) => setForever(ev.target.checked)} className="size-4 accent-amber-300" />
              {x.admin.foreverHint}
            </label>
          )}
          {(state === "failed" || state === "duplicate") && (
            <p role="alert" className="text-xs text-rose-300 md:col-span-2">
              {state === "duplicate" ? x.duplicate : x.failed}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
            <button type="button" className={BTN_GHOST} onClick={() => setOpen(false)} disabled={state === "sending"}>
              {x.cancel}
            </button>
            <button type="submit" className={BTN_GOLD} disabled={!valid || state === "sending"} aria-busy={state === "sending"}>
              {state === "sending" && <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />}
              {isAdmin ? x.admin.add : x.send}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function PartnerBlacklistPage() {
  const { lang, c: cm } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const feed = usePartnerFeed("partner_blacklist_list", parseBlacklist);
  return (
    <FeedGate feed={feed} c={cm} eyebrow={t.eyebrow} title={t.title}>
      {(data) => <BlacklistView data={data} refresh={feed.refresh} />}
    </FeedGate>
  );
}

function BlacklistView({ data, refresh }: { data: BlacklistData; refresh: () => void }) {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const x = X[lang] ?? X.EN;
  const [reason, setReason] = useState<ReasonFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("any");
  const [query, setQuery] = useState("");

  const entries = data.entries;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return entries
      .filter((e) => reason === "all" || e.reason === reason)
      .filter((e) => status === "any" || e.status === status)
      .filter((e) => !q || `${e.code} ${e.name ?? ""}`.toLowerCase().replace(/#/g, "").includes(q))
      .sort((a, b) => b.at - a.at);
  }, [entries, reason, status, query]);

  const count = (f: (e: BlacklistEntry) => boolean) => entries.filter(f).length;
  const reasons: ReasonFilter[] = ["all", "noShow", "fakePhotos", "fraud"];
  const statuses: StatusFilter[] = data.isAdmin
    ? ["any", "pending", "confirmed", "appeal", "revoked"]
    : ["any", "confirmed", "appeal", ...(entries.some((e) => e.status === "pending") ? (["pending"] as const) : [])];

  return (
    <PageShell>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        aside={
          <div
            className={`flex min-w-0 flex-[1_1_18rem] items-start gap-3 rounded-2xl border p-4 backdrop-blur-xl sm:max-w-md ${
              data.clean ? "border-emerald-400/20 bg-emerald-400/[0.06]" : "border-rose-400/30 bg-rose-500/[0.08]"
            }`}
          >
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${ICON_RING[data.clean ? "emerald" : "rose"]}`}>
              {data.clean ? (
                <ShieldCheck className="size-5" strokeWidth={1.5} aria-hidden />
              ) : (
                <ShieldAlert className="size-5" strokeWidth={1.5} aria-hidden />
              )}
            </span>
            <p className={`text-sm leading-snug ${data.clean ? "text-emerald-100/90" : "text-rose-100/90"}`}>
              {data.clean ? t.clean : t.dirty}
            </p>
          </div>
        }
      />

      <StatStrip
        items={[
          { label: t.stats.total, value: fmt.num(entries.length), icon: ShieldAlert },
          { label: t.stats.confirmed, value: fmt.num(count((e) => e.status === "confirmed")), icon: Gavel, tone: "rose" },
          { label: t.stats.appeal, value: fmt.num(count((e) => e.status === "appeal")), icon: Scale, tone: "amber" },
          { label: t.stats.yours, value: fmt.num(count((e) => !!e.residentId)), icon: UserX },
        ]}
      />

      {/* менеджер — заявка на проверку; админ — запись сразу */}
      <ReportPanel t={t} x={x} fmt={fmt} isAdmin={data.isAdmin} onDone={refresh} />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <FilterTabs
          label={t.reasonFilter}
          value={reason}
          onChange={setReason}
          items={reasons.map((key) => ({
            key,
            label: key === "all" ? t.all : t.reasonShort[key],
            count: key === "all" ? entries.length : count((e) => e.reason === key),
          }))}
        />
        <FilterTabs
          label={t.statusFilter}
          value={status}
          onChange={setStatus}
          items={statuses.map((key) => ({ key, label: key === "any" ? t.anyStatus : t.status[key] }))}
        />
        <SearchField value={query} onChange={setQuery} placeholder={t.searchPlaceholder} label={cm.search} clearLabel={cm.clear} />
      </div>

      <div className="mt-5">
        {visible.length === 0 ? (
          <EmptyFilter
            text={cm.nothing}
            reset={cm.reset}
            onReset={() => {
              setReason("all");
              setStatus("any");
              setQuery("");
            }}
          />
        ) : (
          <Panel className="p-3 sm:p-4 min-[1340px]:px-6 min-[1340px]:py-2" label={t.title}>
            <div
              aria-hidden
              className={`hidden gap-x-4 border-b border-zinc-800/80 pb-3 pl-5 pt-3 text-[10px] uppercase tracking-[0.24em] text-zinc-500 min-[1340px]:grid ${ROW_GRID}`}
            >
              <span>{t.cols.code}</span>
              <span>{t.cols.who}</span>
              <span>{t.cols.reason}</span>
              <span>{t.cols.added}</span>
              <span>{t.cols.keep}</span>
              <span className="text-right">{t.cols.status}</span>
            </div>
            <ul className="grid gap-3 lg:grid-cols-2 min-[1340px]:block">
              {visible.map((e) => (
                <EntryRow key={e.id} e={e} t={t} x={x} fmt={fmt} isAdmin={data.isAdmin} onChanged={refresh} />
              ))}
            </ul>
          </Panel>
        )}
      </div>

      {/* правила */}
      <Panel as="aside" className="mt-8 p-5 md:p-6" label={t.rules.title}>
        <h2 className={`${cormorant.className} text-xl font-medium text-zinc-50`}>{t.rules.title}</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2.5 xl:grid-cols-2">
          {t.rules.items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-xs leading-relaxed text-zinc-400">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-200/60" />
              {item}
            </li>
          ))}
        </ul>
      </Panel>
    </PageShell>
  );
}
