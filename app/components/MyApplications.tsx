'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

type Application = {
  id: string;
  hub_id: string;
  status: ApplicationStatus;
  created_at: string;
};

type Locale = 'ru' | 'en' | 'es' | 'pt';

const T: Record<Locale, Record<string, string>> = {
  ru: {
    title: 'Мои заявки',
    subtitle: 'Направления, в которые вы отправили запрос',
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
    subtitle: 'Destinations you have applied to',
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
    subtitle: 'Destinos a los que has enviado solicitud',
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
    title: 'Minhas candidaturas',
    subtitle: 'Destinos para os quais você se candidatou',
    empty: 'Você ainda não tem candidaturas ativas',
    emptyHint: 'Escolha um destino no mapa',
    submitted: 'Enviada',
    pending: 'Em análise',
    approved: 'Aprovada',
    rejected: 'Recusada',
    cancel: 'Cancelar',
    confirm: 'Cancelar a candidatura?',
    yes: 'Sim',
    no: 'Não',
    error: 'Não foi possível carregar as candidaturas',
    cancelError: 'Não foi possível cancelar a candidatura',
    retry: 'Tentar novamente',
  },
};

const INTL_LOCALE: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
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
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-200 opacity-75" />
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

export default function MyApplications({ locale = 'ru' }: { locale?: Locale }) {
  const t = T[locale] ?? T.ru;

  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setApps([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('applications')
      .select('id, hub_id, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setError(t.error);
    } else {
      setApps((data ?? []) as Application[]);
    }
    setLoading(false);
  }, [t.error]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-200/10 blur-3xl" />

      <header className="relative mb-6">
        <h2 className="text-lg font-semibold tracking-wide text-zinc-100 sm:text-xl">{t.title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
        <div className="mt-4 h-px w-full bg-gradient-to-r from-amber-200/40 via-amber-200/10 to-transparent" />
      </header>

      {error && (
        <div className="relative mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={load} className="shrink-0 text-xs font-medium text-amber-200 hover:text-amber-100">
            {t.retry}
          </button>
        </div>
      )}

      {loading ? (
        <ul className="relative space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[76px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
          ))}
        </ul>
      ) : apps.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-200/20 bg-white/[0.02] px-6 py-12 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/5">
            <svg className="h-6 w-6 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-200">{t.empty}</p>
          <p className="mt-1 text-sm text-zinc-500">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="relative space-y-3">
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
                      onClick={() => setConfirmId(null)}
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      {t.no}
                    </button>
                    <button
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
    </section>
  );
}