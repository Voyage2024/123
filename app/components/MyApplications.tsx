'use client';

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · МОИ ЗАЯВКИ — app/components/MyApplications.tsx
 *
 * Тело страницы /dashboard/applications. Заголовок страницы и отступы —
 * у page.tsx (PageExplainerHeader + ResidentPageShell), здесь только
 * переключатель и списки:
 *   Туры         — applications (направления с карты), заявку на
 *                  рассмотрении можно отменить
 *   Мероприятия  — rpc get_my_event_applications (заявки из «Темы / Тусовки»)
 * Переключатель — та же «пилюля», что WORKING / ELITE на странице туров.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, GlassWater, Map as MapIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

type Application = {
  id: string;
  hub_id: string;
  status: ApplicationStatus;
  created_at: string;
};

type EventApplication = {
  id: string;
  event_id: string;
  event_title: string | null;
  region: string | null;
  status: ApplicationStatus;
  created_at: string;
};

type Locale = 'ru' | 'en' | 'es' | 'pt';
type Tab = 'tours' | 'events';

const T: Record<Locale, Record<string, string>> = {
  ru: {
    title: 'Мои заявки',
    tabTours: 'Туры', tabEvents: 'Мероприятия', eventEmpty: 'У вас пока нет заявок на мероприятия', eventEmptyHint: 'Посмотрите доступные тусовки в разделе мероприятий', eventError: 'Не удалось загрузить заявки на мероприятия', eventFallback: 'Мероприятие',
    empty: 'У вас пока нет активных заявок',
    emptyHint: 'Выберите направление на карте',
    submitted: 'Подана',
    pending: 'На рассмотрении',
    approved: 'Одобрена',
    rejected: 'Отклонена',
    cancel: 'Отменить',
    confirm: 'Точно отменить?',
    yes: 'Да',
    no: 'Нет',
    error: 'Не удалось загрузить заявки',
    cancelError: 'Не удалось отменить заявку',
    retry: 'Повторить',
  },
  en: {
    title: 'My applications',
    tabTours: 'Tours', tabEvents: 'Events', eventEmpty: 'You have no event applications yet', eventEmptyHint: 'Browse available events in the events section', eventError: 'Could not load event applications', eventFallback: 'Event',
    empty: 'You have no active applications yet',
    emptyHint: 'Choose a destination on the map',
    submitted: 'Submitted',
    pending: 'Under review',
    approved: 'Approved',
    rejected: 'Declined',
    cancel: 'Cancel',
    confirm: 'Cancel this application?',
    yes: 'Yes',
    no: 'No',
    error: 'Could not load applications',
    cancelError: 'Could not cancel the application',
    retry: 'Retry',
  },
  es: {
    title: 'Mis solicitudes',
    tabTours: 'Tours', tabEvents: 'Eventos', eventEmpty: 'Aún no tienes solicitudes para eventos', eventEmptyHint: 'Consulta los eventos disponibles', eventError: 'No se pudieron cargar las solicitudes para eventos', eventFallback: 'Evento',
    empty: 'Aún no tienes solicitudes activas',
    emptyHint: 'Elige un destino en el mapa',
    submitted: 'Enviada',
    pending: 'En revisión',
    approved: 'Aprobada',
    rejected: 'Rechazada',
    cancel: 'Cancelar',
    confirm: '¿Cancelar la solicitud?',
    yes: 'Sí',
    no: 'No',
    error: 'No se pudieron cargar las solicitudes',
    cancelError: 'No se pudo cancelar la solicitud',
    retry: 'Reintentar',
  },
  pt: {
    title: 'Minhas solicitações',
    tabTours: 'Tours', tabEvents: 'Eventos', eventEmpty: 'Você ainda não tem solicitações para eventos', eventEmptyHint: 'Veja os eventos disponíveis', eventError: 'Não foi possível carregar as solicitações para eventos', eventFallback: 'Evento',
    empty: 'Você ainda não tem solicitações ativas',
    emptyHint: 'Escolha um destino no mapa',
    submitted: 'Enviada',
    pending: 'Em análise',
    approved: 'Aprovada',
    rejected: 'Recusada',
    cancel: 'Cancelar',
    confirm: 'Cancelar a solicitação?',
    yes: 'Sim',
    no: 'Não',
    error: 'Não foi possível carregar as solicitações',
    cancelError: 'Não foi possível cancelar a solicitação',
    retry: 'Tentar novamente',
  },
};

const INTL_LOCALE: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
};

/** Куда вести из пустого списка */
const EMPTY_LINK: Record<Tab, string> = {
  tours: '/dashboard/map',
  events: '/dashboard/parties',
};

const HUB_NAMES: Record<string, string> = {};

function formatHub(hubId: string) {
  if (HUB_NAMES[hubId]) return HUB_NAMES[hubId];
  return hubId
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function StatusBadge({ status, label }: { status: ApplicationStatus; label: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-medium text-amber-200">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-200 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-200" />
        </span>
        {label}
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
        </svg>
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-300">
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
      </svg>
      {label}
    </span>
  );
}

export default function MyApplications({ locale = 'ru', segment = 'working' }: { locale?: Locale; segment?: 'working' | 'elite' }) {
  const t = T[locale] ?? T.ru;

  const [apps, setApps] = useState<Application[]>([]);
  const [eventApps, setEventApps] = useState<EventApplication[]>([]);
  const [tab, setTab] = useState<Tab>(segment === 'elite' ? 'events' : 'tours');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (segment === 'elite' && tab === 'tours') {
      setApps([]);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setApps([]);
      setEventApps([]);
      setLoading(false);
      return;
    }

    if (tab === 'tours') {
      const { data, error } = await supabase
        .from('applications')
        .select('id, hub_id, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[my-applications] tours query failed', { code: error.code, message: error.message });
        setError(t.error);
      } else {
        setApps((data ?? []) as Application[]);
      }
    } else {
      const { data, error } = await supabase.rpc('get_my_event_applications');
      if (error) {
        console.error('[my-applications] event applications RPC failed', { code: error.code, message: error.message });
        setError(t.eventError);
      } else {
        setEventApps((data ?? []) as EventApplication[]);
      }
    }
    setLoading(false);
  }, [t.error, t.eventError, tab, segment]);

  useEffect(() => {
    if (segment === 'elite' && tab === 'tours') {
      setTab('events');
      return;
    }
    // Initial data loading is intentionally kicked off after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, segment, tab]);

  const cancelApplication = async (id: string) => {
    setDeletingId(id);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDeletingId(null);
      return;
    }

    const { data, error } = await supabase
      .from('applications')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .select('id');

    if (error || !data || data.length === 0) {
      console.error(error);
      setError(t.cancelError);
      await load();
    } else {
      setApps((prev) => prev.filter((a) => a.id !== id));
    }

    setDeletingId(null);
    setConfirmId(null);
  };

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: 'numeric', month: 'long', year: 'numeric' }),
    [locale]
  );

  const isEmpty = tab === 'tours' ? apps.length === 0 : eventApps.length === 0;
  const EmptyIcon = tab === 'tours' ? MapIcon : GlassWater;

  return (
    <section aria-label={t.title}>
      {/* ───────────── Туры / Мероприятия ───────────── */}
      <div
        role="tablist"
        aria-label={t.title}
        className="mb-5 inline-flex rounded-full border border-white/10 bg-zinc-900/70 p-1 backdrop-blur-xl"
      >
        {(segment === 'elite' ? (['events'] as const) : (['tours', 'events'] as const)).map((key) => (
          <button
            key={key}
            id={`my-apps-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls="my-apps-panel"
            onClick={() => setTab(key)}
            className={`rounded-full px-5 py-2 text-xs font-medium uppercase tracking-[0.12em] transition ${
              tab === key
                ? 'bg-amber-200 text-zinc-950 shadow-[0_0_24px_-10px_rgba(253,230,138,0.6)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {key === 'tours' ? t.tabTours : t.tabEvents}
          </button>
        ))}
      </div>

      <div id="my-apps-panel" role="tabpanel" aria-labelledby={`my-apps-tab-${tab}`}>
        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 text-xs font-medium text-amber-200 hover:text-amber-100"
            >
              {t.retry}
            </button>
          </div>
        )}

        {loading ? (
          <ul className="space-y-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[76px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
            ))}
          </ul>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-amber-200/20 bg-white/[0.02] px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/5">
              <EmptyIcon aria-hidden className="h-6 w-6 text-amber-200" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-zinc-200">{tab === 'tours' ? t.empty : t.eventEmpty}</p>
            <Link
              href={EMPTY_LINK[tab]}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 px-3.5 py-1.5 text-xs text-amber-200 transition hover:bg-amber-200/10"
            >
              {tab === 'tours' ? t.emptyHint : t.eventEmptyHint}
              <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : tab === 'events' ? (
          <ul className="space-y-3">
            {eventApps.map((app) => (
              <li
                key={app.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition hover:border-amber-200/25 hover:bg-white/[0.05]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-zinc-100">{app.event_title?.trim() || t.eventFallback}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {app.region || ''}
                      {app.region ? ' · ' : ''}
                      {t.submitted} · {dateFmt.format(new Date(app.created_at))}
                    </p>
                  </div>
                  <StatusBadge status={app.status} label={t[app.status]} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {apps.map((app) => {
              const isConfirming = confirmId === app.id;
              const isDeleting = deletingId === app.id;

              return (
                <li
                  key={app.id}
                  className={`group rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition-all duration-300 hover:border-amber-200/25 hover:bg-white/[0.05] ${
                    isDeleting ? 'pointer-events-none opacity-40' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-zinc-100">{formatHub(app.hub_id)}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {t.submitted} · {dateFmt.format(new Date(app.created_at))}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={app.status} label={t[app.status]} />

                      {app.status === 'pending' && !isConfirming && (
                        <button
                          type="button"
                          onClick={() => setConfirmId(app.id)}
                          className="rounded-full px-3 py-1 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-300"
                        >
                          {t.cancel}
                        </button>
                      )}
                    </div>
                  </div>

                  {isConfirming && (
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/5 pt-3">
                      <span className="mr-auto text-xs text-zinc-400">{t.confirm}</span>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5"
                      >
                        {t.no}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelApplication(app.id)}
                        className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-400/20"
                      >
                        {t.yes}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
