'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  AtSign,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  Loader2,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import RoleGuard from '@/app/components/RoleGuard';
import { useLanguage, type Lang } from '@/app/context/LanguageContext';

/* ────────────────────────────────────────────────────────────────────────────
 * Настройки
 * ──────────────────────────────────────────────────────────────────────────── */

type ApplicationTranslations = {
  eyebrow: string; title: string; subtitle: string; refresh: string;
  all: string; pending: string; approved: string; rejected: string;
  searchPlaceholder: string; colResident: string; colTour: string; colDate: string; colStatus: string; colActions: string;
  model: string; unknownModel: string; profileUnavailable: string; tourShort: string; dossier: string;
  approveTour: string; approve: string; reject: string;
  statusPending: string; statusApproved: string; statusRejected: string;
  kycPassed: string; kycReview: string; kycRejected: string; kycNotPassed: string;
  unknownError: string; permissionError: string;
  approvedInTour: (name: string, hub: string) => string; rejectedNotice: (name: string) => string;
  modalLabel: string; close: string; dossierResident: string; tourHub: string; submitted: string;
  city: string; height: string; measurements: string; instagram: string; about: string; portfolio: string;
  photoCount: (count: number) => string; photoAlt: (index: number) => string; noPortfolio: string; noValue: string;
  previous: string; next: string; loading: string; noResults: string; noApplications: string;
  changeFilterHint: string; applicationsEmptyHint: string; loadFailed: string; retry: string;
  loadingAria: string; copyUnavailable: string;
};

const translations: Record<Lang, ApplicationTranslations> = {
  EN: {
    eyebrow: 'Manager Console', title: 'Resident Applications', subtitle: 'Review resident applications for tours and your hubs', refresh: 'Refresh',
    all: 'All applications', pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
    searchPlaceholder: 'Search by name, city or tour…', colResident: 'Resident', colTour: 'Tour / hub', colDate: 'Date', colStatus: 'Status', colActions: 'Actions',
    model: 'Resident', unknownModel: 'Resident', profileUnavailable: 'Profile unavailable', tourShort: 'Tour:', dossier: 'Profile',
    approveTour: 'Approve for tour', approve: 'Approve', reject: 'Reject',
    statusPending: 'Pending review', statusApproved: 'Approved', statusRejected: 'Rejected',
    kycPassed: 'KYC passed', kycReview: 'KYC under review', kycRejected: 'KYC rejected', kycNotPassed: 'KYC not completed',
    unknownError: 'An unexpected error occurred.', permissionError: 'You do not have permission to update this application.',
    approvedInTour: (name, hub) => `${name} approved for tour “${hub}”`, rejectedNotice: (name) => `Application for ${name} rejected`,
    modalLabel: 'Resident profile', close: 'Close', dossierResident: 'Resident profile', tourHub: 'Tour / hub', submitted: 'Submitted',
    city: 'City', height: 'Height', measurements: 'Measurements (bust / waist / hips)', instagram: 'Instagram', about: 'About', portfolio: 'Portfolio',
    photoCount: (count) => `${count} photos`, photoAlt: (index) => `Photo ${index}`, noPortfolio: 'No portfolio photos uploaded', noValue: 'Not provided',
    previous: 'Previous', next: 'Next', loading: 'Loading applications…', noResults: 'No results found', noApplications: 'No applications yet',
    changeFilterHint: 'Try changing the filter or search query.', applicationsEmptyHint: 'Applications will appear here when residents apply to tours in your hubs.',
    loadFailed: 'Could not load applications', retry: 'Retry', loadingAria: 'Loading applications', copyUnavailable: 'Profile unavailable',
  },
  RU: {
    eyebrow: 'Панель менеджера', title: 'Заявки резидентов', subtitle: 'Отбор резидентов в туры и резиденции ваших хабов', refresh: 'Обновить',
    all: 'Все заявки', pending: 'Ожидают', approved: 'Одобрены', rejected: 'Отклонены',
    searchPlaceholder: 'Поиск по имени, городу или туру…', colResident: 'Резидентка', colTour: 'Тур / хаб', colDate: 'Дата', colStatus: 'Статус', colActions: 'Действия',
    model: 'Резидентка', unknownModel: 'Модель', profileUnavailable: 'Профиль недоступен', tourShort: 'Тур:', dossier: 'Досье',
    approveTour: 'Одобрить в тур', approve: 'Одобрить', reject: 'Отклонить',
    statusPending: 'На рассмотрении', statusApproved: 'Одобрена', statusRejected: 'Отклонена',
    kycPassed: 'KYC пройден', kycReview: 'KYC на проверке', kycRejected: 'KYC отклонён', kycNotPassed: 'KYC не пройден',
    unknownError: 'Неизвестная ошибка.', permissionError: 'Нет прав на изменение этой заявки.',
    approvedInTour: (name, hub) => `${name} одобрена в тур «${hub}»`, rejectedNotice: (name) => `Заявка ${name} отклонена`,
    modalLabel: 'Досье модели', close: 'Закрыть', dossierResident: 'Досье резидента', tourHub: 'Тур / хаб', submitted: 'Подана',
    city: 'Город', height: 'Рост', measurements: 'Параметры (грудь / талия / бёдра)', instagram: 'Instagram', about: 'О себе', portfolio: 'Портфолио',
    photoCount: (count) => `${count} фото`, photoAlt: (index) => `Фото ${index}`, noPortfolio: 'Фотографии портфолио не загружены', noValue: 'Не указано',
    previous: 'Предыдущее', next: 'Следующее', loading: 'Загрузка заявок…', noResults: 'Ничего не найдено', noApplications: 'Заявок пока нет',
    changeFilterHint: 'Попробуйте изменить фильтр или поисковый запрос.', applicationsEmptyHint: 'Когда резидентки подадут заявки в туры ваших хабов, они появятся здесь.',
    loadFailed: 'Не удалось загрузить заявки', retry: 'Повторить', loadingAria: 'Загрузка заявок', copyUnavailable: 'Профиль недоступен',
  },
  ES: {
    eyebrow: 'Panel de gerente', title: 'Solicitudes de residentes', subtitle: 'Revisión de solicitudes para tours y residencias de tus hubs', refresh: 'Actualizar',
    all: 'Todas las solicitudes', pending: 'Pendientes', approved: 'Aprobadas', rejected: 'Rechazadas',
    searchPlaceholder: 'Buscar por nombre, ciudad o tour…', colResident: 'Residente', colTour: 'Tour / hub', colDate: 'Fecha', colStatus: 'Estado', colActions: 'Acciones',
    model: 'Residente', unknownModel: 'Modelo', profileUnavailable: 'Perfil no disponible', tourShort: 'Tour:', dossier: 'Perfil',
    approveTour: 'Aprobar para el tour', approve: 'Aprobar', reject: 'Rechazar',
    statusPending: 'Pendiente de revisión', statusApproved: 'Aprobada', statusRejected: 'Rechazada',
    kycPassed: 'KYC completado', kycReview: 'KYC en revisión', kycRejected: 'KYC rechazado', kycNotPassed: 'KYC no completado',
    unknownError: 'Se produjo un error inesperado.', permissionError: 'No tienes permiso para modificar esta solicitud.',
    approvedInTour: (name, hub) => `${name} aprobada para el tour «${hub}»`, rejectedNotice: (name) => `Solicitud de ${name} rechazada`,
    modalLabel: 'Perfil de residente', close: 'Cerrar', dossierResident: 'Perfil de residente', tourHub: 'Tour / hub', submitted: 'Enviada',
    city: 'Ciudad', height: 'Altura', measurements: 'Medidas (busto / cintura / caderas)', instagram: 'Instagram', about: 'Sobre mí', portfolio: 'Portafolio',
    photoCount: (count) => `${count} fotos`, photoAlt: (index) => `Foto ${index}`, noPortfolio: 'No se han subido fotos al portafolio', noValue: 'No indicado',
    previous: 'Anterior', next: 'Siguiente', loading: 'Cargando solicitudes…', noResults: 'No se encontraron resultados', noApplications: 'Todavía no hay solicitudes',
    changeFilterHint: 'Prueba con otro filtro o término de búsqueda.', applicationsEmptyHint: 'Las solicitudes aparecerán aquí cuando las residentes se postulen a tours de tus hubs.',
    loadFailed: 'No se pudieron cargar las solicitudes', retry: 'Reintentar', loadingAria: 'Cargando solicitudes', copyUnavailable: 'Perfil no disponible',
  },
  PT: {
    eyebrow: 'Painel do gerente', title: 'Solicitações de residentes', subtitle: 'Análise de solicitações para tours e residências dos seus hubs', refresh: 'Atualizar',
    all: 'Todas as solicitações', pending: 'Pendentes', approved: 'Aprovadas', rejected: 'Rejeitadas',
    searchPlaceholder: 'Buscar por nome, cidade ou tour…', colResident: 'Residente', colTour: 'Tour / hub', colDate: 'Data', colStatus: 'Status', colActions: 'Ações',
    model: 'Residente', unknownModel: 'Modelo', profileUnavailable: 'Perfil indisponível', tourShort: 'Tour:', dossier: 'Perfil',
    approveTour: 'Aprovar para o tour', approve: 'Aprovar', reject: 'Rejeitar',
    statusPending: 'Aguardando análise', statusApproved: 'Aprovada', statusRejected: 'Rejeitada',
    kycPassed: 'KYC concluído', kycReview: 'KYC em análise', kycRejected: 'KYC rejeitado', kycNotPassed: 'KYC não concluído',
    unknownError: 'Ocorreu um erro inesperado.', permissionError: 'Você não tem permissão para alterar esta solicitação.',
    approvedInTour: (name, hub) => `${name} aprovada para o tour “${hub}”`, rejectedNotice: (name) => `Solicitação de ${name} rejeitada`,
    modalLabel: 'Perfil da residente', close: 'Fechar', dossierResident: 'Perfil da residente', tourHub: 'Tour / hub', submitted: 'Enviada',
    city: 'Cidade', height: 'Altura', measurements: 'Medidas (busto / cintura / quadris)', instagram: 'Instagram', about: 'Sobre mim', portfolio: 'Portfólio',
    photoCount: (count) => `${count} fotos`, photoAlt: (index) => `Foto ${index}`, noPortfolio: 'Nenhuma foto de portfólio foi enviada', noValue: 'Não informado',
    previous: 'Anterior', next: 'Próxima', loading: 'Carregando solicitações…', noResults: 'Nenhum resultado encontrado', noApplications: 'Ainda não há solicitações',
    changeFilterHint: 'Tente alterar o filtro ou a busca.', applicationsEmptyHint: 'As solicitações aparecerão aqui quando as residentes se candidatarem aos tours dos seus hubs.',
    loadFailed: 'Não foi possível carregar as solicitações', retry: 'Tentar novamente', loadingAria: 'Carregando solicitações', copyUnavailable: 'Perfil indisponível',
  },
};

const LOCALE: Record<Lang, string> = { EN: 'en-GB', RU: 'ru-RU', ES: 'es-ES', PT: 'pt-BR' };

const PORTFOLIO_BUCKET = 'user-uploads';

/* ────────────────────────────────────────────────────────────────────────────
 * Типы
 * ──────────────────────────────────────────────────────────────────────────── */

type AppStatus = 'pending' | 'approved' | 'rejected';
type StatusFilter = 'all' | AppStatus;

interface ApplicationRow {
  id: string;
  user_id: string;
  hub_id: string;
  status: AppStatus;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawProfile = Record<string, any>;

interface ModelProfile {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  city: string | null;
  height: string | null;
  measurements: string | null;
  kycStatus: string | null;
  photos: string[];
  bio: string | null;
  instagram: string | null;
}

interface ApplicationItem extends ApplicationRow {
  profile: ModelProfile | null;
}

type Toast = { type: 'success' | 'error'; text: string } | null;

/* ────────────────────────────────────────────────────────────────────────────
 * Хелперы
 * ──────────────────────────────────────────────────────────────────────────── */

function pick(obj: RawProfile, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && v !== '') return v;
  }
  return null;
}

const str = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);

function toPhotoList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === 'string') return x;
        const o = x as { url?: string; path?: string; src?: string } | null;
        return o?.url ?? o?.path ?? o?.src ?? '';
      })
      .filter(Boolean);
  }
  if (typeof v === 'string') {
    try {
      const parsed: unknown = JSON.parse(v);
      return typeof parsed === 'string' ? [parsed] : toPhotoList(parsed);
    } catch {
      return [v];
    }
  }
  return [];
}

function normalizeProfile(raw: RawProfile, resolve: (p: string) => string, t: ApplicationTranslations): ModelProfile {
  const photos = toPhotoList(
    pick(raw, ['photo_urls', 'portfolio_photos', 'portfolio', 'photos', 'gallery', 'images']),
  ).map(resolve);

  const avatar = str(pick(raw, ['avatar_url', 'avatarUrl', 'avatar', 'photo_url']));

  const heightRaw = str(pick(raw, ['height', 'height_cm']));
  const height = heightRaw ? (/^\d+$/.test(heightRaw) ? `${heightRaw} ${t.height.toLowerCase() === 'height' ? 'cm' : t.height.toLowerCase() === 'altura' ? 'cm' : t.height.toLowerCase() === 'рост' ? 'см' : 'cm'}` : heightRaw) : null;

  const bust = str(pick(raw, ['bust', 'chest', 'bust_cm']));
  const waist = str(pick(raw, ['waist', 'waist_cm']));
  const hips = str(pick(raw, ['hips', 'hips_cm']));
  const measurementsRaw = pick(raw, ['measurements', 'params', 'parameters']);

  let measurements: string | null = null;
  if (bust || waist || hips) {
    measurements = [bust, waist, hips].map((v) => v ?? '—').join(' / ');
  } else if (measurementsRaw && typeof measurementsRaw === 'object') {
    measurements = Object.values(measurementsRaw as Record<string, unknown>)
      .filter((v) => v !== null && v !== '')
      .join(' / ');
  } else {
    measurements = str(measurementsRaw);
  }

  return {
    id: String(raw.id),
    fullName: str(pick(raw, ['full_name', 'fullName', 'name', 'nickname'])) ?? t.unknownModel,
    avatarUrl: avatar ? resolve(avatar) : photos[0] ?? null,
    city: str(pick(raw, ['city', 'location', 'base_city', 'location'])),
    height,
    measurements: measurements || null,
    kycStatus: str(pick(raw, ['kyc_level', 'kyc_status', 'kycStatus', 'verification_status'])),
    photos,
    bio: str(pick(raw, ['bio', 'about', 'description'])),
    instagram: str(pick(raw, ['instagram', 'instagram_handle', 'ig'])),
  };
}

function formatHub(hubId: string): string {
  return hubId.replace(/[-_]/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function formatDate(date: Date, locale: string): string { return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(date); }
function formatTime(date: Date, locale: string): string { return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date); }

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

/* ────────────────────────────────────────────────────────────────────────────
 * Мета статусов
 * ──────────────────────────────────────────────────────────────────────────── */

function statusMeta(status: AppStatus, t: ApplicationTranslations) {
  const map: Record<AppStatus, { label: string; cls: string; dot: string }> = {
    pending: { label: t.statusPending, cls: 'border-amber-200/30 bg-amber-200/10 text-amber-200', dot: 'bg-amber-200 animate-pulse' },
    approved: { label: t.statusApproved, cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', dot: 'bg-emerald-400' },
    rejected: { label: t.statusRejected, cls: 'border-rose-400/30 bg-rose-400/10 text-rose-300', dot: 'bg-rose-400' },
  };
  return map[status] ?? map.pending;
}

function kycMeta(status: string | null, t: ApplicationTranslations) {
  const s = String(status ?? '').toLowerCase();
  if (['3', 'verified', 'approved', 'passed', 'completed'].includes(s))
    return { label: t.kycPassed, cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10', Icon: ShieldCheck };
  if (['2', '1', 'pending', 'in_review', 'review', 'submitted', 'processing'].includes(s))
    return { label: t.kycReview, cls: 'text-amber-200 border-amber-200/30 bg-amber-200/10', Icon: ShieldAlert };
  if (['rejected', 'failed', 'declined'].includes(s))
    return { label: t.kycRejected, cls: 'text-rose-300 border-rose-400/30 bg-rose-400/10', Icon: ShieldX };
  return { label: t.kycNotPassed, cls: 'text-zinc-400 border-white/10 bg-white/5', Icon: Shield };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Страница
 * ──────────────────────────────────────────────────────────────────────────── */

export default function ApplicationsPage() {
  return (
    <RoleGuard allowedRoles={['manager', 'admin', 'owner']}>
      <ApplicationsDashboard />
    </RoleGuard>
  );
}

function ApplicationsDashboard() {
  const { lang } = useLanguage();
  const t = translations[lang] ?? translations.EN;
  const locale = LOCALE[lang] ?? LOCALE.EN;
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<Record<string, AppStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const resolveUrl = useCallback((p: string) => {
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    const { data } = supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(p.replace(/^\/+/, ''));
    return data.publicUrl;
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const { data: apps, error: appsError } = await supabase
          .from('applications')
          .select('id, user_id, hub_id, status, created_at')
          .order('created_at', { ascending: false });

        if (appsError) throw appsError;

        const rows = (apps ?? []) as ApplicationRow[];
        const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));

        let profileMap = new Map<string, ModelProfile>();
        if (userIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', userIds);

          if (profilesError) throw profilesError;

          profileMap = new Map(
            ((profiles ?? []) as RawProfile[]).map((p) => [String(p.id), normalizeProfile(p, resolveUrl, t)]),
          );
        }

        setItems(rows.map((r) => ({ ...r, profile: profileMap.get(r.user_id) ?? null })));
      } catch (e) {
        console.error("[admin-applications] load failed", e);
        setError(t.unknownError);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [resolveUrl, t],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const updateStatus = useCallback(
    async (id: string, next: AppStatus) => {
      const current = items.find((i) => i.id === id);
      if (!current || current.status === next || busy[id]) return;

      const prevStatus = current.status;
      const name = current.profile?.fullName ?? t.unknownModel;
      const hub = formatHub(current.hub_id);

      setBusy((b) => ({ ...b, [id]: next }));
      setItems((list) => list.map((i) => (i.id === id ? { ...i, status: next } : i)));

      const { data, error: updError } = await supabase
        .from('applications')
        .update({ status: next })
        .eq('id', id)
        .select('id, status');

      setBusy((b) => {
        const copy = { ...b };
        delete copy[id];
        return copy;
      });

      if (updError || !data || data.length === 0) {
        if (updError) console.error("[admin-applications] status update failed", updError);
        setItems((list) => list.map((i) => (i.id === id ? { ...i, status: prevStatus } : i)));
        setToast({
          type: 'error',
          text: t.permissionError,
        });
        return;
      }

      setToast({
        type: 'success',
        text: next === 'approved' ? t.approvedInTour(name, hub) : t.rejectedNotice(name),
      });
    },
    [items, busy, t],
  );

  const counts = useMemo(
    () => ({
      all: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter !== 'all' && i.status !== filter) return false;
      if (!q) return true;
      return [i.profile?.fullName, i.profile?.city, i.hub_id, formatHub(i.hub_id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, filter, query]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-amber-200/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-amber-100/[0.03] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.28em] text-amber-200/70">
              <Sparkles className="h-3.5 w-3.5" />
              {t.eyebrow}
            </p>
            <h1 className="font-serif text-3xl font-light tracking-tight text-zinc-50 sm:text-4xl">
              {t.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {t.subtitle}
            </p>
          </div>

          <button
            onClick={() => load('refresh')}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 backdrop-blur-xl transition hover:border-amber-200/40 hover:text-amber-200 disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t.refresh}
          </button>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              ['all', t.all],
              ['pending', t.pending],
              ['approved', t.approved],
              ['rejected', t.rejected],
            ] as [StatusFilter, string][]
          ).map(([key, label]) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`group rounded-2xl border p-4 text-left backdrop-blur-xl transition ${
                  active
                    ? 'border-amber-200/40 bg-amber-200/[0.07] shadow-[0_0_40px_-12px_rgba(253,230,138,0.35)]'
                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <p
                  className={`text-[11px] uppercase tracking-[0.2em] ${
                    active ? 'text-amber-200' : 'text-zinc-500 group-hover:text-zinc-400'
                  }`}
                >
                  {label}
                </p>
                <p className={`mt-1 text-2xl font-light ${active ? 'text-amber-100' : 'text-zinc-100'}`}>
                  {loading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-white/10" /> : counts[key]}
                </p>
              </button>
            );
          })}
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 backdrop-blur-xl outline-none transition focus:border-amber-200/40 focus:ring-2 focus:ring-amber-200/10"
          />
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-2xl">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] gap-4 border-b border-white/10 px-6 py-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500 md:grid">
            <span>{t.model}</span>
            <span>{t.colTour}</span>
            <span>{t.colDate}</span>
            <span>{t.colStatus}</span>
            <span className="w-[248px] text-right">{t.colActions}</span>
          </div>

          {loading ? (
            <SkeletonRows t={t} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => load('initial')} t={t} />
          ) : visible.length === 0 ? (
            <EmptyState filtered={filter !== 'all' || query.trim() !== ''} hasAny={items.length > 0} t={t} />
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {visible.map((item) => (
                <ApplicationRowView
                  key={item.id}
                  item={item}
                  t={t}
                  locale={locale}
                  busyStatus={busy[item.id]}
                  onOpen={() => setSelectedId(item.id)}
                  onApprove={() => updateStatus(item.id, 'approved')}
                  onReject={() => updateStatus(item.id, 'rejected')}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {selected && (
        <DossierDrawer
          key={selected.id}
          item={selected}
          t={t}
          locale={locale}
          busyStatus={busy[selected.id]}
          onClose={() => setSelectedId(null)}
          onApprove={() => updateStatus(selected.id, 'approved')}
          onReject={() => updateStatus(selected.id, 'rejected')}
        />
      )}

      <ToastView toast={toast} onClose={() => setToast(null)} t={t} />
    </div>
  );
}

function ApplicationRowView({
  item,
  t,
  locale,
  busyStatus,
  onOpen,
  onApprove,
  onReject,
}: {
  item: ApplicationItem;
  t: ApplicationTranslations;
  locale: string;
  busyStatus?: AppStatus;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const p = item.profile;
  const date = new Date(item.created_at);

  return (
    <li className="grid grid-cols-1 gap-4 px-4 py-4 transition hover:bg-white/[0.025] sm:px-6 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-center">
      <button onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left">
        <Avatar src={p?.avatarUrl ?? null} name={p?.fullName ?? '?'} size="md" />
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-100">{p?.fullName ?? t.profileUnavailable}</p>
          <p className="truncate text-xs text-zinc-500">
            {[p?.city, p?.height, p?.measurements].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-2 md:block">
        <span className="text-[11px] uppercase tracking-widest text-zinc-500 md:hidden">{t.tourShort}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/20 bg-amber-200/[0.05] px-3 py-1 text-xs text-amber-100">
          <MapPin className="h-3 w-3 text-amber-200" />
          {formatHub(item.hub_id)}
        </span>
      </div>

      <div className="text-sm">
        <p className="text-zinc-300">{formatDate(date, locale)}</p>
        <p className="text-xs text-zinc-500">{formatTime(date, locale)}</p>
      </div>

      <div>
        <StatusBadge status={item.status} t={t} />
      </div>

      <div className="flex flex-wrap items-center gap-2 md:w-[248px] md:justify-end">
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-amber-200/40 hover:text-amber-200"
        >
          <Eye className="h-3.5 w-3.5" />
          {t.dossier}
        </button>
        <ActionButtons
          status={item.status}
          busyStatus={busyStatus}
          onApprove={onApprove}
          onReject={onReject}
          compact
          t={t}
        />
      </div>
    </li>
  );
}

function ActionButtons({
  status,
  t,
  busyStatus,
  onApprove,
  onReject,
  compact = false,
}: {
  status: AppStatus;
  t: ApplicationTranslations;
  busyStatus?: AppStatus;
  onApprove: () => void;
  onReject: () => void;
  compact?: boolean;
}) {
  const isBusy = Boolean(busyStatus);
  const size = compact ? 'px-3 py-1.5 text-xs' : 'flex-1 justify-center px-5 py-3 text-sm';

  return (
    <>
      {status !== 'approved' || busyStatus === 'approved' ? (
        <button
          onClick={onApprove}
          disabled={isBusy}
          title={t.approveTour}
          className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-amber-100 to-amber-300 font-medium text-zinc-950 shadow-[0_0_24px_-8px_rgba(253,230,138,0.6)] transition hover:from-amber-50 hover:to-amber-200 disabled:cursor-not-allowed disabled:opacity-60 ${size}`}
        >
          {busyStatus === 'approved' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {compact ? t.approve : t.approveTour}
        </button>
      ) : null}

      {status !== 'rejected' || busyStatus === 'rejected' ? (
        <button
          onClick={onReject}
          disabled={isBusy}
          title={t.reject}
          className={`inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/[0.06] text-rose-300 transition hover:border-rose-400/60 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-60 ${size}`}
        >
          {busyStatus === 'rejected' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          {t.reject}
        </button>
      ) : null}
    </>
  );
}

function DossierDrawer({
  item,
  t,
  locale,
  busyStatus,
  onClose,
  onApprove,
  onReject,
}: {
  item: ApplicationItem;
  t: ApplicationTranslations;
  locale: string;
  busyStatus?: AppStatus;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const p = item.profile;
  const [shown, setShown] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const gallery = useMemo(() => {
    const list = [...(p?.photos ?? [])];
    if (p?.avatarUrl && !list.includes(p.avatarUrl)) list.unshift(p.avatarUrl);
    return list;
  }, [p]);

  const close = useCallback(() => {
    setShown(false);
    setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightbox === null) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, lightbox]);

  const kyc = kycMeta(p?.kycStatus ?? null, t);
  const date = new Date(item.created_at);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.modalLabel}>
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ease-out ${
          shown ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          <div className="relative h-72 overflow-hidden sm:h-80">
            {gallery[0] ? (
              <img src={gallery[0]} alt={p?.fullName ?? ''} className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                <span className="font-serif text-6xl font-light text-amber-200/40">
                  {initials(p?.fullName ?? '?')}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />

            <button
              onClick={close}
              aria-label={t.close}
              className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/40 p-2 text-zinc-200 backdrop-blur-md transition hover:border-amber-200/40 hover:text-amber-200"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="mb-1 text-[11px] uppercase tracking-[0.28em] text-amber-200/80">{t.dossierResident}</p>
              <h2 className="font-serif text-3xl font-light text-zinc-50">
                {p?.fullName ?? t.profileUnavailable}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={item.status} t={t} />
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${kyc.cls}`}>
                  <kyc.Icon className="h-3.5 w-3.5" />
                  {kyc.label}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 gap-3">
              <InfoTile icon={<MapPin className="h-4 w-4" />} label={t.tourHub} value={formatHub(item.hub_id)} t={t} accent />
              <InfoTile
                icon={<Calendar className="h-4 w-4" />}
                label={t.submitted}
                value={`${formatDate(date, locale)}, ${formatTime(date, locale)}`}
                t={t}
              />
              <InfoTile icon={<MapPin className="h-4 w-4" />} label={t.city} value={p?.city} t={t} />
              <InfoTile icon={<Ruler className="h-4 w-4" />} label={t.height} value={p?.height} t={t} />
              <InfoTile
                icon={<Ruler className="h-4 w-4" />}
                label={t.measurements}
                value={p?.measurements}
                t={t}
                wide
              />
              {p?.instagram && (
                <InfoTile
                  icon={<AtSign className="h-4 w-4" />}
                  label={t.instagram}
                  t={t}
                  value={p.instagram.startsWith('@') ? p.instagram : `@${p.instagram}`}
                  wide
                />
              )}
            </div>

            {p?.bio && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">{t.about}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{p.bio}</p>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{t.portfolio}</p>
                <p className="text-xs text-zinc-500">{t.photoCount(gallery.length)}</p>
              </div>
              {gallery.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {gallery.map((src, i) => (
                    <button
                      key={src + i}
                      onClick={() => setLightbox(i)}
                      className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
                    >
                      <img
                        src={src}
                        alt={t.photoAlt(i + 1)}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 ring-1 ring-inset ring-amber-200/0 transition group-hover:ring-amber-200/40" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
                  {t.noPortfolio}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-white/10 bg-zinc-950/80 p-4 backdrop-blur-xl sm:p-6">
          <ActionButtons status={item.status} t={t} busyStatus={busyStatus} onApprove={onApprove} onReject={onReject} />
        </div>
      </aside>

      {lightbox !== null && gallery.length > 0 && (
        <Lightbox images={gallery} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} t={t} />
      )}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  t,
  accent = false,
  wide = false,
}: {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
  t: ApplicationTranslations;
  accent?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${wide ? 'col-span-2' : ''} ${
        accent ? 'border-amber-200/25 bg-amber-200/[0.05]' : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <p className={`mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] ${accent ? 'text-amber-200/80' : 'text-zinc-500'}`}>
        {icon}
        {label}
      </p>
      <p className={`text-sm ${value ? (accent ? 'text-amber-100' : 'text-zinc-100') : 'text-zinc-600'}`}>
        {value || t.noValue}
      </p>
    </div>
  );
}

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  t,
}: {
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  t: ApplicationTranslations;
}) {
  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md" onClick={onClose}>
      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
      <button
        onClick={onClose}
        aria-label={t.close}
        className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/5 p-2 text-zinc-200 hover:text-amber-200"
      >
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label={t.previous}
            className="absolute left-3 rounded-full border border-white/15 bg-white/5 p-2.5 text-zinc-200 hover:text-amber-200 sm:left-6"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label={t.next}
            className="absolute right-3 rounded-full border border-white/15 bg-white/5 p-2.5 text-zinc-200 hover:text-amber-200 sm:right-6"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <p className="absolute bottom-5 text-xs tracking-widest text-zinc-400">
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status, t }: { status: AppStatus; t: ApplicationTranslations }) {
  const m = statusMeta(status, t);
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${m.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Avatar({ src, name, size = 'md' }: { src: string | null; name: string; size?: 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const dim = size === 'lg' ? 'h-14 w-14 text-base' : 'h-11 w-11 text-sm';

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full ring-1 ring-amber-200/30 ${dim}`}>
      {src && !failed ? (
        <img src={src} alt={name} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 font-medium text-amber-200/80">
          {initials(name)}
        </div>
      )}
    </div>
  );
}

function SkeletonRows({ t }: { t: ApplicationTranslations }) {
  return (
    <ul className="divide-y divide-white/[0.06]" aria-busy="true" aria-label={t.loadingAria}>
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto] md:items-center"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="space-y-2">
              <div className="h-3.5 w-36 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
            </div>
          </div>
          <div className="h-6 w-24 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-6 w-28 animate-pulse rounded-full bg-white/[0.06]" />
          <div className="flex gap-2 md:w-[248px] md:justify-end">
            <div className="h-7 w-20 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-amber-200/10" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ filtered, hasAny, t }: { filtered: boolean; hasAny: boolean; t: ApplicationTranslations }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-amber-200/10 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-amber-200/25 bg-gradient-to-b from-amber-200/10 to-transparent">
          <Inbox className="h-8 w-8 text-amber-200/80" />
        </div>
      </div>
      <h3 className="font-serif text-xl font-light text-zinc-100">
        {filtered && hasAny ? t.noResults : t.noApplications}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        {filtered && hasAny
          ? t.changeFilterHint
          : t.applicationsEmptyHint}
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry, t }: { message: string; onRetry: () => void; t: ApplicationTranslations }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-rose-400/30 bg-rose-400/10">
        <AlertTriangle className="h-6 w-6 text-rose-300" />
      </div>
      <h3 className="text-lg text-zinc-100">{t.loadFailed}</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/[0.06] px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-200/10"
      >
        <RefreshCw className="h-4 w-4" />
        {t.retry}
      </button>
    </div>
  );
}

function ToastView({ toast, onClose, t }: { toast: Toast; onClose: () => void; t: ApplicationTranslations }) {
  if (!toast) return null;
  const ok = toast.type === 'success';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${
          ok ? 'border-amber-200/30 bg-zinc-900/90 text-amber-100' : 'border-rose-400/30 bg-zinc-900/90 text-rose-200'
        }`}
      >
        {ok ? <Check className="h-4 w-4 text-amber-200" /> : <AlertTriangle className="h-4 w-4 text-rose-300" />}
        <span>{toast.text}</span>
        <button onClick={onClose} aria-label={t.close} className="ml-1 text-zinc-500 hover:text-zinc-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}