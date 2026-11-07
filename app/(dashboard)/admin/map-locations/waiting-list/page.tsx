"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Лист ожидания локации (owner / admin)
 * app/(dashboard)/admin/map-locations/waiting-list/page.tsx
 *
 * Кто нажал «Подтвердить готовность к локации» на /destinations/*.
 * Данные: RPC voyage_location_waiting_list (миграция 20261107090000),
 * приглашение: inviteResidents → voyage_invite_residents (+ Telegram).
 * Кастинг принадлежит одной локации, поэтому за раз приглашаем
 * резиденток одной локации.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  BellOff,
  CalendarDays,
  Check,
  Filter,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import MapLocationsTabs from "@/app/(dashboard)/admin/map-locations/MapLocationsTabs";
import { VipBadge } from "@/app/components/profile/VipBadge";
import { getLocationOpenCastings, getLocationWaitingList } from "@/app/actions/location-waiting-list";
import { inviteResidents } from "@/app/actions/resident-registry";
import { countryFlag, countryName } from "@/lib/countries";
import { CLOTHING_SIZES } from "@/lib/resident-sizes";
import { pickName, type OpenCasting, type WaitingFilters, type WaitingPage, type WaitingRow } from "@/lib/location-waiting-list";

type Lang = "EN" | "RU" | "ES" | "PT";

const T = {
  RU: {
    kicker: "Voyage Admin",
    title: "Лист ожидания локации",
    subtitle: "Резидентки, которые нажали «Подтвердить готовность к локации». Отсюда их можно сразу пригласить в открытый тур или кастинг этого города.",
    allHubs: "Все локации",
    search: "Имя, email или @telegram",
    country: "Страна",
    anyCountry: "Любая страна",
    status: "Статус заявки",
    anyStatus: "Любой",
    pending: "Ожидает",
    approved: "Одобрена",
    segment: "Сегмент",
    anySegment: "Любой",
    kyc: "KYC от",
    kycAny: "Любой",
    height: "Рост, см",
    age: "Возраст",
    from: "от",
    to: "до",
    sizes: "Размер одежды",
    applied: "Дата подачи",
    subscription: "Подписка на обновления",
    subAny: "Неважно",
    subYes: "Подписана",
    subNo: "Не подписана",
    sort: "Сортировка",
    newest: "Сначала новые",
    oldest: "Сначала старые",
    byKyc: "По KYC",
    reset: "Сбросить",
    filters: "Фильтры",
    total: "в листе",
    empty: "По этим фильтрам в листе ожидания никого нет.",
    error: "Не удалось загрузить лист ожидания.",
    schema: "Примените миграцию 20261107090000_location_waiting_list.sql.",
    forbidden: "Раздел доступен только owner и admin.",
    invite: "Пригласить в тур / кастинг",
    inviteSelected: "Пригласить выбранных",
    selected: "выбрано",
    oneHub: "Для приглашения выберите резиденток одной локации.",
    notEligible: "Недоступна для приглашения (бан, чёрный список или профиль не одобрен)",
    subscribedHint: "Подписана на обновления локации",
    notSubscribedHint: "Не подписана на обновления",
    lastInvite: "Последнее приглашение",
    inviteStatus: { invited: "приглашена", accepted: "приняла", declined: "отказалась", revoked: "отозвано" } as Record<string, string>,
    tours: "туров",
    open: "Карточка",
    dialogTitle: "Приглашение в тур / кастинг",
    dialogFor: "Локация",
    castings: "Открытые кастинги локации",
    noCastings: "В этой локации сейчас нет открытых кастингов. Создайте кастинг по туру этой локации, затем вернитесь сюда.",
    createCasting: "Создать кастинг",
    message: "Сообщение (необязательно)",
    messagePh: "Короткая записка к приглашению, уйдёт в Telegram",
    send: "Отправить приглашения",
    cancel: "Отмена",
    done: "Приглашено",
    skipped: "пропущено",
    notified: "уведомлено в Telegram",
    skipReasons: { not_eligible: "недоступна", already_responded: "уже откликнулась", already_invited: "уже приглашена" } as Record<string, string>,
    inviteError: "Не удалось отправить приглашения.",
    closed: "Кастинг уже закрыт.",
    tooMany: "Не больше 50 резиденток за раз.",
    project: { tour: "Тур", event: "Ивент" } as Record<string, string>,
    closes: "приём до",
  },
  EN: {
    kicker: "Voyage Admin",
    title: "Location waiting list",
    subtitle: "Residents who pressed “Confirm readiness for this location”. Invite them straight into an open tour or casting in that city.",
    allHubs: "All locations",
    search: "Name, email or @telegram",
    country: "Country",
    anyCountry: "Any country",
    status: "Application status",
    anyStatus: "Any",
    pending: "Pending",
    approved: "Approved",
    segment: "Segment",
    anySegment: "Any",
    kyc: "KYC from",
    kycAny: "Any",
    height: "Height, cm",
    age: "Age",
    from: "from",
    to: "to",
    sizes: "Clothing size",
    applied: "Applied on",
    subscription: "Follows updates",
    subAny: "Any",
    subYes: "Subscribed",
    subNo: "Not subscribed",
    sort: "Sort",
    newest: "Newest first",
    oldest: "Oldest first",
    byKyc: "By KYC",
    reset: "Reset",
    filters: "Filters",
    total: "on the list",
    empty: "Nobody on the waiting list matches these filters.",
    error: "Couldn't load the waiting list.",
    schema: "Apply migration 20261107090000_location_waiting_list.sql.",
    forbidden: "Owner and admin only.",
    invite: "Invite to tour / casting",
    inviteSelected: "Invite selected",
    selected: "selected",
    oneHub: "Select residents of one location to invite them.",
    notEligible: "Can't be invited (ban, blacklist or profile not approved)",
    subscribedHint: "Follows this location",
    notSubscribedHint: "Doesn't follow updates",
    lastInvite: "Last invite",
    inviteStatus: { invited: "invited", accepted: "accepted", declined: "declined", revoked: "revoked" } as Record<string, string>,
    tours: "tours",
    open: "Profile",
    dialogTitle: "Invite to tour / casting",
    dialogFor: "Location",
    castings: "Open castings in this location",
    noCastings: "No open castings in this location right now. Create a casting for this location's tour, then come back.",
    createCasting: "Create casting",
    message: "Message (optional)",
    messagePh: "A short note, sent via Telegram",
    send: "Send invites",
    cancel: "Cancel",
    done: "Invited",
    skipped: "skipped",
    notified: "notified in Telegram",
    skipReasons: { not_eligible: "not eligible", already_responded: "already responded", already_invited: "already invited" } as Record<string, string>,
    inviteError: "Couldn't send invites.",
    closed: "The casting is already closed.",
    tooMany: "50 residents at most per invite.",
    project: { tour: "Tour", event: "Event" } as Record<string, string>,
    closes: "closes",
  },
  ES: {
    kicker: "Voyage Admin",
    title: "Lista de espera del destino",
    subtitle: "Residentes que pulsaron «Confirmar disponibilidad para el destino». Invítalas directamente a un tour o casting abierto en esa ciudad.",
    allHubs: "Todos los destinos",
    search: "Nombre, email o @telegram",
    country: "País",
    anyCountry: "Cualquier país",
    status: "Estado de la solicitud",
    anyStatus: "Cualquiera",
    pending: "Pendiente",
    approved: "Aprobada",
    segment: "Segmento",
    anySegment: "Cualquiera",
    kyc: "KYC desde",
    kycAny: "Cualquiera",
    height: "Altura, cm",
    age: "Edad",
    from: "desde",
    to: "hasta",
    sizes: "Talla de ropa",
    applied: "Fecha de solicitud",
    subscription: "Sigue novedades",
    subAny: "Indiferente",
    subYes: "Suscrita",
    subNo: "Sin suscripción",
    sort: "Orden",
    newest: "Más recientes",
    oldest: "Más antiguas",
    byKyc: "Por KYC",
    reset: "Restablecer",
    filters: "Filtros",
    total: "en la lista",
    empty: "Nadie en la lista coincide con estos filtros.",
    error: "No se pudo cargar la lista de espera.",
    schema: "Aplica la migración 20261107090000_location_waiting_list.sql.",
    forbidden: "Solo owner y admin.",
    invite: "Invitar a tour / casting",
    inviteSelected: "Invitar seleccionadas",
    selected: "seleccionadas",
    oneHub: "Selecciona residentes de un solo destino para invitarlas.",
    notEligible: "No se puede invitar (bloqueo, lista negra o perfil no aprobado)",
    subscribedHint: "Sigue este destino",
    notSubscribedHint: "No sigue novedades",
    lastInvite: "Última invitación",
    inviteStatus: { invited: "invitada", accepted: "aceptó", declined: "rechazó", revoked: "revocada" } as Record<string, string>,
    tours: "tours",
    open: "Ficha",
    dialogTitle: "Invitación a tour / casting",
    dialogFor: "Destino",
    castings: "Castings abiertos del destino",
    noCastings: "No hay castings abiertos en este destino ahora. Crea un casting para el tour de este destino y vuelve.",
    createCasting: "Crear casting",
    message: "Mensaje (opcional)",
    messagePh: "Nota breve, se envía por Telegram",
    send: "Enviar invitaciones",
    cancel: "Cancelar",
    done: "Invitadas",
    skipped: "omitidas",
    notified: "avisadas por Telegram",
    skipReasons: { not_eligible: "no disponible", already_responded: "ya respondió", already_invited: "ya invitada" } as Record<string, string>,
    inviteError: "No se pudieron enviar las invitaciones.",
    closed: "El casting ya está cerrado.",
    tooMany: "Máximo 50 residentes por invitación.",
    project: { tour: "Tour", event: "Evento" } as Record<string, string>,
    closes: "cierra",
  },
  PT: {
    kicker: "Voyage Admin",
    title: "Lista de espera do destino",
    subtitle: "Residentes que carregaram em «Confirmar disponibilidade para o destino». Convide-as diretamente para um tour ou casting aberto nessa cidade.",
    allHubs: "Todos os destinos",
    search: "Nome, email ou @telegram",
    country: "País",
    anyCountry: "Qualquer país",
    status: "Estado da candidatura",
    anyStatus: "Qualquer",
    pending: "Pendente",
    approved: "Aprovada",
    segment: "Segmento",
    anySegment: "Qualquer",
    kyc: "KYC a partir de",
    kycAny: "Qualquer",
    height: "Altura, cm",
    age: "Idade",
    from: "de",
    to: "até",
    sizes: "Tamanho de roupa",
    applied: "Data da candidatura",
    subscription: "Segue novidades",
    subAny: "Indiferente",
    subYes: "Subscrita",
    subNo: "Sem subscrição",
    sort: "Ordenar",
    newest: "Mais recentes",
    oldest: "Mais antigas",
    byKyc: "Por KYC",
    reset: "Repor",
    filters: "Filtros",
    total: "na lista",
    empty: "Ninguém na lista corresponde a estes filtros.",
    error: "Não foi possível carregar a lista de espera.",
    schema: "Aplique a migração 20261107090000_location_waiting_list.sql.",
    forbidden: "Apenas owner e admin.",
    invite: "Convidar para tour / casting",
    inviteSelected: "Convidar selecionadas",
    selected: "selecionadas",
    oneHub: "Selecione residentes de um só destino para as convidar.",
    notEligible: "Não pode ser convidada (bloqueio, lista negra ou perfil não aprovado)",
    subscribedHint: "Segue este destino",
    notSubscribedHint: "Não segue novidades",
    lastInvite: "Último convite",
    inviteStatus: { invited: "convidada", accepted: "aceitou", declined: "recusou", revoked: "revogado" } as Record<string, string>,
    tours: "tours",
    open: "Ficha",
    dialogTitle: "Convite para tour / casting",
    dialogFor: "Destino",
    castings: "Castings abertos do destino",
    noCastings: "Não há castings abertos neste destino agora. Crie um casting para o tour deste destino e volte.",
    createCasting: "Criar casting",
    message: "Mensagem (opcional)",
    messagePh: "Nota curta, enviada pelo Telegram",
    send: "Enviar convites",
    cancel: "Cancelar",
    done: "Convidadas",
    skipped: "ignoradas",
    notified: "avisadas no Telegram",
    skipReasons: { not_eligible: "indisponível", already_responded: "já respondeu", already_invited: "já convidada" } as Record<string, string>,
    inviteError: "Não foi possível enviar os convites.",
    closed: "O casting já está fechado.",
    tooMany: "No máximo 50 residentes por convite.",
    project: { tour: "Tour", event: "Evento" } as Record<string, string>,
    closes: "fecha",
  },
} as const;

type Copy = (typeof T)[Lang];

const EMPTY_FILTERS: WaitingFilters = {
  q: "",
  hub: "",
  country: "",
  status: "",
  segment: "",
  kycMin: "",
  heightMin: "",
  heightMax: "",
  ageMin: "",
  ageMax: "",
  clothingSizes: [],
  from: "",
  to: "",
  subscribed: "",
  sort: "newest",
};

const LOCALE: Record<Lang, string> = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-PT" };

const inputCls =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-200/40 focus:outline-none";
const labelCls = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500";

function formatDate(value: string | null, lang: Lang) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(LOCALE[lang], { day: "2-digit", month: "short", year: "numeric" });
}

function numInput(value: string): number | "" {
  if (value.trim() === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

export default function LocationWaitingListPage() {
  const { lang: raw } = useLanguage();
  const lang = (["EN", "RU", "ES", "PT"].includes(String(raw).toUpperCase()) ? String(raw).toUpperCase() : "EN") as Lang;
  const t = T[lang];
  const { hasRole, loading: authLoading } = useAuth();
  const allowed = !authLoading && hasRole(["owner", "admin"]);

  const [filters, setFilters] = useState<WaitingFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<WaitingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [inviteFor, setInviteFor] = useState<{ hubId: string; rows: WaitingRow[] } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // поиск по имени — с задержкой, остальные фильтры сразу
  useEffect(() => {
    const id = window.setTimeout(() => setFilters((f) => (f.q === query ? f : { ...f, q: query })), 350);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    void getLocationWaitingList({ filters, limit: 300 }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setFailure(res.reason);
        return;
      }
      setFailure(null);
      setPage(res.page);
      setSelected((prev) => new Set(Array.from(prev).filter((key) => res.page.rows.some((r) => r.applicationId === key))));
    });
    return () => {
      cancelled = true;
    };
  }, [filters, allowed, reloadKey]);

  const set = useCallback(<K extends keyof WaitingFilters>(key: K, value: WaitingFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  }, []);

  const rows = page?.rows ?? [];
  const hubs = page?.hubs ?? [];
  const countries = useMemo(
    () => Array.from(new Set(hubs.map((h) => h.countryCode).filter((c): c is string => !!c))).sort(),
    [hubs],
  );
  const selectedRows = rows.filter((r) => selected.has(r.applicationId));
  const selectedHubs = new Set(selectedRows.map((r) => r.hubId));
  const activeFilterCount = [
    filters.country, filters.status, filters.segment, filters.kycMin, filters.heightMin, filters.heightMax,
    filters.ageMin, filters.ageMax, filters.from, filters.to, filters.subscribed,
  ].filter((v) => v !== "" && v !== undefined).length + (filters.clothingSizes?.length ? 1 : 0);

  const toggle = (row: WaitingRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.applicationId)) next.delete(row.applicationId);
      else next.add(row.applicationId);
      return next;
    });
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-400 sm:px-6">
        <p className="mx-auto max-w-xl text-center text-sm">{t.forbidden}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 pb-24 pt-2 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <MapLocationsTabs />

        <header className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/60">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {t.kicker}
          </div>
          <h1 className="font-serif text-4xl font-light tracking-tight text-zinc-100 sm:text-5xl">{t.title}</h1>
          <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-zinc-500">{t.subtitle}</p>
        </header>

        {/* Локации */}
        <div className="mb-4 flex flex-wrap gap-2">
          <HubChip active={!filters.hub} onClick={() => set("hub", "")} label={t.allHubs} count={hubs.reduce((sum, h) => sum + h.waiting, 0)} />
          {hubs.map((h) => (
            <HubChip
              key={h.id}
              active={filters.hub === h.id}
              onClick={() => set("hub", filters.hub === h.id ? "" : h.id)}
              label={`${countryFlag(h.countryCode)} ${pickName(h.name, lang, h.id)}`.trim()}
              count={h.waiting}
            />
          ))}
        </div>

        {/* Поиск + фильтры */}
        <div className="mb-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-3 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} className={`${inputCls} pl-9`} />
            </label>
            <div className="flex flex-wrap gap-2">
              <select value={filters.sort} onChange={(e) => set("sort", e.target.value as WaitingFilters["sort"])} className={`${inputCls} w-auto`} aria-label={t.sort}>
                <option value="newest">{t.newest}</option>
                <option value="oldest">{t.oldest}</option>
                <option value="kyc">{t.byKyc}</option>
              </select>
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                  showFilters || activeFilterCount ? "border-amber-200/30 text-amber-200" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Filter className="h-3.5 w-3.5" aria-hidden />
                {t.filters}
                {activeFilterCount > 0 && <span className="rounded-full bg-amber-200 px-1.5 text-[10px] text-zinc-950">{activeFilterCount}</span>}
              </button>
              {(activeFilterCount > 0 || filters.hub || query) && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilters(EMPTY_FILTERS);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  {t.reset}
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 grid gap-4 border-t border-zinc-800/60 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className={labelCls}>{t.country}</span>
                <select value={filters.country} onChange={(e) => set("country", e.target.value)} className={inputCls}>
                  <option value="">{t.anyCountry}</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {countryFlag(c)} {countryName(c, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={labelCls}>{t.status}</span>
                <select value={filters.status} onChange={(e) => set("status", e.target.value as WaitingFilters["status"])} className={inputCls}>
                  <option value="">{t.anyStatus}</option>
                  <option value="pending">{t.pending}</option>
                  <option value="approved">{t.approved}</option>
                </select>
              </div>
              <div>
                <span className={labelCls}>{t.segment}</span>
                <select value={filters.segment} onChange={(e) => set("segment", e.target.value as WaitingFilters["segment"])} className={inputCls}>
                  <option value="">{t.anySegment}</option>
                  <option value="working">Working</option>
                  <option value="elite">Elite</option>
                </select>
              </div>
              <div>
                <span className={labelCls}>{t.kyc}</span>
                <select value={String(filters.kycMin)} onChange={(e) => set("kycMin", numInput(e.target.value))} className={inputCls}>
                  <option value="">{t.kycAny}</option>
                  <option value="1">KYC 1</option>
                  <option value="2">KYC 2</option>
                  <option value="3">KYC 3 · VIP</option>
                </select>
              </div>
              <RangeField label={t.height} from={t.from} to={t.to} min={filters.heightMin} max={filters.heightMax} onMin={(v) => set("heightMin", v)} onMax={(v) => set("heightMax", v)} />
              <RangeField label={t.age} from={t.from} to={t.to} min={filters.ageMin} max={filters.ageMax} onMin={(v) => set("ageMin", v)} onMax={(v) => set("ageMax", v)} />
              <div>
                <span className={labelCls}>{t.applied}</span>
                <div className="flex gap-2">
                  <input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} className={inputCls} aria-label={`${t.applied} ${t.from}`} />
                  <input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} className={inputCls} aria-label={`${t.applied} ${t.to}`} />
                </div>
              </div>
              <div>
                <span className={labelCls}>{t.subscription}</span>
                <select value={filters.subscribed} onChange={(e) => set("subscribed", e.target.value as WaitingFilters["subscribed"])} className={inputCls}>
                  <option value="">{t.subAny}</option>
                  <option value="yes">{t.subYes}</option>
                  <option value="no">{t.subNo}</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <span className={labelCls}>{t.sizes}</span>
                <div className="flex flex-wrap gap-2">
                  {CLOTHING_SIZES.map((size) => {
                    const on = filters.clothingSizes?.includes(size) ?? false;
                    return (
                      <button
                        key={size}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          set("clothingSizes", on ? (filters.clothingSizes ?? []).filter((s) => s !== size) : [...(filters.clothingSizes ?? []), size])
                        }
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          on ? "border-amber-200/40 bg-amber-200/10 text-amber-200" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          <span>
            <span className="text-zinc-200">{page?.total ?? 0}</span> {t.total}
          </span>
        </div>

        {failure && (
          <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200/80">
            {failure === "schema" ? t.schema : failure === "forbidden" ? t.forbidden : t.error}
          </p>
        )}

        {!loading && !failure && rows.length === 0 && (
          <p className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 px-4 py-10 text-center text-sm text-zinc-500">{t.empty}</p>
        )}

        <ul className="space-y-2">
          {rows.map((row) => (
            <WaitingRowCard
              key={row.applicationId}
              row={row}
              lang={lang}
              t={t}
              checked={selected.has(row.applicationId)}
              onToggle={() => toggle(row)}
              onInvite={() => setInviteFor({ hubId: row.hubId, rows: [row] })}
            />
          ))}
        </ul>
      </div>

      {/* Панель выбранных */}
      {selectedRows.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-300">
              {selectedRows.length} {t.selected}
              {selectedHubs.size > 1 && <span className="ml-2 text-xs text-amber-200/80">{t.oneHub}</span>}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelected(new Set())} className="rounded-full border border-zinc-800 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200">
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={selectedHubs.size !== 1}
                onClick={() => setInviteFor({ hubId: selectedRows[0].hubId, rows: selectedRows })}
                className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                {t.inviteSelected}
              </button>
            </div>
          </div>
        </div>
      )}

      {inviteFor && (
        <InviteDialog
          lang={lang}
          t={t}
          hub={hubs.find((h) => h.id === inviteFor.hubId) ?? null}
          hubId={inviteFor.hubId}
          rows={inviteFor.rows}
          onClose={(changed) => {
            setInviteFor(null);
            if (changed) {
              setSelected(new Set());
              setReloadKey((k) => k + 1);
            }
          }}
        />
      )}
    </main>
  );
}

function HubChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
        active ? "border-amber-200/40 bg-amber-200/10 text-amber-200" : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-amber-200 text-zinc-950" : "bg-zinc-800 text-zinc-400"}`}>{count}</span>
    </button>
  );
}

function RangeField({
  label, from, to, min, max, onMin, onMax,
}: {
  label: string; from: string; to: string;
  min: number | "" | undefined; max: number | "" | undefined;
  onMin: (v: number | "") => void; onMax: (v: number | "") => void;
}) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex gap-2">
        <input inputMode="numeric" value={min ?? ""} onChange={(e) => onMin(numInput(e.target.value))} placeholder={from} className={inputCls} aria-label={`${label} ${from}`} />
        <input inputMode="numeric" value={max ?? ""} onChange={(e) => onMax(numInput(e.target.value))} placeholder={to} className={inputCls} aria-label={`${label} ${to}`} />
      </div>
    </div>
  );
}

function WaitingRowCard({
  row, lang, t, checked, onToggle, onInvite,
}: {
  row: WaitingRow; lang: Lang; t: Copy; checked: boolean; onToggle: () => void; onInvite: () => void;
}) {
  const params = [
    row.age ? `${row.age}` : null,
    row.height ? `${row.height} ${lang === "RU" ? "см" : "cm"}` : null,
    row.clothingSize,
    row.shoeSize ? `EU ${row.shoeSize}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-3 transition-colors sm:flex-nowrap sm:px-4 ${
        checked ? "border-amber-200/30 bg-amber-200/[0.04]" : "border-zinc-800/60 bg-zinc-900/30"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={!row.eligible}
        aria-label={row.name ?? row.id}
        className="h-4 w-4 shrink-0 accent-amber-200 disabled:opacity-30"
      />

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900">
          {row.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-600">
              <UserRound className="h-5 w-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-zinc-100">{row.name ?? "—"}</span>
            {row.kycLevel >= 3 ? (
              <VipBadge lang={lang} variant="compact" />
            ) : (
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${row.kycLevel > 0 ? "border-emerald-400/30 text-emerald-300/80" : "border-zinc-800 text-zinc-600"}`}>
                <ShieldCheck className="h-3 w-3" aria-hidden />
                KYC {row.kycLevel}
              </span>
            )}
            {row.segment && <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{row.segment}</span>}
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">
            {row.telegram ? `@${row.telegram.replace(/^@/, "")}` : null}
            {row.telegram && params ? " · " : null}
            {params}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400 sm:w-auto sm:flex-nowrap">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <MapPin className="h-3.5 w-3.5 text-amber-200/60" aria-hidden />
          {countryFlag(row.countryCode)} {pickName(row.hubName, lang, row.hubId)}
        </span>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${row.status === "approved" ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-200/10 text-amber-200"}`}>
          {row.status === "approved" ? t.approved : t.pending}
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={t.applied}>
          <CalendarDays className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
          {formatDate(row.appliedAt, lang)}
        </span>
        <span title={row.subscribed ? t.subscribedHint : t.notSubscribedHint} className="inline-flex">
          {row.subscribed ? <BellRing className="h-3.5 w-3.5 text-amber-200" aria-label={t.subscribedHint} /> : <BellOff className="h-3.5 w-3.5 text-zinc-700" aria-label={t.notSubscribedHint} />}
        </span>
        {row.lastInvite && (
          <span className="whitespace-nowrap text-[11px] text-zinc-500" title={t.lastInvite}>
            <Check className="mr-1 inline h-3 w-3" aria-hidden />
            {t.inviteStatus[row.lastInvite.status] ?? row.lastInvite.status}
          </span>
        )}
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        <Link href={`/admin/database/${row.id}`} className="inline-flex flex-1 items-center justify-center rounded-full border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 sm:flex-none">
          {t.open}
        </Link>
        <button
          type="button"
          onClick={onInvite}
          disabled={!row.eligible}
          title={row.eligible ? t.invite : t.notEligible}
          className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200/30 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition-colors hover:bg-amber-200/10 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {t.invite}
        </button>
      </div>
    </li>
  );
}

function InviteDialog({
  lang, t, hub, hubId, rows, onClose,
}: {
  lang: Lang; t: Copy; hub: { name: Record<string, string | undefined>; countryCode: string | null } | null; hubId: string; rows: WaitingRow[]; onClose: (changed: boolean) => void;
}) {
  const [castings, setCastings] = useState<OpenCasting[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [castingId, setCastingId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ invited: number; skipped: { id: string; reason: string }[]; notified: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getLocationOpenCastings(hubId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(true);
        setCastings([]);
        return;
      }
      setCastings(res.castings);
      if (res.castings.length === 1) setCastingId(res.castings[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, [hubId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose(result !== null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, result]);

  const send = async () => {
    if (!castingId || busy) return;
    setBusy(true);
    setError(null);
    const res = await inviteResidents({ castingId, residentIds: rows.map((r) => r.id), message });
    setBusy(false);
    if (!res.ok) {
      setError(res.reason === "closed" ? t.closed : res.reason === "too_many" ? t.tooMany : t.inviteError);
      return;
    }
    setResult({ invited: res.summary.invited.length, skipped: res.summary.skipped, notified: res.summary.notified });
  };

  const nameOf = (id: string) => rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);
  const hubLabel = hub ? `${countryFlag(hub.countryCode)} ${pickName(hub.name, lang, hubId)}` : hubId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="invite-dialog-title" className="font-serif text-2xl font-light text-zinc-100">{t.dialogTitle}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {t.dialogFor}: <span className="text-zinc-300">{hubLabel}</span> · {rows.length} {t.selected}
            </p>
          </div>
          <button type="button" onClick={() => onClose(result !== null)} className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200" aria-label={t.cancel}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 line-clamp-2 text-xs text-zinc-400">{rows.map((r) => r.name ?? "—").join(", ")}</p>

        {result ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">
              {t.done}: {result.invited} · {t.notified}: {result.notified}
              {result.skipped.length > 0 && ` · ${t.skipped}: ${result.skipped.length}`}
            </p>
            {result.skipped.length > 0 && (
              <ul className="space-y-1 text-xs text-zinc-500">
                {result.skipped.map((s) => (
                  <li key={s.id}>
                    {nameOf(s.id)} — {t.skipReasons[s.reason] ?? s.reason}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => onClose(true)} className="w-full rounded-full bg-amber-200 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-950 hover:bg-amber-100">
              OK
            </button>
          </div>
        ) : (
          <>
            <span className={labelCls}>{t.castings}</span>
            {castings === null ? (
              <div className="flex justify-center py-6 text-zinc-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              </div>
            ) : castings.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-4 text-sm text-zinc-400">
                <p>{loadError ? t.inviteError : t.noCastings}</p>
                {!loadError && (
                  <Link href="/partner/castings/new" className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.14em] text-amber-200 hover:text-amber-100">
                    {t.createCasting} →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {castings.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                      castingId === c.id ? "border-amber-200/40 bg-amber-200/[0.05]" : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <input type="radio" name="casting" value={c.id} checked={castingId === c.id} onChange={() => setCastingId(c.id)} className="mt-1 accent-amber-200" />
                    <span className="min-w-0">
                      <span className="block text-sm text-zinc-100">
                        {pickName(c.title, lang, c.city ?? "—")}
                        {c.projectType && <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{t.project[c.projectType] ?? c.projectType}</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {formatDate(c.startsOn, lang)} — {formatDate(c.endsOn, lang)} · {t.closes} {formatDate(c.closesAt, lang)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <label className="mt-4 block">
              <span className={labelCls}>{t.message}</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 500))} rows={3} placeholder={t.messagePh} className={inputCls} />
            </label>

            {error && <p className="mt-3 text-sm text-red-300/80">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => onClose(false)} className="flex-1 rounded-full border border-zinc-800 px-4 py-2.5 text-xs text-zinc-400 hover:text-zinc-200">
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={!castingId || busy}
                className="inline-flex flex-[2] items-center justify-center gap-2 rounded-full bg-amber-200 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
                {t.send}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
