'use client';

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЙТИНГ ТУРА («спринт»)
 * app/(dashboard)/dashboard/tours/page.tsx
 *
 *   Баллы тура начисляет команда в /admin/events. Здесь — лидеры текущей
 *   поездки. Каждый балл тура автоматически входит в Influence Index
 *   («марафон», /dashboard/leaderboard) вместе со штампами, комбо и
 *   патронажем.
 *
 * Данные: rpc get_tour_leaderboard (миграция 20261014_tour_points_influence):
 *   position, full_name, avatar_url, tour_points, is_me — как раньше;
 *   имя и аватар теперь из profiles в момент запроса (не копия);
 *   плюс tour_title, index_points (сколько тур дал в Индекс), influence.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trophy, Crown, Medal, Award, Sparkles, MapPin, Star, RefreshCw, Gem, ArrowUpRight, Flag, Infinity as InfinityIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/context/LanguageContext';
import { resolveAvatarUrl } from '@/lib/memberCards';

/* ───────────────────────── Types ───────────────────────── */

type Lang = 'en' | 'ru' | 'es' | 'pt';

interface LeaderRow {
  position: number;
  full_name: string | null;
  avatar_url: string | null;
  tour_points: number;
  is_me: boolean;
  /* с миграции 20261014 */
  profile_id?: string | null;
  circle_title?: string | null;
  influence?: number | null;
  index_points?: number | null;
  tour_id?: string | null;
  tour_title?: string | null;
}

/* ───────────────────────── i18n ───────────────────────── */

const T = {
  en: {
    eyebrow: 'Voyage Club',
    title: 'The Tour Ranking',
    subtitle:
      'This is where you earn tour points. They decide who leads the trip — and are automatically credited to your global Influence Index.',
    step1: 'Join the tour',
    step2: 'Earn tour points',
    step3: 'Points flow into your Influence Index',
    sprintTitle: 'Sprint · Tour ranking',
    sprintText: 'Points from this trip only. Whoever earns the most leads the tour. Every new tour starts the race afresh.',
    marathonTitle: 'Marathon · Influence Index',
    marathonText:
      'Every tour point stays in your Index for good — alongside stamps, legendary combos and patronage. It sets your Circle and your place in the global ranking.',
    globalLink: 'Global ranking',
    leaderboard: 'Tour leaders',
    top: 'Top 50 · points from this tour',
    currentTour: 'Current tour',
    rank: 'Rank',
    member: 'Resident',
    points: 'Tour points',
    pts: 'pts',
    you: 'You',
    yourPlace: 'Your place in the tour',
    credited: (n: string) => `+${n} to your Influence Index`,
    yourIndex: 'Your Influence Index',
    notRanked: 'No tour points for you yet',
    notRankedHint: 'The club team awards points during the trip — and they go straight into your Influence Index.',
    toTop10: 'to the Top 10',
    empty: 'No points in this tour yet. The first points open the race for the lead — and go straight into the Influence Index.',
    error: 'Failed to load the tour ranking.',
    retry: 'Retry',
    anonymous: 'Resident',
  },
  ru: {
    eyebrow: 'Клуб Voyage',
    title: 'Рейтинг тура',
    subtitle:
      'Здесь вы зарабатываете баллы тура. Они определяют лидера поездки и автоматически зачисляются в ваш Глобальный Индекс Влияния (Influence Index).',
    step1: 'Участвуйте в туре',
    step2: 'Зарабатывайте баллы тура',
    step3: 'Баллы идут в Influence Index',
    sprintTitle: 'Спринт · рейтинг тура',
    sprintText: 'Только баллы этой поездки. Кто набрал больше всех — лидер тура. С каждым новым туром гонка начинается заново.',
    marathonTitle: 'Марафон · Influence Index',
    marathonText:
      'Каждый балл тура навсегда остаётся в вашем Индексе — вместе со штампами, легендарными комбо и патронажем. Он определяет ваш Circle и место в глобальном рейтинге.',
    globalLink: 'Глобальный рейтинг',
    leaderboard: 'Лидеры тура',
    top: 'Топ-50 · баллы этого тура',
    currentTour: 'Текущий тур',
    rank: 'Место',
    member: 'Резидент',
    points: 'Баллы тура',
    pts: 'б.',
    you: 'Вы',
    yourPlace: 'Ваше место в туре',
    credited: (n: string) => `+${n} в ваш Influence Index`,
    yourIndex: 'Ваш Influence Index',
    notRanked: 'В этом туре у вас пока нет баллов',
    notRankedHint: 'Баллы начисляет команда клуба во время поездки — и они сразу идут в ваш Influence Index.',
    toTop10: 'до Топ-10',
    empty: 'В этом туре баллов пока нет. Первые баллы откроют гонку за лидерство — и сразу попадут в Influence Index.',
    error: 'Не удалось загрузить рейтинг тура.',
    retry: 'Повторить',
    anonymous: 'Резидент',
  },
  es: {
    eyebrow: 'Club Voyage',
    title: 'Ranking del tour',
    subtitle:
      'Aquí ganas puntos del tour. Deciden quién lidera el viaje y se suman automáticamente a tu Influence Index global.',
    step1: 'Participa en el tour',
    step2: 'Gana puntos del tour',
    step3: 'Los puntos suman a tu Influence Index',
    sprintTitle: 'Sprint · Ranking del tour',
    sprintText: 'Solo los puntos de este viaje. Quien más suma lidera el tour. Con cada tour nuevo, la carrera empieza de cero.',
    marathonTitle: 'Maratón · Influence Index',
    marathonText:
      'Cada punto del tour queda para siempre en tu Index, junto con los sellos, los combos legendarios y el patronazgo. Define tu Circle y tu lugar en el ranking global.',
    globalLink: 'Ranking global',
    leaderboard: 'Líderes del tour',
    top: 'Top 50 · puntos de este tour',
    currentTour: 'Tour actual',
    rank: 'Puesto',
    member: 'Residente',
    points: 'Puntos del tour',
    pts: 'pts',
    you: 'Tú',
    yourPlace: 'Tu puesto en el tour',
    credited: (n: string) => `+${n} a tu Influence Index`,
    yourIndex: 'Tu Influence Index',
    notRanked: 'Aún no tienes puntos en este tour',
    notRankedHint: 'El equipo del club otorga los puntos durante el viaje, y van directo a tu Influence Index.',
    toTop10: 'para el Top 10',
    empty: 'Aún no hay puntos en este tour. Los primeros abrirán la carrera por el liderato y sumarán al Influence Index.',
    error: 'No se pudo cargar el ranking del tour.',
    retry: 'Reintentar',
    anonymous: 'Residente',
  },
  pt: {
    eyebrow: 'Clube Voyage',
    title: 'Ranking do tour',
    subtitle:
      'Aqui você ganha pontos do tour. Eles definem quem lidera a viagem e são creditados automaticamente no seu Influence Index global.',
    step1: 'Participe do tour',
    step2: 'Ganhe pontos do tour',
    step3: 'Os pontos vão para o seu Influence Index',
    sprintTitle: 'Sprint · Ranking do tour',
    sprintText: 'Só os pontos desta viagem. Quem somar mais lidera o tour. A cada novo tour, a corrida recomeça.',
    marathonTitle: 'Maratona · Influence Index',
    marathonText:
      'Cada ponto do tour fica para sempre no seu Index — junto com carimbos, combos lendários e patronato. Ele define seu Circle e sua posição no ranking global.',
    globalLink: 'Ranking global',
    leaderboard: 'Líderes do tour',
    top: 'Top 50 · pontos deste tour',
    currentTour: 'Tour atual',
    rank: 'Posição',
    member: 'Residente',
    points: 'Pontos do tour',
    pts: 'pts',
    you: 'Você',
    yourPlace: 'Sua posição no tour',
    credited: (n: string) => `+${n} no seu Influence Index`,
    yourIndex: 'Seu Influence Index',
    notRanked: 'Você ainda não tem pontos neste tour',
    notRankedHint: 'A equipe do clube concede os pontos durante a viagem — e eles vão direto para o seu Influence Index.',
    toTop10: 'para o Top 10',
    empty: 'Ainda não há pontos neste tour. Os primeiros abrem a corrida pela liderança — e já entram no Influence Index.',
    error: 'Não foi possível carregar o ranking do tour.',
    retry: 'Tentar novamente',
    anonymous: 'Residente',
  },
} as const;

const LOCALES: Record<Lang, string> = { en: 'en-US', ru: 'ru-RU', es: 'es-ES', pt: 'pt-BR' };

/* ───────────────────────── Podium styles ───────────────────────── */

const PODIUM = {
  1: {
    label: 'gold',
    color: '#c9a961',
    ring: 'ring-[#c9a961]/70',
    glow: 'shadow-[0_0_40px_-8px_rgba(201,169,97,0.55)]',
    gradient: 'from-[#c9a961]/25 via-[#c9a961]/5 to-transparent',
    border: 'border-[#c9a961]/40',
    Icon: Crown,
  },
  2: {
    label: 'silver',
    color: '#c7ccd4',
    ring: 'ring-[#c7ccd4]/60',
    glow: 'shadow-[0_0_32px_-10px_rgba(199,204,212,0.45)]',
    gradient: 'from-[#c7ccd4]/20 via-[#c7ccd4]/5 to-transparent',
    border: 'border-[#c7ccd4]/30',
    Icon: Medal,
  },
  3: {
    label: 'bronze',
    color: '#cd8a52',
    ring: 'ring-[#cd8a52]/60',
    glow: 'shadow-[0_0_32px_-10px_rgba(205,138,82,0.45)]',
    gradient: 'from-[#cd8a52]/20 via-[#cd8a52]/5 to-transparent',
    border: 'border-[#cd8a52]/30',
    Icon: Award,
  },
} as const;

/* ───────────────────────── Helpers ───────────────────────── */

function initials(name: string | null): string {
  if (!name) return '•';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '•';
}

function Avatar({
  src,
  name,
  size = 40,
  ringClass = 'ring-white/10',
}: {
  src: string | null;
  name: string | null;
  size?: number;
  ringClass?: string;
}) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ring-2 ${ringClass}`}
        draggable={false}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: Math.max(11, size * 0.34) }}
      className={`flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 font-medium tracking-wide text-[#c9a961] ring-2 ${ringClass}`}
    >
      {initials(name)}
    </div>
  );
}

/** Ключ строки: при равных баллах позиции совпадают, поэтому — по профилю */
const rowKey = (r: LeaderRow) => r.profile_id ?? `${r.position}-${r.full_name ?? ''}`;

/* ───────────────────────── Page ───────────────────────── */

export default function ToursPage() {
  const { lang } = useLanguage();

  // Приводим lang к нужному типу и защищаемся от неожиданных значений
  const currentLang: Lang = (['en', 'ru', 'es', 'pt'] as const).includes(lang?.toLowerCase() as Lang)
    ? (lang.toLowerCase() as Lang)
    : 'ru';

  const t = T[currentLang];
  const nf = useMemo(() => new Intl.NumberFormat(LOCALES[currentLang]), [currentLang]);

  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);

    // Имя и аватар приходят из profiles (миграция 20261014) — всегда актуальные
    const { data, error: rpcError } = await supabase.rpc('get_tour_leaderboard', { p_limit: 50 });

    if (rpcError) {
      console.error('[tours] leaderboard error:', rpcError.message);
      if (!silent) {
        setError(true);
        setRows([]);
      }
    } else {
      setRows(
        ((data ?? []) as LeaderRow[]).map((r) => ({
          ...r,
          position: Number(r.position),
          tour_points: Number(r.tour_points ?? 0),
          index_points: r.index_points == null ? null : Number(r.index_points),
          influence: r.influence == null ? null : Number(r.influence),
          avatar_url: resolveAvatarUrl(r.avatar_url),
        })),
      );
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // вернулась на вкладку — тихо обновляем: баллы могли начислить, имя — смениться
    const onVisible = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  // RPC returns top-50 + the current user's row (even if outside top-50)
  const top = useMemo(() => rows.filter((r) => r.position <= 50), [rows]);
  const me = useMemo(() => rows.find((r) => r.is_me) ?? null, [rows]);
  const podium = top.slice(0, 3);
  const rest = top.slice(3);
  const tourTitle = rows.find((r) => r.tour_title)?.tour_title ?? null;
  // десятая строка (при равных баллах позиция «10» может не встретиться)
  const tenth = top.length >= 10 ? top[9] : null;
  const showPinnedMe = !loading && !error && (!me || me.position > 10);
  const gapToTop10 = me && tenth && me.position > 10 ? Math.max(tenth.tour_points - me.tour_points, 1) : null;

  const displayName = (r: LeaderRow) => r.full_name?.trim() || t.anonymous;

  return (
    <div className={`mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6 ${showPinnedMe ? 'pb-56 md:pb-40' : 'pb-24 md:pb-12'}`}>
      {/* ───────────── Hero ───────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c9a961]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[#c9a961]/5 blur-3xl" />
        <Trophy
          className="pointer-events-none absolute -right-6 bottom-0 h-40 w-40 text-[#c9a961]/[0.06] sm:h-56 sm:w-56"
          strokeWidth={1}
        />

        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c9a961]/30 bg-[#c9a961]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-[#c9a961]">
            <Sparkles className="h-3.5 w-3.5" />
            {t.eyebrow}
          </div>
          <h1 className="font-serif text-3xl font-light tracking-tight text-white sm:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">{t.subtitle}</p>

          <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { Icon: MapPin, text: t.step1 },
              { Icon: Star, text: t.step2 },
              { Icon: Gem, text: t.step3 },
            ].map(({ Icon, text }, i) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 backdrop-blur"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#c9a961]/10 text-[#c9a961]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-neutral-200">
                  <span className="mr-1.5 text-[#c9a961]/70">0{i + 1}</span>
                  {text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── Спринт и марафон ───────────── */}
      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-300">
            <Flag className="h-4 w-4 text-[#c9a961]" strokeWidth={1.5} />
            {t.sprintTitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">{t.sprintText}</p>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-[#c9a961]/25 bg-gradient-to-br from-[#c9a961]/[0.07] via-neutral-950 to-neutral-950 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[#c9a961]">
            <InfinityIcon className="h-4 w-4" strokeWidth={1.5} />
            {t.marathonTitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">{t.marathonText}</p>
          <Link
            href="/dashboard/leaderboard"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#c9a961]/40 px-3.5 py-1.5 text-xs text-[#c9a961] transition hover:bg-[#c9a961]/10"
          >
            {t.globalLink}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ───────────── Leaderboard ───────────── */}
      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-medium text-white sm:text-2xl">{t.leaderboard}</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-500">{t.top}</p>
            {tourTitle && (
              <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-neutral-300">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#c9a961]" />
                <span className="text-neutral-500">{t.currentTour}:</span>
                <span className="truncate text-white">{tourTitle}</span>
              </p>
            )}
          </div>
          {!loading && (
            <button
              onClick={() => load()}
              aria-label={t.retry}
              className="shrink-0 rounded-full border border-white/10 p-2 text-neutral-400 transition hover:border-[#c9a961]/40 hover:text-[#c9a961]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading && <LeaderboardSkeleton />}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-red-300">{t.error}</p>
            <button
              onClick={() => load()}
              className="mt-4 rounded-full border border-[#c9a961]/40 px-5 py-2 text-sm text-[#c9a961] transition hover:bg-[#c9a961]/10"
            >
              {t.retry}
            </button>
          </div>
        )}

        {!loading && !error && top.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-10 text-center">
            <Trophy className="mx-auto h-10 w-10 text-[#c9a961]/50" strokeWidth={1.25} />
            <p className="mx-auto mt-4 max-w-md text-sm text-neutral-400">{t.empty}</p>
          </div>
        )}

        {!loading && !error && top.length > 0 && (
          <>
            {/* Podium: top-3 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
              {podium.map((r, i) => {
                const p = PODIUM[Math.min(Math.max(r.position, 1), 3) as 1 | 2 | 3];
                const slot = i + 1; // место на пьедестале (при равных баллах позиции совпадают)
                return (
                  <div
                    key={rowKey(r)}
                    className={[
                      'relative overflow-hidden rounded-3xl border bg-neutral-950 p-5 text-center',
                      p.border,
                      p.glow,
                      slot === 1 ? 'sm:order-2 sm:pb-8 sm:pt-8' : slot === 2 ? 'sm:order-1' : 'sm:order-3',
                      r.is_me ? 'outline outline-1 outline-offset-2 outline-[#c9a961]/60' : '',
                    ].join(' ')}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${p.gradient}`} />
                    <div className="relative flex flex-row items-center gap-4 sm:flex-col sm:gap-0">
                      <div className="relative">
                        <Avatar
                          src={r.avatar_url}
                          name={r.full_name}
                          size={slot === 1 ? 84 : 68}
                          ringClass={p.ring}
                        />
                        <span
                          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-black text-xs font-semibold text-black"
                          style={{ backgroundColor: p.color }}
                        >
                          {r.position}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 text-left sm:mt-4 sm:text-center">
                        <div className="flex items-center gap-1.5 sm:justify-center">
                          <p.Icon className="h-4 w-4 shrink-0" style={{ color: p.color }} />
                          <p className="truncate text-sm font-medium text-white sm:text-base">{displayName(r)}</p>
                        </div>
                        {r.is_me && (
                          <span className="mt-1 inline-block rounded-full bg-[#c9a961]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#c9a961]">
                            {t.you}
                          </span>
                        )}
                        <p
                          className="mt-2 font-serif text-2xl font-light tabular-nums sm:text-3xl"
                          style={{ color: p.color }}
                        >
                          {nf.format(r.tour_points)}
                          <span className="ml-1 text-xs text-neutral-500">{t.pts}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Positions 4–50 */}
            {rest.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/60">
                <div className="grid grid-cols-[3rem_1fr_auto] gap-3 border-b border-white/5 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:px-6">
                  <span>{t.rank}</span>
                  <span>{t.member}</span>
                  <span className="text-right">{t.points}</span>
                </div>
                <ul>
                  {rest.map((r) => (
                    <li
                      key={rowKey(r)}
                      className={[
                        'grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-b border-white/[0.04] px-4 py-3 last:border-b-0 sm:px-6',
                        r.is_me ? 'bg-[#c9a961]/[0.08]' : 'transition-colors hover:bg-white/[0.02]',
                      ].join(' ')}
                    >
                      <span
                        className={`font-mono text-sm tabular-nums ${r.is_me ? 'text-[#c9a961]' : 'text-neutral-500'}`}
                      >
                        #{r.position}
                      </span>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          src={r.avatar_url}
                          name={r.full_name}
                          size={36}
                          ringClass={r.is_me ? 'ring-[#c9a961]/60' : 'ring-white/10'}
                        />
                        <span className={`truncate text-sm ${r.is_me ? 'text-white' : 'text-neutral-200'}`}>
                          {displayName(r)}
                        </span>
                        {r.is_me && (
                          <span className="shrink-0 rounded-full bg-[#c9a961]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#c9a961]">
                            {t.you}
                          </span>
                        )}
                      </div>
                      <span className="text-right text-sm tabular-nums text-neutral-100">
                        {nf.format(r.tour_points)}
                        <span className="ml-1 text-xs text-neutral-500">{t.pts}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* ───────────── Pinned "my place" (if not in Top-10) ─────────────
          На телефоне — над круглой кнопкой меню (Sidebar, bottom-5 left-5),
          на десктопе — правее сайдбара. */}
      {showPinnedMe && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:px-6 md:left-72 md:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto mx-auto max-w-4xl rounded-2xl border border-[#c9a961]/30 bg-neutral-950/90 p-4 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {me ? (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#c9a961]/10">
                  <span className="text-[9px] uppercase tracking-wider text-[#c9a961]/70">{t.rank}</span>
                  <span className="font-mono text-base font-semibold tabular-nums text-[#c9a961]">
                    #{me.position}
                  </span>
                </div>
                <span className="hidden sm:block">
                  <Avatar src={me.avatar_url} name={me.full_name} size={40} ringClass="ring-[#c9a961]/60" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] uppercase tracking-[0.18em] text-neutral-500">{t.yourPlace}</p>
                  <p className="truncate text-sm text-white">{displayName(me)}</p>
                  {gapToTop10 !== null && (
                    <p className="mt-0.5 text-xs text-neutral-400">
                      +{nf.format(gapToTop10)} {t.pts} {t.toTop10}
                    </p>
                  )}
                  {me.index_points != null && me.index_points > 0 && (
                    <p className="mt-0.5 flex items-start gap-1 text-xs text-[#c9a961]/80">
                      <Gem className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{t.credited(nf.format(me.index_points))}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-serif text-2xl font-light tabular-nums text-[#c9a961]">
                    {nf.format(me.tour_points)}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">{t.points}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c9a961]/10 text-[#c9a961]">
                  <Trophy className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white">{t.notRanked}</p>
                  <p className="mt-0.5 text-xs text-neutral-400">{t.notRankedHint}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Skeleton ───────────────────────── */

function LeaderboardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-3xl border border-white/5 bg-neutral-900/60 sm:h-48" />
        ))}
      </div>
      <div className="mt-6 space-y-2 rounded-3xl border border-white/5 bg-neutral-950/60 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-8 rounded bg-neutral-800" />
            <div className="h-9 w-9 rounded-full bg-neutral-800" />
            <div className="h-4 flex-1 rounded bg-neutral-800" />
            <div className="h-4 w-12 rounded bg-neutral-800" />
          </div>
        ))}
      </div>
    </div>
  );
}