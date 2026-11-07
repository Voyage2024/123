"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — каталог статичных туров
 * app/(dashboard)/partner/castings/tours/page.tsx
 *
 * Статичный тур — постоянное направление клуба (Дубай, Сидней …) с базовыми
 * условиями, стандартным описанием и требованиями на RU/EN/ES/PT.
 * Динамичные кастинги создаются под тур (/partner/castings/new).
 *
 * Направление тура — только локация из /admin/map-locations (map_hubs):
 * город и регион берутся из неё, одна локация — один тур, вручную
 * направление не заводится (миграция 20261103100000_tour_catalog_map_hubs.sql).
 *
 * Партнёры видят активные туры; owner/admin создают, правят, скрывают и
 * удаляют (server actions app/actions/tour-catalog.ts + RLS tour_catalog).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Map as MapIcon, MapPinned, Pencil, Plus, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { ROUTES } from "@/app/(dashboard)/partner/_lib/routes";
import { I18nTextFields } from "@/app/(dashboard)/partner/_components/I18nTextFields";
import { CURRENCIES, LANGUAGE_CODES } from "@/app/(dashboard)/partner/_components/CastingBriefFields";
import { deleteCatalogTour, listCatalogTours, saveCatalogTour, type CatalogFailure } from "@/app/actions/tour-catalog";
import { PROJECTS, projectLabels } from "@/lib/project-types";
import {
  TITLE_MAX,
  TOUR_DESCRIPTION_MAX,
  TOUR_NOTE_MAX,
  pickI18n,
  type CastingLang,
  type I18nText,
} from "@/lib/casting-i18n";
import { MAP_HUB_REGIONS, mapHubName, type CatalogTour, type MapHub, type TourAudience, type TourPayer } from "@/lib/tour-catalog";
import { countryFlag, countryName } from "@/lib/countries";

type Dict = {
  back: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  add: string;
  empty: string;
  hidden: string;
  edit: string;
  newCasting: string;
  requirements: string;
  conditions: string;
  fee: string;
  feeOpen: string;
  height: (cm: number) => string;
  editorNew: string;
  editorEdit: string;
  location: string;
  locationPick: string;
  locationHint: string;
  locationOff: string;
  locationBusy: string;
  manageLocations: string;
  noHub: string;
  hubsWithout: string;
  hubsWithoutHint: string;
  makeTour: string;
  project: string;
  audience: string;
  audiences: Record<TourAudience, string>;
  texts: string;
  tTitle: string;
  tDescription: string;
  tRequirements: string;
  tConditions: string;
  defaults: string;
  flight: string;
  hotel: string;
  payer: Record<TourPayer, string>;
  heightMin: string;
  languages: string;
  active: string;
  sort: string;
  save: string;
  saving: string;
  cancel: string;
  remove: string;
  removeConfirm: string;
  errors: Record<CatalogFailure, string> & { field: (f: string) => string };
};

const LOC = {
  RU: {
    location: "Локация на карте",
    locationPick: "Выберите локацию",
    locationHint: "Направления заводятся только в «Админ → Локации карты». Город и регион тура берутся оттуда.",
    locationOff: "выключена на карте",
    locationBusy: "уже есть тур",
    manageLocations: "Локации карты",
    noHub: "Нет локации на карте — тур выключен. Выберите локацию.",
    hubsWithout: "Локации карты без тура",
    hubsWithoutHint: "Для каждой локации можно оформить один статичный тур.",
    makeTour: "Оформить тур",
  },
  EN: {
    location: "Map location",
    locationPick: "Choose a location",
    locationHint: "Destinations are created only in “Admin → Map locations”. The tour’s city and region come from there.",
    locationOff: "disabled on the map",
    locationBusy: "already has a tour",
    manageLocations: "Map locations",
    noHub: "No map location — the tour is disabled. Choose a location.",
    hubsWithout: "Map locations without a tour",
    hubsWithoutHint: "Each location can have one static tour.",
    makeTour: "Create tour",
  },
  ES: {
    location: "Ubicación en el mapa",
    locationPick: "Elige una ubicación",
    locationHint: "Los destinos se crean solo en «Admin → Ubicaciones del mapa». La ciudad y la región del tour salen de ahí.",
    locationOff: "desactivada en el mapa",
    locationBusy: "ya tiene tour",
    manageLocations: "Ubicaciones del mapa",
    noHub: "Sin ubicación en el mapa: el tour está desactivado. Elige una ubicación.",
    hubsWithout: "Ubicaciones del mapa sin tour",
    hubsWithoutHint: "Cada ubicación puede tener un tour fijo.",
    makeTour: "Crear tour",
  },
  PT: {
    location: "Local no mapa",
    locationPick: "Escolha um local",
    locationHint: "Os destinos são criados só em «Admin → Locais do mapa». Cidade e região do tour vêm de lá.",
    locationOff: "desativado no mapa",
    locationBusy: "já tem tour",
    manageLocations: "Locais do mapa",
    noHub: "Sem local no mapa — o tour está desativado. Escolha um local.",
    hubsWithout: "Locais do mapa sem tour",
    hubsWithoutHint: "Cada local pode ter um tour fixo.",
    makeTour: "Criar tour",
  },
} as const;

const HUB_ERRORS = {
  RU: {
    hub_required: "Выберите локацию из «Локаций карты».",
    hub_taken: "У этой локации уже есть тур — правьте его.",
    hub_inactive: "Локация выключена на карте — тур можно сохранить только скрытым.",
    hub_no_country: "У локации не указана страна. Заполните её в «Локациях карты» — тур привязывается к стране и городу.",
  },
  EN: {
    hub_required: "Choose a location from “Map locations”.",
    hub_taken: "This location already has a tour — edit that one.",
    hub_inactive: "The location is disabled on the map — the tour can only be saved hidden.",
    hub_no_country: "The location has no country. Set it in “Map locations” — a tour is bound to a country and a city.",
  },
  ES: {
    hub_required: "Elige una ubicación de «Ubicaciones del mapa».",
    hub_taken: "Esta ubicación ya tiene un tour; edítalo.",
    hub_inactive: "La ubicación está desactivada en el mapa: el tour solo puede guardarse oculto.",
    hub_no_country: "La ubicación no tiene país. Indícalo en «Ubicaciones del mapa»: el tour va ligado a país y ciudad.",
  },
  PT: {
    hub_required: "Escolha um local em «Locais do mapa».",
    hub_taken: "Este local já tem um tour — edite-o.",
    hub_inactive: "O local está desativado no mapa — o tour só pode ser salvo oculto.",
    hub_no_country: "O local não tem país. Preencha em «Locais do mapa» — o tour fica ligado a país e cidade.",
  },
} as const;

const T: Record<Lang, Dict> = {
  RU: {
    back: "Все кастинги",
    eyebrow: "Кастинги · Каталог туров",
    title: "Туры",
    subtitle: "Статичные направления клуба с постоянными условиями. Кастинги — отборы на конкретные даты под тур.",
    add: "Новый тур",
    empty: "В каталоге пока нет туров.",
    hidden: "Скрыт",
    edit: "Править",
    newCasting: "Кастинг под этот тур",
    requirements: "Требования",
    conditions: "Условия",
    fee: "Гонорар по умолчанию",
    feeOpen: "по договорённости",
    height: (cm) => `от ${cm} см`,
    editorNew: "Новый тур",
    editorEdit: "Правка тура",
    ...LOC.RU,
    project: "Тип",
    audience: "Аудитория",
    audiences: { all: "Все", working: "Working", elite: "Elite" },
    texts: "Описание тура · 4 языка",
    tTitle: "Название тура",
    tDescription: "Описание",
    tRequirements: "Требования",
    tConditions: "Базовые условия",
    defaults: "Условия по умолчанию для кастингов",
    flight: "Перелёт оплачивает",
    hotel: "Отель оплачивает",
    payer: { manager: "Организатор", participant: "Участница", split: "Пополам" },
    heightMin: "Мин. рост, см",
    languages: "Языки",
    active: "Тур активен (виден партнёрам и в форме кастинга)",
    sort: "Порядок",
    save: "Сохранить тур",
    saving: "Сохраняем…",
    cancel: "Отмена",
    remove: "Удалить",
    removeConfirm: "Точно удалить? Кастинги останутся, но потеряют ссылку на тур.",
    errors: {
      ...HUB_ERRORS.RU,
      forbidden: "Править каталог могут только owner и admin.",
      invalid: "Проверьте поля формы.",
      slug_taken: "Такой адрес (slug) уже занят — укажите другой.",
      schema: "В базе нет каталога туров. Примените миграцию 20261103090000_tour_catalog_casting_i18n_invites.sql.",
      not_found: "Тур не найден — возможно, его уже удалили.",
      failed: "Не удалось сохранить. Попробуйте ещё раз.",
      field: (f) => `Проверьте поле: ${f}.`,
    },
  },
  EN: {
    back: "All castings",
    eyebrow: "Castings · Tour catalog",
    title: "Tours",
    subtitle: "The club’s permanent destinations with standing terms. Castings are selections for specific dates under a tour.",
    add: "New tour",
    empty: "No tours in the catalog yet.",
    hidden: "Hidden",
    edit: "Edit",
    newCasting: "Casting for this tour",
    requirements: "Requirements",
    conditions: "Terms",
    fee: "Default fee",
    feeOpen: "negotiable",
    height: (cm) => `from ${cm} cm`,
    editorNew: "New tour",
    editorEdit: "Edit tour",
    ...LOC.EN,
    project: "Type",
    audience: "Audience",
    audiences: { all: "All", working: "Working", elite: "Elite" },
    texts: "Tour description · 4 languages",
    tTitle: "Tour name",
    tDescription: "Description",
    tRequirements: "Requirements",
    tConditions: "Base terms",
    defaults: "Default terms for castings",
    flight: "Flight paid by",
    hotel: "Hotel paid by",
    payer: { manager: "Organizer", participant: "Participant", split: "Split" },
    heightMin: "Min. height, cm",
    languages: "Languages",
    active: "Tour is active (visible to partners and in the casting form)",
    sort: "Order",
    save: "Save tour",
    saving: "Saving…",
    cancel: "Cancel",
    remove: "Delete",
    removeConfirm: "Delete for sure? Castings stay but lose the link to the tour.",
    errors: {
      ...HUB_ERRORS.EN,
      forbidden: "Only the owner and admins can edit the catalog.",
      invalid: "Check the form fields.",
      slug_taken: "This slug is taken — choose another one.",
      schema: "The database has no tour catalog yet. Apply migration 20261103090000_tour_catalog_casting_i18n_invites.sql.",
      not_found: "Tour not found — it may have been deleted.",
      failed: "Could not save. Try again.",
      field: (f) => `Check the field: ${f}.`,
    },
  },
  ES: {
    back: "Todos los castings",
    eyebrow: "Castings · Catálogo de tours",
    title: "Tours",
    subtitle: "Destinos permanentes del club con condiciones fijas. Los castings son selecciones para fechas concretas dentro de un tour.",
    add: "Nuevo tour",
    empty: "Todavía no hay tours en el catálogo.",
    hidden: "Oculto",
    edit: "Editar",
    newCasting: "Casting para este tour",
    requirements: "Requisitos",
    conditions: "Condiciones",
    fee: "Honorario por defecto",
    feeOpen: "a convenir",
    height: (cm) => `desde ${cm} cm`,
    editorNew: "Nuevo tour",
    editorEdit: "Editar tour",
    ...LOC.ES,
    project: "Tipo",
    audience: "Audiencia",
    audiences: { all: "Todas", working: "Working", elite: "Elite" },
    texts: "Descripción del tour · 4 idiomas",
    tTitle: "Nombre del tour",
    tDescription: "Descripción",
    tRequirements: "Requisitos",
    tConditions: "Condiciones base",
    defaults: "Condiciones por defecto para castings",
    flight: "El vuelo lo paga",
    hotel: "El hotel lo paga",
    payer: { manager: "Organizador", participant: "Participante", split: "A medias" },
    heightMin: "Altura mín., cm",
    languages: "Idiomas",
    active: "Tour activo (visible para socios y en el formulario de casting)",
    sort: "Orden",
    save: "Guardar tour",
    saving: "Guardando…",
    cancel: "Cancelar",
    remove: "Eliminar",
    removeConfirm: "¿Eliminar seguro? Los castings se quedan, pero pierden el enlace al tour.",
    errors: {
      ...HUB_ERRORS.ES,
      forbidden: "Solo el owner y los admins pueden editar el catálogo.",
      invalid: "Revisa los campos del formulario.",
      slug_taken: "Este slug ya existe; elige otro.",
      schema: "La base no tiene catálogo de tours. Aplica la migración 20261103090000_tour_catalog_casting_i18n_invites.sql.",
      not_found: "Tour no encontrado; quizá ya se eliminó.",
      failed: "No se pudo guardar. Inténtalo de nuevo.",
      field: (f) => `Revisa el campo: ${f}.`,
    },
  },
  PT: {
    back: "Todos os castings",
    eyebrow: "Castings · Catálogo de tours",
    title: "Tours",
    subtitle: "Destinos permanentes do clube com condições fixas. Castings são seleções para datas específicas dentro de um tour.",
    add: "Novo tour",
    empty: "Ainda não há tours no catálogo.",
    hidden: "Oculto",
    edit: "Editar",
    newCasting: "Casting para este tour",
    requirements: "Requisitos",
    conditions: "Condições",
    fee: "Cachê padrão",
    feeOpen: "a combinar",
    height: (cm) => `a partir de ${cm} cm`,
    editorNew: "Novo tour",
    editorEdit: "Editar tour",
    ...LOC.PT,
    project: "Tipo",
    audience: "Público",
    audiences: { all: "Todas", working: "Working", elite: "Elite" },
    texts: "Descrição do tour · 4 idiomas",
    tTitle: "Nome do tour",
    tDescription: "Descrição",
    tRequirements: "Requisitos",
    tConditions: "Condições base",
    defaults: "Condições padrão para castings",
    flight: "Passagem paga por",
    hotel: "Hotel pago por",
    payer: { manager: "Organizador", participant: "Participante", split: "Dividido" },
    heightMin: "Altura mín., cm",
    languages: "Idiomas",
    active: "Tour ativo (visível para parceiros e no formulário de casting)",
    sort: "Ordem",
    save: "Salvar tour",
    saving: "Salvando…",
    cancel: "Cancelar",
    remove: "Excluir",
    removeConfirm: "Excluir mesmo? Os castings ficam, mas perdem o vínculo com o tour.",
    errors: {
      ...HUB_ERRORS.PT,
      forbidden: "Só o owner e os admins podem editar o catálogo.",
      invalid: "Confira os campos do formulário.",
      slug_taken: "Este slug já existe — escolha outro.",
      schema: "O banco não tem catálogo de tours. Aplique a migração 20261103090000_tour_catalog_casting_i18n_invites.sql.",
      not_found: "Tour não encontrado — talvez já tenha sido excluído.",
      failed: "Não foi possível salvar. Tente de novo.",
      field: (f) => `Confira o campo: ${f}.`,
    },
  },
};

type Draft = {
  id: string | null;
  mapHubId: string;
  project: (typeof PROJECTS)[number];
  audience: TourAudience;
  sourceLang: CastingLang;
  texts: Record<"title" | "description" | "requirements" | "conditions", I18nText>;
  feeAmount: string;
  feeCurrency: string;
  flightPaidBy: TourPayer;
  hotelPaidBy: TourPayer;
  heightMin: string;
  languages: string[];
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: Draft = {
  id: null,
  mapHubId: "",
  project: "tour",
  audience: "all",
  sourceLang: "RU",
  texts: { title: {}, description: {}, requirements: {}, conditions: {} },
  feeAmount: "",
  feeCurrency: "USD",
  flightPaidBy: "manager",
  hotelPaidBy: "manager",
  heightMin: "",
  languages: [],
  isActive: true,
  sortOrder: 0,
};

function toDraft(t: CatalogTour): Draft {
  return {
    id: t.id,
    mapHubId: t.mapHubId ?? "",
    project: t.project,
    audience: t.audience,
    sourceLang: t.sourceLang,
    texts: { title: t.title, description: t.description, requirements: t.requirements, conditions: t.conditions },
    feeAmount: t.feeAmount === null ? "" : String(t.feeAmount),
    feeCurrency: t.feeCurrency ?? "USD",
    flightPaidBy: t.flightPaidBy,
    hotelPaidBy: t.hotelPaidBy,
    heightMin: t.heightMin === null ? "" : String(t.heightMin),
    languages: t.languages,
    isActive: t.isActive,
    sortOrder: t.sortOrder,
  };
}

const INPUT =
  "min-h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/50 focus:outline-none";
const LABEL = "block space-y-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400";

export default function TourCatalogPage() {
  const { role } = useAuth();
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const isAdmin = role === "owner" || role === "admin";
  const [tours, setTours] = useState<CatalogTour[]>([]);
  const [hubs, setHubs] = useState<MapHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listCatalogTours({ includeInactive: isAdmin });
    setLoading(false);
    if (!res.ok) {
      setError(t.errors[res.reason]);
      return;
    }
    setError(null);
    setTours(res.tours);
    setHubs(res.hubs);
  }, [isAdmin, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const projects = projectLabels(lang);
  const hubById = new Map(hubs.map((h) => [h.id, h]));
  const usedHubs = new Set(tours.map((x) => x.mapHubId).filter((id): id is string => !!id));
  const freeHubs = hubs.filter((h) => !usedHubs.has(h.id));
  const draftFromHub = (hub: MapHub): Draft => ({
    ...EMPTY,
    mapHubId: hub.id,
    isActive: hub.isActive,
    texts: { ...EMPTY.texts, title: { ...hub.name } },
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-6 sm:px-6">
      <Link href={ROUTES.castings} className="inline-flex items-center gap-2 text-xs text-zinc-400 transition hover:text-amber-100">
        <ArrowLeft size={14} /> {t.back}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-100/60">{t.eyebrow}</p>
          <h1 className="mt-2 font-serif text-3xl text-zinc-50 sm:text-4xl">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">{t.subtitle}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/map-locations"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 text-sm text-zinc-300 transition hover:border-amber-200/30 hover:text-amber-100"
            >
              <MapIcon size={16} /> {t.manageLocations}
            </Link>
            <button
              type="button"
              disabled={freeHubs.length === 0}
              onClick={() => setDraft({ ...EMPTY })}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200/40 bg-amber-200 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} /> {t.add}
            </button>
          </div>
        )}
      </header>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {isAdmin && !loading && freeHubs.length > 0 && (
        <section className="rounded-2xl border border-dashed border-amber-200/20 bg-amber-200/[0.03] p-4">
          <p className="text-sm text-zinc-200">{t.hubsWithout}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{t.hubsWithoutHint}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {freeHubs.map((hub) => (
              <li key={hub.id}>
                <button
                  type="button"
                  onClick={() => setDraft(draftFromHub(hub))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${hub.isActive ? "border-amber-200/30 text-amber-100 hover:bg-amber-200/10" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
                >
                  <Plus size={12} /> {countryFlag(hub.countryCode)} {mapHubName(hub, lang)}
                  <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{MAP_HUB_REGIONS[hub.region ?? ""] ?? hub.region ?? ""}</span>
                  {!hub.isActive && <span className="text-[10px] text-zinc-500">· {t.locationOff}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-sm text-zinc-500">…</div>
      ) : tours.length === 0 && !error ? (
        <p className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">{t.empty}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {tours.map((tour) => {
            const requirements = pickI18n(tour.requirements, lang, tour.sourceLang);
            const conditions = pickI18n(tour.conditions, lang, tour.sourceLang);
            const description = pickI18n(tour.description, lang, tour.sourceLang);
            const hub = tour.mapHubId ? hubById.get(tour.mapHubId) : undefined;
            return (
              <li
                key={tour.id}
                className={`flex flex-col rounded-2xl border bg-zinc-900/40 p-5 ${tour.isActive ? "border-zinc-800/80" : "border-zinc-800/50 opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                      {projects[tour.project]} · <MapPinned size={10} className="-mt-0.5 inline" /> {hub ? mapHubName(hub, lang) : tour.city}
                      {tour.countryCode ? ` · ${countryFlag(tour.countryCode)} ${countryName(tour.countryCode, lang)}` : ""}
                      {tour.region ? ` · ${MAP_HUB_REGIONS[tour.region] ?? tour.region}` : ""} · {t.audiences[tour.audience]}
                    </p>
                    <h2 className="mt-1 font-serif text-2xl text-zinc-50">{pickI18n(tour.title, lang, tour.sourceLang) ?? tour.city}</h2>
                  </div>
                  {!tour.isActive && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                      <EyeOff size={11} /> {t.hidden}
                    </span>
                  )}
                </div>
                {!tour.mapHubId && <p className="mt-2 text-xs text-amber-200/80">{t.noHub}</p>}
                {description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-300">{description}</p>}
                {requirements && (
                  <p className="mt-3 text-xs leading-5 text-zinc-400">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t.requirements}: </span>
                    {requirements}
                  </p>
                )}
                {conditions && (
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t.conditions}: </span>
                    {conditions}
                  </p>
                )}
                <p className="mt-3 text-xs text-zinc-500">
                  {t.fee}: {tour.feeAmount !== null && tour.feeCurrency ? `${tour.feeAmount} ${tour.feeCurrency}` : t.feeOpen}
                  {tour.heightMin ? ` · ${t.height(tour.heightMin)}` : ""}
                  {tour.languages.length ? ` · ${tour.languages.join(" · ")}` : ""}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {tour.isActive && (
                    <Link
                      href={`${ROUTES.newCasting}?tour=${encodeURIComponent(tour.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200/30 bg-amber-200/10 px-3 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-200/15"
                    >
                      <Plus size={13} /> {t.newCasting}
                    </Link>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDraft(toDraft(tour))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-200/25 hover:text-amber-100"
                    >
                      <Pencil size={13} /> {t.edit}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draft && isAdmin && (
        <TourEditor
          draft={draft}
          t={t}
          lang={lang}
          hubs={hubs}
          usedHubs={usedHubs}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null);
            void load();
          }}
        />
      )}
    </main>
  );
}

function TourEditor({
  draft: initial,
  t,
  lang,
  hubs,
  usedHubs,
  onClose,
  onSaved,
}: {
  draft: Draft;
  t: Dict;
  lang: Lang;
  hubs: MapHub[];
  usedHubs: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((cur) => ({ ...cur, ...patch }));
  const projects = projectLabels(lang);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    if (!d.mapHubId) {
      setSaving(false);
      setError(t.errors.hub_required);
      return;
    }
    const res = await saveCatalogTour({
      id: d.id,
      mapHubId: d.mapHubId,
      project: d.project,
      audience: d.audience,
      sourceLang: d.sourceLang,
      title: d.texts.title,
      description: d.texts.description,
      requirements: d.texts.requirements,
      conditions: d.texts.conditions,
      feeAmount: d.feeAmount,
      feeCurrency: d.feeCurrency,
      flightPaidBy: d.flightPaidBy,
      hotelPaidBy: d.hotelPaidBy,
      heightMin: d.heightMin,
      languages: d.languages,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.reason === "invalid" && res.field ? t.errors.field(res.field) : t.errors[res.reason]);
      return;
    }
    onSaved();
  };

  const remove = async () => {
    if (!d.id) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    const res = await deleteCatalogTour(d.id);
    setSaving(false);
    if (!res.ok) {
      setError(t.errors[res.reason]);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={d.id ? t.editorEdit : t.editorNew}>
      <form onSubmit={submit} className="w-full max-w-3xl space-y-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-2xl text-zinc-50">
            <MapPinned size={20} className="text-amber-200/80" /> {d.id ? t.editorEdit : t.editorNew}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:text-white" aria-label={t.cancel}>
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={`${LABEL} sm:col-span-2`}>
            <span>{t.location} *</span>
            <select
              className={INPUT}
              value={d.mapHubId}
              required
              onChange={(e) => {
                const hub = hubs.find((h) => h.id === e.target.value);
                set({
                  mapHubId: e.target.value,
                  isActive: hub ? d.isActive && hub.isActive : d.isActive,
                  // Пустое название тура — подставляем название локации с карты
                  texts: hub && !Object.values(d.texts.title).some((v) => (v ?? "").trim()) ? { ...d.texts, title: { ...hub.name } } : d.texts,
                });
              }}
            >
              <option value="">{t.locationPick}</option>
              {hubs.map((hub) => {
                const busy = usedHubs.has(hub.id) && hub.id !== initial.mapHubId;
                const region = MAP_HUB_REGIONS[hub.region ?? ""] ?? hub.region ?? "";
                return (
                  <option key={hub.id} value={hub.id} disabled={busy}>
                    {countryFlag(hub.countryCode)} {mapHubName(hub, lang)}
                    {hub.countryCode ? `, ${countryName(hub.countryCode, lang)}` : ""} · {region}
                    {!hub.isActive ? ` · ${t.locationOff}` : ""}
                    {busy ? ` · ${t.locationBusy}` : ""}
                  </option>
                );
              })}
            </select>
            <span className="block normal-case tracking-normal text-zinc-500">{t.locationHint}</span>
          </label>
          <label className={LABEL}>
            <span>{t.project}</span>
            <select className={INPUT} value={d.project} onChange={(e) => set({ project: e.target.value as Draft["project"] })}>
              {PROJECTS.map((p) => (
                <option key={p} value={p}>
                  {projects[p]}
                </option>
              ))}
            </select>
          </label>
          <label className={LABEL}>
            <span>{t.audience}</span>
            <select className={INPUT} value={d.audience} onChange={(e) => set({ audience: e.target.value as TourAudience })}>
              {(["all", "working", "elite"] as const).map((a) => (
                <option key={a} value={a}>
                  {t.audiences[a]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-300">{t.texts}</p>
          <I18nTextFields
            fields={[
              { key: "title", label: t.tTitle, max: TITLE_MAX, required: true },
              { key: "description", label: t.tDescription, max: TOUR_DESCRIPTION_MAX, multiline: true, rows: 5 },
              { key: "requirements", label: t.tRequirements, max: TOUR_NOTE_MAX, multiline: true, rows: 3 },
              { key: "conditions", label: t.tConditions, max: TOUR_NOTE_MAX, multiline: true, rows: 3 },
            ]}
            values={d.texts}
            onChange={(next) =>
              set({
                texts: {
                  title: next.title ?? {},
                  description: next.description ?? {},
                  requirements: next.requirements ?? {},
                  conditions: next.conditions ?? {},
                },
              })
            }
            source={d.sourceLang}
            onSourceChange={(sourceLang) => set({ sourceLang })}
            disabled={saving}
          />
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-300">{t.defaults}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={LABEL}>
              <span>{t.fee}</span>
              <div className="flex gap-2">
                <input className={`${INPUT} font-mono`} inputMode="decimal" value={d.feeAmount} placeholder={t.feeOpen} onChange={(e) => set({ feeAmount: e.target.value })} />
                <select className={`${INPUT} w-24 font-mono`} value={d.feeCurrency} onChange={(e) => set({ feeCurrency: e.target.value })} aria-label="Currency">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className={LABEL}>
              <span>{t.heightMin}</span>
              <input className={INPUT} inputMode="numeric" value={d.heightMin} onChange={(e) => set({ heightMin: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className={LABEL}>
              <span>{t.flight}</span>
              <select className={INPUT} value={d.flightPaidBy} onChange={(e) => set({ flightPaidBy: e.target.value as TourPayer })}>
                {(["manager", "participant", "split"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t.payer[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              <span>{t.hotel}</span>
              <select className={INPUT} value={d.hotelPaidBy} onChange={(e) => set({ hotelPaidBy: e.target.value as TourPayer })}>
                {(["manager", "participant", "split"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t.payer[p]}
                  </option>
                ))}
              </select>
            </label>
            <div className={`${LABEL} sm:col-span-2`}>
              <span>{t.languages}</span>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGE_CODES.map((code) => {
                  const on = d.languages.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set({ languages: on ? d.languages.filter((x) => x !== code) : d.languages.length < 5 ? [...d.languages, code] : d.languages })
                      }
                      className={`min-h-9 rounded-full border px-3 font-mono text-xs tracking-normal transition ${on ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" className="size-4 accent-amber-200" checked={d.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
            {d.isActive ? <Eye size={14} /> : <EyeOff size={14} />} {t.active}
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
            {t.sort}
            <input className={`${INPUT} w-20`} type="number" value={d.sortOrder} onChange={(e) => set({ sortOrder: Math.trunc(Number(e.target.value) || 0) })} />
          </label>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-sm text-rose-200">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-800 pt-5 sm:flex-row sm:items-center sm:justify-end">
          {d.id && (
            <div className="flex flex-col gap-1 sm:mr-auto">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={saving}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm transition ${confirmDelete ? "border-rose-400/50 bg-rose-500/15 text-rose-100" : "border-rose-400/20 text-rose-300 hover:bg-rose-400/5"}`}
              >
                <Trash2 size={14} /> {t.remove}
              </button>
              {confirmDelete && <span className="max-w-xs text-[11px] text-zinc-500">{t.removeConfirm}</span>}
            </div>
          )}
          <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-zinc-800 px-5 text-sm text-zinc-300 hover:text-white">
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200/40 bg-amber-200 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-100 disabled:opacity-60"
          >
            {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
