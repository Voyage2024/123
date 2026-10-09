'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cormorant_Garamond } from 'next/font/google';
import {
  GlassWater,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  MapPin,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/context/LanguageContext';

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Lang = 'en' | 'ru' | 'es' | 'pt';

type GlobalEvent = {
  id: string;
  title: string;
  region: string;
  description: string | null;
  conditions: string | null;
  is_active: boolean;
  created_at: string;
};

type FormState = {
  title: string;
  region: string;
  description: string;
  conditions: string;
  is_active: boolean;
};

type Toast = { type: 'success' | 'error'; message: string } | null;

type StatusFilter = 'all' | 'active' | 'inactive';

const EMPTY_FORM: FormState = {
  title: '',
  region: '',
  description: '',
  conditions: '',
  is_active: true,
};

/* ------------------------------------------------------------------ */
/* i18n                                                                */
/* ------------------------------------------------------------------ */

const T = {
  en: {
    pageTitle: 'Parties / Themes',
    pageSubtitle: 'Manage single events and thematic parties',
    addButton: 'Add party',
    searchPlaceholder: 'Search by title or region…',
    filterAll: 'All',
    filterActive: 'Active',
    filterInactive: 'Hidden',
    total: 'Total',
    loading: 'Loading…',
    emptyTitle: 'No parties yet',
    emptyText: 'Add the first party or theme.',
    noResults: 'Nothing found for your search.',
    statusActive: 'Active',
    statusInactive: 'Hidden',
    createdAt: 'Created',
    conditionsLabel: 'Conditions & details',
    noDescription: 'No description',
    edit: 'Edit',
    delete: 'Delete',
    show: 'Show',
    hide: 'Hide',
    modalCreateTitle: 'New party',
    modalEditTitle: 'Edit party',
    fieldTitle: 'Title',
    fieldRegion: 'Region',
    fieldDescription: 'Description',
    fieldConditions: 'Conditions / details',
    fieldActive: 'Visible to residents',
    phTitle: 'e.g. Yacht party in Sanya',
    phRegion: 'e.g. Asia',
    phDescription: 'Short description of the party…',
    phConditions: 'Dates, fees, accommodation, requirements, contract terms…',
    required: 'Required field',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create',
    saving: 'Saving…',
    confirmDelete: 'Delete this party? This action cannot be undone.',
    successCreate: 'Party created',
    successUpdate: 'Changes saved',
    successDelete: 'Party deleted',
    successShow: 'Party is now visible',
    successHide: 'Party is now hidden',
    errorLoad: 'Failed to load parties',
    errorSave: 'Failed to save party',
    errorDelete: 'Failed to delete party',
    errorToggle: 'Failed to change visibility',
    errorPermission: 'You do not have permission for this action',
    close: 'Close',
  },
  ru: {
    pageTitle: 'Тусовки / Темы',
    pageSubtitle: 'Управление разовыми мероприятиями и тематическими тусовками',
    addButton: 'Добавить тусовку',
    searchPlaceholder: 'Поиск по названию или региону…',
    filterAll: 'Все',
    filterActive: 'Активные',
    filterInactive: 'Скрытые',
    total: 'Всего',
    loading: 'Загрузка…',
    emptyTitle: 'Тусовок пока нет',
    emptyText: 'Добавьте первую тусовку или тему.',
    noResults: 'По вашему запросу ничего не найдено.',
    statusActive: 'Активна',
    statusInactive: 'Скрыта',
    createdAt: 'Создано',
    conditionsLabel: 'Условия и детали',
    noDescription: 'Без описания',
    edit: 'Редактировать',
    delete: 'Удалить',
    show: 'Показать',
    hide: 'Скрыть',
    modalCreateTitle: 'Новая тусовка',
    modalEditTitle: 'Редактирование тусовки',
    fieldTitle: 'Название',
    fieldRegion: 'Регион',
    fieldDescription: 'Описание',
    fieldConditions: 'Условия / детали',
    fieldActive: 'Видна резидентам',
    phTitle: 'Например: Яхты в Санье',
    phRegion: 'Например: Азия',
    phDescription: 'Краткое описание тусовки…',
    phConditions: 'Даты, оплата, проживание, требования, условия контракта…',
    required: 'Обязательное поле',
    cancel: 'Отмена',
    save: 'Сохранить',
    create: 'Создать',
    saving: 'Сохранение…',
    confirmDelete: 'Удалить эту тусовку? Действие нельзя отменить.',
    successCreate: 'Тусовка создана',
    successUpdate: 'Изменения сохранены',
    successDelete: 'Тусовка удалена',
    successShow: 'Тусовка теперь видна',
    successHide: 'Тусовка скрыта',
    errorLoad: 'Не удалось загрузить тусовки',
    errorSave: 'Не удалось сохранить тусовку',
    errorDelete: 'Не удалось удалить тусовку',
    errorToggle: 'Не удалось изменить видимость',
    errorPermission: 'Недостаточно прав для этого действия',
    close: 'Закрыть',
  },
  es: {
    pageTitle: 'Fiestas / Temas',
    pageSubtitle: 'Gestiona eventos individuales y fiestas temáticas',
    addButton: 'Añadir fiesta',
    searchPlaceholder: 'Buscar por título o región…',
    filterAll: 'Todas',
    filterActive: 'Activas',
    filterInactive: 'Ocultas',
    total: 'Total',
    loading: 'Cargando…',
    emptyTitle: 'Aún no hay fiestas',
    emptyText: 'Añade la primera fiesta o tema.',
    noResults: 'No se encontró nada para tu búsqueda.',
    statusActive: 'Activa',
    statusInactive: 'Oculta',
    createdAt: 'Creado',
    conditionsLabel: 'Condiciones y detalles',
    noDescription: 'Sin descripción',
    edit: 'Editar',
    delete: 'Eliminar',
    show: 'Mostrar',
    hide: 'Ocultar',
    modalCreateTitle: 'Nueva fiesta',
    modalEditTitle: 'Editar fiesta',
    fieldTitle: 'Título',
    fieldRegion: 'Región',
    fieldDescription: 'Descripción',
    fieldConditions: 'Condiciones / detalles',
    fieldActive: 'Visible para residentes',
    phTitle: 'p. ej. Yates en Sanya',
    phRegion: 'p. ej. Asia',
    phDescription: 'Breve descripción de la fiesta…',
    phConditions: 'Fechas, pagos, alojamiento, requisitos, condiciones del contrato…',
    required: 'Campo obligatorio',
    cancel: 'Cancelar',
    save: 'Guardar',
    create: 'Crear',
    saving: 'Guardando…',
    confirmDelete: '¿Eliminar esta fiesta? Esta acción no se puede deshacer.',
    successCreate: 'Fiesta creada',
    successUpdate: 'Cambios guardados',
    successDelete: 'Fiesta eliminada',
    successShow: 'La fiesta ahora es visible',
    successHide: 'La fiesta ahora está oculta',
    errorLoad: 'No se pudieron cargar las fiestas',
    errorSave: 'No se pudo guardar la fiesta',
    errorDelete: 'No se pudo eliminar la fiesta',
    errorToggle: 'No se pudo cambiar la visibilidad',
    errorPermission: 'No tienes permiso para esta acción',
    close: 'Cerrar',
  },
  pt: {
    pageTitle: 'Festas / Temas',
    pageSubtitle: 'Gerencie eventos individuais e festas temáticas',
    addButton: 'Adicionar festa',
    searchPlaceholder: 'Buscar por título ou região…',
    filterAll: 'Todas',
    filterActive: 'Ativas',
    filterInactive: 'Ocultas',
    total: 'Total',
    loading: 'Carregando…',
    emptyTitle: 'Ainda não há festas',
    emptyText: 'Adicione a primeira festa ou tema.',
    noResults: 'Nada encontrado para sua busca.',
    statusActive: 'Ativo',
    statusInactive: 'Oculto',
    createdAt: 'Criado',
    conditionsLabel: 'Condições e detalhes',
    noDescription: 'Sem descrição',
    edit: 'Editar',
    delete: 'Excluir',
    show: 'Mostrar',
    hide: 'Ocultar',
    modalCreateTitle: 'Nova festa',
    modalEditTitle: 'Editar festa',
    fieldTitle: 'Título',
    fieldRegion: 'Região',
    fieldDescription: 'Descrição',
    fieldConditions: 'Condições / detalhes',
    fieldActive: 'Visível para residentes',
    phTitle: 'ex.: Iates em Sanya',
    phRegion: 'ex.: Ásia',
    phDescription: 'Breve descrição da festa…',
    phConditions: 'Datas, pagamentos, hospedagem, requisitos, termos do contrato…',
    required: 'Campo obrigatório',
    cancel: 'Cancelar',
    save: 'Salvar',
    create: 'Criar',
    saving: 'Salvando…',
    confirmDelete: 'Excluir esta festa? Esta ação não pode ser desfeita.',
    successCreate: 'Festa criada',
    successUpdate: 'Alterações salvas',
    successDelete: 'Festa excluída',
    successShow: 'A festa agora está visível',
    successHide: 'A festa agora está oculta',
    errorLoad: 'Não foi possível carregar as festas',
    errorSave: 'Não foi possível salvar a festa',
    errorDelete: 'Não foi possível excluir a festa',
    errorToggle: 'Não foi possível alterar a visibilidade',
    errorPermission: 'Você não tem permissão para esta ação',
    close: 'Fechar',
  },
} as const;

const LOCALES: Record<Lang, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  pt: 'pt-BR',
};

function normalizeLang(value: unknown): Lang {
  const v = String(value ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (v === 'ru' || v === 'es' || v === 'pt') return v;
  return 'en';
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PartiesAdminPage() {
  const { lang: rawLang } = useLanguage();
  const lang = normalizeLang(rawLang);
  const t = T[lang];

  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ title?: boolean; region?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast>(null);

  /* ---------- helpers ---------- */

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const errorMessage = useCallback(
    (fallback: string, err: { code?: string; message?: string } | null) => {
      // 42501 = insufficient_privilege (RLS)
      if (err?.code === '42501' || /row-level security/i.test(err?.message ?? '')) {
        return t.errorPermission;
      }
      return fallback;
    },
    [t],
  );

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(LOCALES[lang], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  /* ---------- load ---------- */

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('global_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      showToast('error', t.errorLoad);
    } else {
      setEvents((data as GlobalEvent[]) ?? []);
    }
    setLoading(false);
  }, [showToast, t]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  /* ---------- filtering ---------- */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (statusFilter === 'active' && !e.is_active) return false;
      if (statusFilter === 'inactive' && e.is_active) return false;
      if (!q) return true;
      return e.title.toLowerCase().includes(q) || e.region.toLowerCase().includes(q);
    });
  }, [events, search, statusFilter]);

  /* ---------- modal ---------- */

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (ev: GlobalEvent) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      region: ev.region,
      description: ev.description ?? '',
      conditions: ev.conditions ?? '',
      is_active: ev.is_active,
    });
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, saving]);

  /* ---------- CRUD ---------- */

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const title = form.title.trim();
    const region = form.region.trim();
    const nextErrors = { title: !title, region: !region };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.region) return;

    setSaving(true);
    const payload = {
      title,
      region,
      description: form.description.trim() || null,
      conditions: form.conditions.trim() || null,
      is_active: form.is_active,
    };

    if (editingId) {
      const { data, error } = await supabase
        .from('global_events')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();

      if (error || !data) {
        console.error(error);
        showToast('error', errorMessage(t.errorSave, error));
      } else {
        setEvents((prev) => prev.map((x) => (x.id === editingId ? (data as GlobalEvent) : x)));
        showToast('success', t.successUpdate);
        setModalOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from('global_events')
        .insert(payload)
        .select()
        .single();

      if (error || !data) {
        console.error(error);
        showToast('error', errorMessage(t.errorSave, error));
      } else {
        setEvents((prev) => [data as GlobalEvent, ...prev]);
        showToast('success', t.successCreate);
        setModalOpen(false);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (ev: GlobalEvent) => {
    if (!window.confirm(t.confirmDelete)) return;
    setBusyId(ev.id);

    const { data, error } = await supabase
      .from('global_events')
      .delete()
      .eq('id', ev.id)
      .select('id');

    if (error || !data || data.length === 0) {
      console.error(error);
      showToast('error', error ? errorMessage(t.errorDelete, error) : t.errorPermission);
    } else {
      setEvents((prev) => prev.filter((x) => x.id !== ev.id));
      showToast('success', t.successDelete);
    }
    setBusyId(null);
  };

  const handleToggle = async (ev: GlobalEvent) => {
    setBusyId(ev.id);
    const next = !ev.is_active;

    const { data, error } = await supabase
      .from('global_events')
      .update({ is_active: next })
      .eq('id', ev.id)
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      showToast('error', errorMessage(t.errorToggle, error));
    } else {
      setEvents((prev) => prev.map((x) => (x.id === ev.id ? (data as GlobalEvent) : x)));
      showToast('success', next ? t.successShow : t.successHide);
    }
    setBusyId(null);
  };

  /* ---------- render ---------- */

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'active', label: t.filterActive },
    { key: 'inactive', label: t.filterInactive },
  ];

  const inputBase =
    'w-full rounded-xl border bg-black/40 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition focus:border-amber-200/60 focus:ring-1 focus:ring-amber-200/30';

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-200 sm:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-full border border-amber-200/30 bg-amber-200/10 p-2">
                <GlassWater className="h-5 w-5 text-amber-200" />
              </div>
              <h1 className={`${cormorant.className} text-4xl font-semibold tracking-wide text-amber-200`}>
                {t.pageTitle}
              </h1>
            </div>
            <p className="text-sm text-neutral-400">{t.pageSubtitle}</p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-200 px-5 py-3 text-sm font-medium text-neutral-950 transition hover:bg-amber-100 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t.addButton}
          </button>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className={`${inputBase} border-neutral-800 pl-11`}
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-neutral-800 bg-black/40 p-1">
            {filterButtons.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                  statusFilter === f.key
                    ? 'bg-amber-200/15 text-amber-200'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-neutral-500 sm:pl-2">
            {t.total}: <span className="text-amber-200">{filtered.length}</span>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin text-amber-200" />
            {t.loading}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-800 py-20 text-center">
            <GlassWater className="mx-auto mb-4 h-10 w-10 text-amber-200/40" />
            <h3 className={`${cormorant.className} text-2xl text-neutral-200`}>{t.emptyTitle}</h3>
            <p className="mt-2 text-sm text-neutral-500">{t.emptyText}</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-200/40 px-5 py-2.5 text-sm text-amber-200 transition hover:bg-amber-200/10"
            >
              <Plus className="h-4 w-4" />
              {t.addButton}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-neutral-500">{t.noResults}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((ev) => (
              <article
                key={ev.id}
                className={`group flex flex-col rounded-2xl border bg-gradient-to-b from-neutral-900 to-neutral-950 p-5 transition ${
                  ev.is_active
                    ? 'border-neutral-800 hover:border-amber-200/30'
                    : 'border-neutral-900 opacity-60 hover:opacity-90'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={`${cormorant.className} truncate text-2xl font-semibold text-neutral-100`}>
                      {ev.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-amber-200/80">
                      <MapPin className="h-3.5 w-3.5" />
                      {ev.region}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
                      ev.is_active
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                        : 'border-neutral-700 bg-neutral-800/50 text-neutral-400'
                    }`}
                  >
                    {ev.is_active ? t.statusActive : t.statusInactive}
                  </span>
                </div>

                <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-neutral-400">
                  {ev.description || <span className="italic text-neutral-600">{t.noDescription}</span>}
                </p>

                {ev.conditions && (
                  <div className="mb-4 rounded-xl border border-amber-200/10 bg-amber-200/[0.03] p-3">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-amber-200/70">
                      {t.conditionsLabel}
                    </div>
                    <p className="line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-neutral-300">
                      {ev.conditions}
                    </p>
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-neutral-800/80 pt-4">
                  <span className="text-xs text-neutral-600">
                    {t.createdAt}: {formatDate(ev.created_at)}
                  </span>

                  <div className="flex items-center gap-1">
                    {busyId === ev.id ? (
                      <Loader2 className="m-2 h-4 w-4 animate-spin text-amber-200" />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggle(ev)}
                          title={ev.is_active ? t.hide : t.show}
                          aria-label={ev.is_active ? t.hide : t.show}
                          className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-amber-200"
                        >
                          {ev.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(ev)}
                          title={t.edit}
                          aria-label={t.edit}
                          className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-amber-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ev)}
                          title={t.delete}
                          aria-label={t.delete}
                          className="rounded-lg p-2 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={handleSave}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-amber-200/20 bg-neutral-950 shadow-2xl shadow-black sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
              <h2 className={`${cormorant.className} text-2xl font-semibold text-amber-200`}>
                {editingId ? t.modalEditTitle : t.modalCreateTitle}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label={t.close}
                className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400">
                    {t.fieldTitle} <span className="text-amber-200">*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, title: e.target.value }));
                      if (errors.title) setErrors((x) => ({ ...x, title: false }));
                    }}
                    placeholder={t.phTitle}
                    className={`${inputBase} ${errors.title ? 'border-red-500/60' : 'border-neutral-800'}`}
                    autoFocus
                  />
                  {errors.title && <p className="mt-1 text-xs text-red-400">{t.required}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400">
                    {t.fieldRegion} <span className="text-amber-200">*</span>
                  </label>
                  <input
                    value={form.region}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, region: e.target.value }));
                      if (errors.region) setErrors((x) => ({ ...x, region: false }));
                    }}
                    placeholder={t.phRegion}
                    className={`${inputBase} ${errors.region ? 'border-red-500/60' : 'border-neutral-800'}`}
                  />
                  {errors.region && <p className="mt-1 text-xs text-red-400">{t.required}</p>}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400">
                  {t.fieldDescription}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t.phDescription}
                  rows={3}
                  className={`${inputBase} resize-y border-neutral-800`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-neutral-400">
                  {t.fieldConditions}
                </label>
                <textarea
                  value={form.conditions}
                  onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                  placeholder={t.phConditions}
                  rows={7}
                  className={`${inputBase} resize-y border-neutral-800 font-mono text-[13px] leading-relaxed`}
                />
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-800 bg-black/30 px-4 py-3">
                <span className="text-sm text-neutral-300">{t.fieldActive}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative h-6 w-11 rounded-full transition ${
                    form.is_active ? 'bg-amber-200' : 'bg-neutral-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-neutral-950 transition-all ${
                      form.is_active ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-800 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl px-5 py-2.5 text-sm text-neutral-400 transition hover:text-neutral-200 disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-200 px-5 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-amber-100 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? t.saving : editingId ? t.save : t.create}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 px-4">
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              toast.type === 'success'
                ? 'border-amber-200/30 bg-neutral-900/95 text-amber-100'
                : 'border-red-500/30 bg-neutral-900/95 text-red-300'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-200" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            {toast.message}
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label={t.close}
              className="ml-1 text-neutral-500 hover:text-neutral-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}