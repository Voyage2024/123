"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Globe2,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Power,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { useLanguage } from "@/app/context/LanguageContext";
import { supabase } from "@/lib/supabase";

type Lang = "EN" | "RU" | "ES" | "PT";
type Localized = Record<Lang, string>;
type Rates = {
  split: string;
  shot: string;
  incall: string;
  outcall: string;
};

interface MapHub {
  id: string;
  region: string;
  name: Localized;
  subtitle: Localized;
  description: Localized;
  accommodation: Localized;
  services: Localized;
  rates: Rates;
  x: number;
  y: number;
  is_active: boolean;
}

type RegionFilter = "all" | "mena" | "europe" | "americas" | "apac";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

const LANGS: Lang[] = ["EN", "RU", "ES", "PT"];

const EMPTY_LOCALIZED: Localized = {
  EN: "",
  RU: "",
  ES: "",
  PT: "",
};

const EMPTY_RATES: Rates = {
  split: "",
  shot: "",
  incall: "",
  outcall: "",
};

const EMPTY_FORM: MapHub = {
  id: "",
  region: "mena",
  name: { ...EMPTY_LOCALIZED },
  subtitle: { ...EMPTY_LOCALIZED },
  description: { ...EMPTY_LOCALIZED },
  accommodation: { ...EMPTY_LOCALIZED },
  services: { ...EMPTY_LOCALIZED },
  rates: { ...EMPTY_RATES },
  x: 50,
  y: 50,
  is_active: true,
};

const T: Record<
  Lang,
  {
    title: string;
    subtitle: string;
    add: string;
    all: string;
    mena: string;
    europe: string;
    americas: string;
    apac: string;
    search: string;
    noLocations: string;
    loading: string;
    createLocation: string;
    editLocation: string;
    id: string;
    region: string;
    coordinates: string;
    x: string;
    y: string;
    active: string;
    inactive: string;
    rates: string;
    split: string;
    shot: string;
    incall: string;
    outcall: string;
    content: string;
    name: string;
    subtitleField: string;
    description: string;
    accommodation: string;
    services: string;
    cancel: string;
    save: string;
    create: string;
    delete: string;
    confirmDelete: string;
    saved: string;
    created: string;
    deleted: string;
    saveError: string;
    loadError: string;
    deleteError: string;
    requiredId: string;
    activeLabel: string;
    inactiveLabel: string;
    language: string;
    locationCount: string;
    saving: string;
    deleting: string;
    close: string;
  }
> = {
  EN: {
    title: "Map Locations",
    subtitle: "Manage regional destinations and interactive map points.",
    add: "Add Location",
    all: "All",
    mena: "MENA",
    europe: "Europe",
    americas: "Americas",
    apac: "APAC",
    search: "Search locations...",
    noLocations: "No locations found.",
    loading: "Loading locations...",
    createLocation: "Create Location",
    editLocation: "Edit Location",
    id: "ID",
    region: "Region",
    coordinates: "Coordinates",
    x: "X",
    y: "Y",
    active: "Active",
    inactive: "Inactive",
    rates: "Rates",
    split: "Split",
    shot: "Short Session",
    incall: "Incall",
    outcall: "Outcall",
    content: "Multilingual Content",
    name: "Name",
    subtitleField: "Subtitle",
    description: "Description",
    accommodation: "Accommodation",
    services: "Services",
    cancel: "Cancel",
    save: "Save Changes",
    create: "Create Location",
    delete: "Delete",
    confirmDelete: "Delete this location? This action cannot be undone.",
    saved: "Location updated successfully.",
    created: "Location created successfully.",
    deleted: "Location deleted successfully.",
    saveError: "Unable to save the location.",
    loadError: "Unable to load locations.",
    deleteError: "Unable to delete the location.",
    requiredId: "ID is required.",
    activeLabel: "Active",
    inactiveLabel: "Inactive",
    language: "Language",
    locationCount: "locations",
    saving: "Saving...",
    deleting: "Deleting...",
    close: "Close",
  },
  RU: {
    title: "Локации карты",
    subtitle: "Управление регионами и точками интерактивной карты.",
    add: "Добавить локацию",
    all: "Все",
    mena: "MENA",
    europe: "Европа",
    americas: "Америка",
    apac: "APAC",
    search: "Поиск локаций...",
    noLocations: "Локации не найдены.",
    loading: "Загрузка локаций...",
    createLocation: "Создание локации",
    editLocation: "Редактирование локации",
    id: "ID",
    region: "Регион",
    coordinates: "Координаты",
    x: "X",
    y: "Y",
    active: "Активна",
    inactive: "Неактивна",
    rates: "Тарифы",
    split: "Разделение",
    shot: "Короткая сессия",
    incall: "Incall",
    outcall: "Outcall",
    content: "Мультиязычный контент",
    name: "Название",
    subtitleField: "Подзаголовок",
    description: "Описание",
    accommodation: "Проживание",
    services: "Услуги",
    cancel: "Отмена",
    save: "Сохранить изменения",
    create: "Создать локацию",
    delete: "Удалить",
    confirmDelete: "Удалить эту локацию? Действие нельзя отменить.",
    saved: "Локация успешно обновлена.",
    created: "Локация успешно создана.",
    deleted: "Локация успешно удалена.",
    saveError: "Не удалось сохранить локацию.",
    loadError: "Не удалось загрузить локации.",
    deleteError: "Не удалось удалить локацию.",
    requiredId: "ID обязателен.",
    activeLabel: "Активна",
    inactiveLabel: "Неактивна",
    language: "Язык",
    locationCount: "локаций",
    saving: "Сохранение...",
    deleting: "Удаление...",
    close: "Закрыть",
  },
  ES: {
    title: "Ubicaciones del mapa",
    subtitle: "Gestiona destinos regionales y puntos del mapa interactivo.",
    add: "Añadir ubicación",
    all: "Todas",
    mena: "MENA",
    europe: "Europa",
    americas: "Américas",
    apac: "APAC",
    search: "Buscar ubicaciones...",
    noLocations: "No se encontraron ubicaciones.",
    loading: "Cargando ubicaciones...",
    createLocation: "Crear ubicación",
    editLocation: "Editar ubicación",
    id: "ID",
    region: "Región",
    coordinates: "Coordenadas",
    x: "X",
    y: "Y",
    active: "Activa",
    inactive: "Inactiva",
    rates: "Tarifas",
    split: "División",
    shot: "Sesión corta",
    incall: "Incall",
    outcall: "Outcall",
    content: "Contenido multilingüe",
    name: "Nombre",
    subtitleField: "Subtítulo",
    description: "Descripción",
    accommodation: "Alojamiento",
    services: "Servicios",
    cancel: "Cancelar",
    save: "Guardar cambios",
    create: "Crear ubicación",
    delete: "Eliminar",
    confirmDelete: "¿Eliminar esta ubicación? Esta acción no se puede deshacer.",
    saved: "Ubicación actualizada correctamente.",
    created: "Ubicación creada correctamente.",
    deleted: "Ubicación eliminada correctamente.",
    saveError: "No se pudo guardar la ubicación.",
    loadError: "No se pudieron cargar las ubicaciones.",
    deleteError: "No se pudo eliminar la ubicación.",
    requiredId: "El ID es obligatorio.",
    activeLabel: "Activa",
    inactiveLabel: "Inactiva",
    language: "Idioma",
    locationCount: "ubicaciones",
    saving: "Guardando...",
    deleting: "Eliminando...",
    close: "Cerrar",
  },
  PT: {
    title: "Localizações do mapa",
    subtitle: "Gerencie destinos regionais e pontos do mapa interativo.",
    add: "Adicionar localização",
    all: "Todas",
    mena: "MENA",
    europe: "Europa",
    americas: "Américas",
    apac: "APAC",
    search: "Pesquisar localizações...",
    noLocations: "Nenhuma localização encontrada.",
    loading: "Carregando localizações...",
    createLocation: "Criar localização",
    editLocation: "Editar localização",
    id: "ID",
    region: "Região",
    coordinates: "Coordenadas",
    x: "X",
    y: "Y",
    active: "Ativa",
    inactive: "Inativa",
    rates: "Tarifas",
    split: "Divisão",
    shot: "Sessão curta",
    incall: "Incall",
    outcall: "Outcall",
    content: "Conteúdo multilíngue",
    name: "Nome",
    subtitleField: "Subtítulo",
    description: "Descrição",
    accommodation: "Alojamento",
    services: "Serviços",
    cancel: "Cancelar",
    save: "Salvar alterações",
    create: "Criar localização",
    delete: "Excluir",
    confirmDelete: "Excluir esta localização? Esta ação não pode ser desfeita.",
    saved: "Localização atualizada com sucesso.",
    created: "Localização criada com sucesso.",
    deleted: "Localização excluída com sucesso.",
    saveError: "Não foi possível salvar a localização.",
    loadError: "Não foi possível carregar as localizações.",
    deleteError: "Não foi possível excluir a localização.",
    requiredId: "O ID é obrigatório.",
    activeLabel: "Ativa",
    inactiveLabel: "Inativa",
    language: "Idioma",
    locationCount: "localizações",
    saving: "Salvando...",
    deleting: "Excluindo...",
    close: "Fechar",
  },
};

const REGION_OPTIONS = [
  { value: "mena", labelKey: "mena" },
  { value: "europe", labelKey: "europe" },
  { value: "americas", labelKey: "americas" },
  { value: "apac", labelKey: "apac" },
] as const;

function createEmptyForm(): MapHub {
  return {
    id: "",
    region: "mena",
    name: { ...EMPTY_LOCALIZED },
    subtitle: { ...EMPTY_LOCALIZED },
    description: { ...EMPTY_LOCALIZED },
    accommodation: { ...EMPTY_LOCALIZED },
    services: { ...EMPTY_LOCALIZED },
    rates: { ...EMPTY_RATES },
    x: 50,
    y: 50,
    is_active: true,
  };
}

function normalizeHub(value: unknown): MapHub {
  const row = value as Partial<MapHub> & {
    name?: Partial<Localized>;
    subtitle?: Partial<Localized>;
    description?: Partial<Localized>;
    accommodation?: Partial<Localized>;
    services?: Partial<Localized>;
    rates?: Partial<Rates>;
  };

  return {
    id: String(row.id ?? ""),
    region: String(row.region ?? "mena"),
    name: {
      EN: String(row.name?.EN ?? ""),
      RU: String(row.name?.RU ?? ""),
      ES: String(row.name?.ES ?? ""),
      PT: String(row.name?.PT ?? ""),
    },
    subtitle: {
      EN: String(row.subtitle?.EN ?? ""),
      RU: String(row.subtitle?.RU ?? ""),
      ES: String(row.subtitle?.ES ?? ""),
      PT: String(row.subtitle?.PT ?? ""),
    },
    description: {
      EN: String(row.description?.EN ?? ""),
      RU: String(row.description?.RU ?? ""),
      ES: String(row.description?.ES ?? ""),
      PT: String(row.description?.PT ?? ""),
    },
    accommodation: {
      EN: String(row.accommodation?.EN ?? ""),
      RU: String(row.accommodation?.RU ?? ""),
      ES: String(row.accommodation?.ES ?? ""),
      PT: String(row.accommodation?.PT ?? ""),
    },
    services: {
      EN: String(row.services?.EN ?? ""),
      RU: String(row.services?.RU ?? ""),
      ES: String(row.services?.ES ?? ""),
      PT: String(row.services?.PT ?? ""),
    },
    rates: {
      split: String(row.rates?.split ?? ""),
      shot: String(row.rates?.shot ?? ""),
      incall: String(row.rates?.incall ?? ""),
      outcall: String(row.rates?.outcall ?? ""),
    },
    x: Number(row.x ?? 50),
    y: Number(row.y ?? 50),
    is_active: Boolean(row.is_active ?? true),
  };
}

export default function MapLocationsPage() {
  const { lang: rawLang } = useLanguage();

  const normalizeLang = (l: any): Lang => {
    const v = String(l || "").toUpperCase();
    return (["EN", "RU", "ES", "PT"].includes(v) ? v : "EN") as Lang;
  };

  const lang = normalizeLang(rawLang);
  const t = T[lang];

  const [hubs, setHubs] = useState<MapHub[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [regionFilter, setRegionFilter] =
    useState<RegionFilter>("all");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>("EN");
  const [form, setForm] = useState<MapHub>(createEmptyForm());

  const [toast, setToast] = useState<ToastState>(null);

  const filteredHubs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return hubs.filter((hub) => {
      const regionMatch =
        regionFilter === "all" ||
        hub.region.toLowerCase() === regionFilter;

      if (!regionMatch) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        hub.id,
        hub.region,
        hub.name.EN,
        hub.name.RU,
        hub.name.ES,
        hub.name.PT,
        hub.subtitle.EN,
        hub.subtitle.RU,
        hub.subtitle.ES,
        hub.subtitle.PT,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [hubs, regionFilter, search]);

  const showToast = (
    type: "success" | "error",
    message: string
  ) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const loadHubs = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("map_hubs")
      .select("*")
      .order("region", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      console.error("map_hubs load error:", error);
      showToast("error", t.loadError);
      setHubs([]);
      setLoading(false);
      return;
    }

    setHubs((data ?? []).map(normalizeHub));
    setLoading(false);
  };

  useEffect(() => {
    void loadHubs();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(createEmptyForm());
    setActiveLang("EN");
    setModalOpen(true);
  };

  const openEditModal = (hub: MapHub) => {
    setEditingId(hub.id);
    setForm({
      ...hub,
      name: { ...hub.name },
      subtitle: { ...hub.subtitle },
      description: { ...hub.description },
      accommodation: { ...hub.accommodation },
      services: { ...hub.services },
      rates: { ...hub.rates },
    });
    setActiveLang("EN");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingId(null);
    setForm(createEmptyForm());
    setActiveLang("EN");
  };

  const updateLocalized = (
    field:
      | "name"
      | "subtitle"
      | "description"
      | "accommodation"
      | "services",
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: {
        ...current[field],
        [activeLang]: value,
      },
    }));
  };

  const updateRates = (
    field: keyof Rates,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      rates: {
        ...current.rates,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    const id = form.id.trim();

    if (!id) {
      showToast("error", t.requiredId);
      return;
    }

    const payload = {
      id,
      region: form.region,
      name: form.name,
      subtitle: form.subtitle,
      description: form.description,
      accommodation: form.accommodation,
      services: form.services,
      rates: form.rates,
      x: Number(form.x),
      y: Number(form.y),
      is_active: form.is_active,
    };

    setSaving(true);

    if (editingId) {
      const { data, error } = await supabase
        .from("map_hubs")
        .update({
          region: payload.region,
          name: payload.name,
          subtitle: payload.subtitle,
          description: payload.description,
          accommodation: payload.accommodation,
          services: payload.services,
          rates: payload.rates,
          x: payload.x,
          y: payload.y,
          is_active: payload.is_active,
        })
        .eq("id", editingId)
        .select("*")
        .single();

      if (error) {
        console.error("map_hubs update error:", error);
        showToast("error", t.saveError);
        setSaving(false);
        return;
      }

      const normalized = normalizeHub(data);

      setHubs((current) =>
        current.map((hub) =>
          hub.id === editingId ? normalized : hub
        )
      );

      showToast("success", t.saved);
      setSaving(false);
      setModalOpen(false);
      setEditingId(null);
      setForm(createEmptyForm());
      return;
    }

    const { data, error } = await supabase
      .from("map_hubs")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("map_hubs insert error:", error);
      showToast("error", t.saveError);
      setSaving(false);
      return;
    }

    setHubs((current) => [
      ...current,
      normalizeHub(data),
    ]);

    showToast("success", t.created);
    setSaving(false);
    setModalOpen(false);
    setEditingId(null);
    setForm(createEmptyForm());
  };

  const handleDelete = async (hub: MapHub) => {
    const confirmed = window.confirm(
      `${hub.name[lang] || hub.id}\n\n${t.confirmDelete}`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(hub.id);

    const { error } = await supabase
      .from("map_hubs")
      .delete()
      .eq("id", hub.id);

    if (error) {
      console.error("map_hubs delete error:", error);
      showToast("error", t.deleteError);
      setDeletingId(null);
      return;
    }

    setHubs((current) =>
      current.filter((item) => item.id !== hub.id)
    );

    if (editingId === hub.id) {
      closeModal();
    }

    showToast("success", t.deleted);
    setDeletingId(null);
  };

  const getRegionLabel = (region: string) => {
    switch (region) {
      case "mena":
        return t.mena;
      case "europe":
        return t.europe;
      case "americas":
        return t.americas;
      case "apac":
        return t.apac;
      default:
        return region.toUpperCase();
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/60">
              <MapPin className="h-3.5 w-3.5" />
              Voyage Admin
            </div>

            <h1 className="font-serif text-4xl font-light tracking-tight text-zinc-100 sm:text-5xl">
              {t.title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-zinc-500">
              {t.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/20 bg-amber-200 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-950 transition-all duration-300 hover:bg-amber-100 hover:shadow-[0_0_35px_rgba(251,191,36,0.12)]"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-3 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["all", t.all],
                  ["mena", t.mena],
                  ["europe", t.europe],
                  ["americas", t.americas],
                  ["apac", t.apac],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setRegionFilter(value)
                  }
                  className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] transition-all duration-200 ${
                    regionFilter === value
                      ? "bg-amber-200 text-zinc-950"
                      : "text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder={t.search}
                className="w-full rounded-xl border border-zinc-800/70 bg-zinc-950/70 py-2.5 pl-10 pr-4 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-700 focus:border-amber-200/30"
              />
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Globe2 className="h-4 w-4" />
            {filteredHubs.length} {t.locationCount}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-900/20">
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.loading}
            </div>
          </div>
        ) : filteredHubs.length === 0 ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-zinc-800/60 bg-zinc-900/20">
            <div className="text-center">
              <MapPin className="mx-auto mb-4 h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">
                {t.noLocations}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredHubs.map((hub) => (
              <div
                key={hub.id}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-5 backdrop-blur-xl transition-all duration-300 hover:border-amber-200/20 hover:bg-zinc-900/50"
              >
                <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-amber-400/5 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

                <div className="relative">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.15em] text-zinc-600">
                          {hub.id}
                        </span>

                        <span className="rounded-full border border-amber-200/10 bg-amber-200/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-amber-200/70">
                          {getRegionLabel(hub.region)}
                        </span>
                      </div>

                      <h2 className="font-serif text-2xl font-light text-zinc-100">
                        {hub.name[lang] ||
                          hub.name.EN ||
                          hub.id}
                      </h2>

                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                        {hub.subtitle[lang] ||
                          hub.subtitle.EN}
                      </p>
                    </div>

                    <div
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] ${
                        hub.is_active
                          ? "border-emerald-200/10 bg-emerald-200/5 text-emerald-200/70"
                          : "border-zinc-800 bg-zinc-950 text-zinc-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          hub.is_active
                            ? "bg-emerald-300"
                            : "bg-zinc-600"
                        }`}
                      />
                      {hub.is_active
                        ? t.active
                        : t.inactive}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.15em] text-zinc-700">
                        {t.x}
                      </p>
                      <p className="font-mono text-sm text-zinc-300">
                        {hub.x}
                      </p>
                    </div>

                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-3">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.15em] text-zinc-700">
                        {t.y}
                      </p>
                      <p className="font-mono text-sm text-zinc-300">
                        {hub.y}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 border-t border-zinc-800/50 pt-4">
                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(hub)
                      }
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 transition-all duration-200 hover:border-amber-200/20 hover:text-amber-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t.editLocation}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleDelete(hub)
                      }
                      disabled={
                        deletingId === hub.id
                      }
                      aria-label={t.delete}
                      className="inline-flex items-center justify-center rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-2.5 text-zinc-600 transition-all duration-200 hover:border-red-300/20 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
                    >
                      {deletingId === hub.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] w-[calc(100vw-2rem)] max-w-sm">
          <div
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl ${
              toast.type === "success"
                ? "border-amber-200/20 bg-zinc-900/95"
                : "border-red-300/10 bg-zinc-900/95"
            }`}
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                toast.type === "success"
                  ? "bg-amber-200/10 text-amber-200"
                  : "bg-red-300/10 text-red-300"
              }`}
            >
              {toast.type === "success" ? (
                <Check className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </div>

            <p className="pr-2 text-xs leading-relaxed text-zinc-300">
              {toast.message}
            </p>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800/70 px-6 py-5 sm:px-8">
              <div>
                <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-amber-200/60">
                  Voyage Admin
                </div>

                <h2 className="font-serif text-3xl font-light text-zinc-100">
                  {editingId
                    ? t.editLocation
                    : t.createLocation}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label={t.close}
                className="rounded-full border border-zinc-800 bg-zinc-900/60 p-2.5 text-zinc-500 transition-colors hover:border-amber-200/20 hover:text-amber-200 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {t.id}
                    </label>

                    <input
                      type="text"
                      value={form.id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          id: event.target.value
                            .toLowerCase()
                            .replace(/\s+/g, "_"),
                        }))
                      }
                      disabled={Boolean(
                        editingId
                      )}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200 outline-none transition-all focus:border-amber-200/30 disabled:cursor-not-allowed disabled:bg-zinc-900/20 disabled:text-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      {t.region}
                    </label>

                    <div className="relative">
                      <select
                        value={form.region}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            region:
                              event.target.value,
                          }))
                        }
                        className="w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200 outline-none transition-all focus:border-amber-200/30"
                      >
                        {REGION_OPTIONS.map(
                          (option) => (
                            <option
                              key={option.value}
                              value={
                                option.value
                              }
                              className="bg-zinc-950"
                            >
                              {t[
                                option.labelKey
                              ]}
                            </option>
                          )
                        )}
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t.coordinates}
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-[9px] uppercase tracking-[0.15em] text-zinc-700">
                          {t.x}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={form.x}
                          onChange={(event) =>
                            setForm(
                              (current) => ({
                                ...current,
                                x: Number(
                                  event.target
                                    .value
                                ),
                              })
                            )
                          }
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 font-mono text-sm text-zinc-200 outline-none transition-all focus:border-amber-200/30"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[9px] uppercase tracking-[0.15em] text-zinc-700">
                          {t.y}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={form.y}
                          onChange={(event) =>
                            setForm(
                              (current) => ({
                                ...current,
                                y: Number(
                                  event.target
                                    .value
                                ),
                              })
                            )
                          }
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 font-mono text-sm text-zinc-200 outline-none transition-all focus:border-amber-200/30"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                          <Power className="h-4 w-4 text-amber-200/70" />
                          {form.is_active
                            ? t.activeLabel
                            : t.inactiveLabel}
                        </div>

                        <p className="mt-1 text-[10px] text-zinc-600">
                          {form.is_active
                            ? t.active
                            : t.inactive}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setForm(
                            (current) => ({
                              ...current,
                              is_active:
                                !current.is_active,
                            })
                          )
                        }
                        aria-pressed={
                          form.is_active
                        }
                        className={`relative h-7 w-12 rounded-full border transition-all duration-300 ${
                          form.is_active
                            ? "border-amber-200/30 bg-amber-200/20"
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                      >
                        <span
                          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-300 ${
                            form.is_active
                              ? "left-6 bg-amber-200"
                              : "left-1 bg-zinc-600"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/70">
                      {t.rates}
                    </div>

                    <div className="space-y-3">
                      {(
                        [
                          ["split", t.split],
                          ["shot", t.shot],
                          ["incall", t.incall],
                          ["outcall", t.outcall],
                        ] as const
                      ).map(
                        ([field, label]) => (
                          <div
                            key={field}
                          >
                            <label className="mb-1.5 block text-[9px] uppercase tracking-[0.15em] text-zinc-700">
                              {label}
                            </label>

                            <input
                              type="text"
                              value={
                                form.rates[
                                  field
                                ]
                              }
                              onChange={(
                                event
                              ) =>
                                updateRates(
                                  field,
                                  event.target
                                    .value
                                )
                              }
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200 outline-none transition-all focus:border-amber-200/30"
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                    <Globe2 className="h-4 w-4" />
                    {t.content}
                  </div>

                  <div className="mb-6 flex flex-wrap gap-2">
                    {LANGS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() =>
                          setActiveLang(
                            item
                          )
                        }
                        className={`min-w-[64px] rounded-full px-4 py-2.5 text-[10px] font-semibold tracking-[0.18em] transition-all duration-200 ${
                          activeLang ===
                          item
                            ? "bg-amber-200 text-zinc-950 shadow-[0_0_25px_rgba(251,191,36,0.08)]"
                            : "border border-zinc-800 bg-zinc-900/40 text-zinc-600 hover:border-amber-200/20 hover:text-zinc-300"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t.name} ·{" "}
                        {activeLang}
                      </label>

                      <input
                        type="text"
                        value={
                          form.name[
                            activeLang
                          ]
                        }
                        onChange={(event) =>
                          updateLocalized(
                            "name",
                            event.target.value
                          )
                        }
                        placeholder={`${t.name} (${activeLang})`}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-700 focus:border-amber-200/30"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t.subtitleField} ·{" "}
                        {activeLang}
                      </label>

                      <input
                        type="text"
                        value={
                          form.subtitle[
                            activeLang
                          ]
                        }
                        onChange={(event) =>
                          updateLocalized(
                            "subtitle",
                            event.target.value
                          )
                        }
                        placeholder={`${t.subtitleField} (${activeLang})`}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200 outline-none transition-all placeholder:text-zinc-700 focus:border-amber-200/30"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t.description} ·{" "}
                        {activeLang}
                      </label>

                      <textarea
                        rows={6}
                        value={
                          form.description[
                            activeLang
                          ]
                        }
                        onChange={(event) =>
                          updateLocalized(
                            "description",
                            event.target.value
                          )
                        }
                        placeholder={`${t.description} (${activeLang})`}
                        className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none transition-all placeholder:text-zinc-700 focus:border-amber-200/30"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t.accommodation} ·{" "}
                        {activeLang}
                      </label>

                      <textarea
                        rows={5}
                        value={
                          form
                            .accommodation[
                            activeLang
                          ]
                        }
                        onChange={(event) =>
                          updateLocalized(
                            "accommodation",
                            event.target.value
                          )
                        }
                        placeholder={`${t.accommodation} (${activeLang})`}
                        className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none transition-all placeholder:text-zinc-700 focus:border-amber-200/30"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        {t.services} ·{" "}
                        {activeLang}
                      </label>

                      <textarea
                        rows={5}
                        value={
                          form.services[
                            activeLang
                          ]
                        }
                        onChange={(event) =>
                          updateLocalized(
                            "services",
                            event.target.value
                          )
                        }
                        placeholder={`${t.services} (${activeLang})`}
                        className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none transition-all placeholder:text-zinc-700 focus:border-amber-200/30"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-zinc-800/70 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-all hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
              >
                {t.cancel}
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleSave()
                }
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-950 transition-all hover:bg-amber-100 hover:shadow-[0_0_30px_rgba(251,191,36,0.1)] disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.saving}
                  </>
                ) : (
                  <>
                    {editingId ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {editingId
                      ? t.save
                      : t.create}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}