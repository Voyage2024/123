'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ResidentTrustBadges } from './ResidentTrustBadges';

type Status = 'pending' | 'approved' | 'rejected' | 'completed';
type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  segment: 'working' | 'elite';
  level: number;
  reliability: number;
  kyc_level: number;
  kyc_status: string | null;
  kyc_submission_level: number | null;
  location: string | null;
};
type GlobalEvent = {
  id: string;
  title: string;
  region: string;
  country_code: string | null;
  audience_segment: 'all' | 'working' | 'elite';
};
type EventApplication = {
  id: string;
  user_id: string;
  event_id: string;
  status: Status;
  created_at: string;
  updated_at: string;
  profile: Profile | null;
  event: GlobalEvent | null;
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
const statusMeta: Record<Status, { title: string; className: string }> = {
  pending: { title: 'На рассмотрении', className: 'border-amber-200/25 bg-amber-200/[0.07] text-amber-100' },
  approved: { title: 'Одобрена', className: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300' },
  rejected: { title: 'Отклонена', className: 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300' },
  completed: { title: 'Завершена', className: 'border-amber-200/35 bg-amber-200/[0.1] text-amber-100' },
};

function completionDetails() {
  const rawValue = window.prompt('Коммерческая ценность ивента в USD:', '0');
  if (rawValue === null) return null;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0 || value > 100000000) {
    window.alert('Укажите корректную коммерческую ценность.');
    return null;
  }
  const rawComplexity = window.prompt('Сложность активности: 1, 2 или 3', '1');
  if (rawComplexity === null) return null;
  const complexity = Number(rawComplexity);
  if (![1, 2, 3].includes(complexity)) {
    window.alert('Сложность должна быть 1, 2 или 3.');
    return null;
  }
  const rawCountry = window.prompt('ISO-код страны из двух букв для паспорта (например VN). Оставь пустым, если штамп не нужен:', '');
  if (rawCountry === null) return null;
  const country = rawCountry.trim().toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) {
    window.alert('Код страны должен состоять из двух букв ISO.');
    return null;
  }
  return { completion_value: value, complexity_score: complexity, completion_country_code: country || null };
}

export default function EventApplicationsPanel({ canManageTrust = false }: { canManageTrust?: boolean }) {
  const [items, setItems] = useState<EventApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: apps, error: appsError } = await supabase
        .from('event_applications')
        .select('id,user_id,event_id,status,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (appsError) throw appsError;

      const rows = apps ?? [];
      const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
      const eventIds = [...new Set(rows.map((row) => String(row.event_id)))];
      const [profilesResult, eventsResult] = await Promise.all([
        userIds.length
          ? supabase.from('profiles').select('id,user_id,full_name,avatar_url,segment,level,reliability,kyc_level,location').in('user_id', userIds)
          : Promise.resolve({ data: [], error: null } as never),
        eventIds.length
          ? supabase.from('global_events').select('id,title,region,country_code,audience_segment').in('id', eventIds)
          : Promise.resolve({ data: [], error: null } as never),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (eventsResult.error) throw eventsResult.error;

      let kycRows: Record<string, unknown>[] = [];
      const profileIds = (profilesResult.data ?? []).map((profile: Record<string, unknown>) => String(profile.id));
      if (canManageTrust && profileIds.length) {
        const { data: submissions, error: kycError } = await supabase
          .from('kyc_submissions')
          .select('profile_id,level,status,created_at')
          .in('profile_id', profileIds)
          .order('created_at', { ascending: false });
        if (kycError) console.warn('[event-applications] KYC status unavailable:', kycError.message);
        else kycRows = (submissions ?? []) as unknown as Record<string, unknown>[];
      }

      const latestKyc = new Map<string, { status: string; level: number }>();
      for (const submission of kycRows) {
        const id = String(submission.profile_id);
        if (!latestKyc.has(id)) latestKyc.set(id, {
          status: String(submission.status),
          level: Number(submission.level) || 1,
        });
      }

      const profiles = new Map((profilesResult.data ?? []).map((profile: Record<string, unknown>) => [String(profile.user_id), profile]));
      const events = new Map((eventsResult.data ?? []).map((event: Record<string, unknown>) => [String(event.id), event]));
      setItems(rows.map((row: Record<string, unknown>) => {
        const rawProfile = profiles.get(String(row.user_id));
        const rawEvent = events.get(String(row.event_id));
        const profile: Profile | null = rawProfile ? {
          id: String(rawProfile.id),
          full_name: typeof rawProfile.full_name === 'string' ? rawProfile.full_name : null,
          avatar_url: typeof rawProfile.avatar_url === 'string' ? rawProfile.avatar_url : null,
          segment: String(rawProfile.segment) === 'elite' ? 'elite' : 'working',
          level: Math.max(1, Math.min(6, Number(rawProfile.level ?? 1) || 1)),
          reliability: Math.max(0, Math.min(100, rawProfile.reliability == null ? 100 : (Number(rawProfile.reliability) || 0))),
          kyc_level: Math.max(0, Math.min(3, Number(rawProfile.kyc_level ?? 0) || 0)),
          kyc_status: latestKyc.get(String(rawProfile.id))?.status ?? null,
          kyc_submission_level: latestKyc.get(String(rawProfile.id))?.level ?? null,
          location: typeof rawProfile.location === 'string' ? rawProfile.location : null,
        } : null;
        const event: GlobalEvent | null = rawEvent ? {
          id: String(rawEvent.id),
          title: String(rawEvent.title ?? 'Закрытое мероприятие'),
          region: String(rawEvent.region ?? ''),
          country_code: typeof rawEvent.country_code === 'string' ? rawEvent.country_code : null,
          audience_segment: rawEvent.audience_segment === 'elite' || rawEvent.audience_segment === 'working' ? rawEvent.audience_segment : 'all',
        } : null;
        return {
          id: String(row.id), user_id: String(row.user_id), event_id: String(row.event_id),
          status: (['pending', 'approved', 'rejected', 'completed'].includes(String(row.status)) ? row.status : 'pending') as Status,
          created_at: String(row.created_at), updated_at: String(row.updated_at), profile, event,
        };
      }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Не удалось загрузить заявки на мероприятия.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageTrust]);

  useEffect(() => {
    // Async data synchronization on mount; load manages its loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);


  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.profile?.full_name, item.profile?.location, item.event?.title, item.event?.region, item.event?.audience_segment]
      .filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(q)));
  }, [items, query]);

  async function updateStatus(item: EventApplication, status: Status) {
    if (busyId) return;
    let detail: ReturnType<typeof completionDetails> = null;
    if (status === 'completed') {
      if (item.status !== 'approved') return;
      detail = completionDetails();
      if (!detail) return;
    }
    setBusyId(item.id);
    setNotice(null);
    const previous = items;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status } : entry));
    const payload = status === 'completed' && detail ? { status, ...detail } : { status };
    const { data, error: updateError } = await supabase
      .from('event_applications')
      .update(payload)
      .eq('id', item.id)
      .select('id,status')
      .maybeSingle();
    setBusyId(null);
    if (updateError || !data) {
      setItems(previous);
      setNotice({ kind: 'error', text: updateError?.message ?? 'Нет прав на изменение заявки.' });
      return;
    }
    setNotice({ kind: 'success', text: status === 'completed' ? 'Мероприятие завершено. Начисления обработаны сервером.' : 'Статус заявки обновлён.' });
    if (status === 'completed') await load(true);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] shadow-[0_20px_90px_-50px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-amber-200/70"><Calendar size={14} /> Event moderation</p>
          <h2 className="mt-1 text-lg font-medium text-zinc-100">Заявки на тусовки</h2>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-200/30 hover:text-amber-100 disabled:opacity-50">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Обновить
        </button>
      </div>
      <div className="border-b border-white/[0.06] p-4 sm:px-6">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по имени, мероприятию или региону…" className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-200/35" />
        </div>
      </div>
      {notice && <div role="status" className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-sm sm:mx-6 ${notice.kind === 'error' ? 'border-rose-400/25 bg-rose-400/[0.06] text-rose-200' : 'border-amber-200/20 bg-amber-200/[0.05] text-amber-100'}`}>{notice.text}</div>}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-zinc-500"><Loader2 size={18} className="animate-spin" /> Загружаем заявки…</div>
      ) : error ? (
        <div className="m-4 rounded-xl border border-rose-400/25 bg-rose-400/[0.05] p-5 text-sm text-rose-200 sm:m-6">{error}<button type="button" onClick={() => void load()} className="ml-3 underline">Повторить</button></div>
      ) : visible.length === 0 ? (
        <div className="px-6 py-20 text-center"><p className="text-sm text-zinc-300">Заявок на тусовки пока нет</p><p className="mt-2 text-xs text-zinc-500">Когда резиденты отправят заявки, они появятся здесь.</p></div>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {visible.map((item) => {
            return (
              <li key={item.id} className="flex flex-col gap-4 px-4 py-5 transition hover:bg-white/[0.02] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-200/20 bg-zinc-900 text-amber-100">
                    {item.profile?.avatar_url ? <img src={item.profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-sm">{(item.profile?.full_name ?? 'V').slice(0,1).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">{item.profile?.full_name ?? 'Профиль недоступен'}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{item.profile?.location ?? 'Локация не указана'} · {dateFormatter.format(new Date(item.created_at))}</p>
                    {item.profile && <ResidentTrustBadges
                      segment={item.profile.segment}
                      level={item.profile.level}
                      reliability={item.profile.reliability}
                      kycLevel={item.profile.kyc_level}
                      kycStatus={item.profile.kyc_status}
                      kycSubmissionLevel={item.profile.kyc_submission_level}
                    />}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-2 lg:w-[360px] lg:items-end">
                  <div className="min-w-0 text-left lg:text-right">
                    <p className="truncate text-sm text-amber-100">{item.event?.title ?? 'Мероприятие удалено'}</p>
                    <p className="mt-1 text-xs text-zinc-500">{item.event?.region ?? 'Регион не указан'} · аудитория {item.event?.audience_segment ?? 'all'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <span className={`rounded-full border px-3 py-1 text-xs ${statusMeta[item.status].className}`}>{statusMeta[item.status].title}</span>
                    {item.status === 'pending' && <>
                      <button type="button" onClick={() => void updateStatus(item, 'approved')} disabled={Boolean(busyId)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-amber-100 to-amber-300 px-3.5 py-1.5 text-xs font-medium text-zinc-950 transition hover:brightness-105 disabled:opacity-50"><Check size={14}/> Одобрить</button>
                      <button type="button" onClick={() => void updateStatus(item, 'rejected')} disabled={Boolean(busyId)} className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/25 px-3.5 py-1.5 text-xs text-rose-300 transition hover:bg-rose-400/[0.07] disabled:opacity-50"><X size={14}/> Отклонить</button>
                    </>}
                    {item.status === 'approved' && <button type="button" onClick={() => void updateStatus(item, 'completed')} disabled={Boolean(busyId)} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-200/[0.06] px-3.5 py-1.5 text-xs text-amber-100 transition hover:bg-amber-200/10 disabled:opacity-50">{busyId === item.id ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>} Завершить</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
