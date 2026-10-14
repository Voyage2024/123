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
 * Данные: _lib/blacklist.ts (демо).
 * ──────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  ChevronRight,
  FileCheck2,
  Gavel,
  ImageOff,
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
import { buildBlacklistMock, type BlacklistEntry } from "../_lib/blacklist";
import {
  EDGE,
  EmptyFilter,
  FilterTabs,
  ICON_RING,
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
      title: "Read only",
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
    status: { confirmed: "Confirmed", appeal: "Under appeal" },
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
      title: "Только чтение",
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
    status: { confirmed: "Подтверждено", appeal: "На апелляции" },
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
      title: "Solo lectura",
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
    status: { confirmed: "Confirmada", appeal: "En apelación" },
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
      title: "Somente leitura",
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
    status: { confirmed: "Confirmada", appeal: "Em recurso" },
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

/* ══════════════════════════════════════════════════════════════════
 * СТРОКА СПИСКА
 * ══════════════════════════════════════════════════════════════════ */

/** Таблица — от 1340 px (сайдбар съедает 288 px), ниже — карточки, на lg в две колонки */
const ROW_GRID = "min-[1340px]:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1.25fr)_8rem_8.5rem_9.5rem]";

function EntryRow({ e, t, fmt }: { e: BlacklistEntry; t: Dict; fmt: Fmt }) {
  const ReasonIcon = REASON_ICON[e.reason];
  const tone = e.status === "appeal" ? "amber" : "rose";
  const revealed = !!e.residentId && !!e.name;

  const body = (
    <>
      {/* код */}
      <div className="flex items-center justify-between gap-3 min-[1340px]:block">
        <span className="font-mono text-[13px] tracking-wider text-zinc-300">{e.code}</span>
        <span className="min-[1340px]:hidden">
          <Pill tone={tone} icon={e.status === "appeal" ? Scale : ShieldAlert}>
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
        <Pill tone={tone} icon={e.status === "appeal" ? Scale : ShieldAlert}>
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
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function PartnerBlacklistPage() {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const [data] = useState(buildBlacklistMock);
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
  const statuses: StatusFilter[] = ["any", "confirmed", "appeal"];

  return (
    <PageShell>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        demo={cm.demo}
        demoHint={cm.demoHint}
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

      {/* только чтение */}
      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4 backdrop-blur-xl">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${ICON_RING.zinc}`}>
          <Lock className="size-4" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-300">{t.readOnly.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{t.readOnly.text}</p>
        </div>
      </div>

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
                <EntryRow key={e.id} e={e} t={t} fmt={fmt} />
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
