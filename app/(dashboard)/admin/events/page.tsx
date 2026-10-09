'use client';

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · TOURS & LEADERBOARD — /admin/events
 *
 * Баллы тура и NPC-конкурентки. Список приходит из rpc admin_list_residents,
 * но имя и аватар настоящих участниц берутся ЖИВЫМИ из профилей —
 * v_member_cards (миграция 20261012), той же визитки, что у v_<таблица>_live.
 * Копия имени из таблицы рейтинга используется только у NPC (у них нет
 * профиля) и как запасной вариант, если визитка не нашлась.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Gamepad2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/app/context/LanguageContext';
import { fetchMemberCards, resolveAvatarUrl, type MemberCard } from '@/lib/memberCards';

/* ───────────────────────── Types ───────────────────────── */

type Lang = 'en' | 'ru' | 'es' | 'pt';

interface Resident {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  tour_points: number;
  is_npc: boolean;
  /** Circle из визитки профиля (у NPC нет) */
  circle_title?: string | null;
}

type Toast = { kind: 'ok' | 'err'; text: string } | null;

/* ───────────────────────── i18n ───────────────────────── */

const T = {
  en: {
    eyebrow: 'Admin',
    title: 'Tours & Leaderboard Management',
    subtitle: 'Manage resident points and NPC competitors.',
    total: 'Residents',
    real: 'Real',
    npc: 'NPC',
    search: 'Search by name…',
    addNpc: 'Add NPC competitor',
    colMember: 'Resident',
    colPoints: 'Points',
    colActions: 'Quick adjust',
    npcBadge: 'NPC',
    empty: 'No residents found.',
    forbidden: 'Access denied',
    forbiddenHint: 'This section is available to owner and admin only.',
    loadError: 'Failed to load residents.',
    retry: 'Retry',
    saved: 'Saved',
    saveError: 'Failed to save points',
    deleteNpc: 'Delete NPC',
    confirmDelete: 'Delete this NPC from the leaderboard?',
    deleted: 'NPC deleted',
    modalTitle: 'New NPC competitor',
    modalHint: 'Appears on the leaderboard like a regular resident.',
    name: 'Name',
    namePh: 'e.g. Sofia M.',
    avatar: 'Avatar URL (optional)',
    avatarPh: 'https://…',
    startPoints: 'Starting points',
    cancel: 'Cancel',
    create: 'Create',
    created: 'NPC created',
    createError: 'Failed to create NPC',
    nameRequired: 'Name is required',
    avatarInvalid: 'Avatar URL must start with https://',
    noName: 'No name',
  },
  ru: {
    eyebrow: 'Админ',
    title: 'Управление турами и рейтингом',
    subtitle: 'Управление баллами участниц и NPC-конкурентками',
    total: 'Резидентов',
    real: 'Реальных',
    npc: 'NPC',
    search: 'Поиск по имени…',
    addNpc: 'Добавить NPC-конкурентку',
    colMember: 'Участница',
    colPoints: 'Баллы',
    colActions: 'Быстрая правка',
    npcBadge: 'NPC',
    empty: 'Участницы не найдены.',
    forbidden: 'Доступ запрещён',
    forbiddenHint: 'Раздел доступен только владельцу и администратору.',
    loadError: 'Не удалось загрузить участниц.',
    retry: 'Повторить',
    saved: 'Сохранено',
    saveError: 'Не удалось сохранить баллы',
    deleteNpc: 'Удалить NPC',
    confirmDelete: 'Удалить эту NPC из рейтинга?',
    deleted: 'NPC удалена',
    modalTitle: 'Новая NPC-конкурентка',
    modalHint: 'Появится в рейтинге как обычная резидентка.',
    name: 'Имя',
    namePh: 'например, София М.',
    avatar: 'Ссылка на аватар (необязательно)',
    avatarPh: 'https://…',
    startPoints: 'Стартовые баллы',
    cancel: 'Отмена',
    create: 'Создать',
    created: 'NPC создана',
    createError: 'Не удалось создать NPC',
    nameRequired: 'Укажите имя',
    avatarInvalid: 'Ссылка должна начинаться с https://',
    noName: 'Без имени',
  },
  es: {
    eyebrow: 'Admin',
    title: 'Gestión de tours y clasificación',
    subtitle: 'Gestión de puntos de las residentes y competidoras NPC',
    total: 'Residentes',
    real: 'Reales',
    npc: 'NPC',
    search: 'Buscar por nombre…',
    addNpc: 'Añadir competidora NPC',
    colMember: 'Residente',
    colPoints: 'Puntos',
    colActions: 'Ajuste rápido',
    npcBadge: 'NPC',
    empty: 'No se encontraron residentes.',
    forbidden: 'Acceso denegado',
    forbiddenHint: 'Esta sección solo está disponible para owner y admin.',
    loadError: 'No se pudieron cargar las residentes.',
    retry: 'Reintentar',
    saved: 'Guardado',
    saveError: 'No se pudieron guardar los puntos',
    deleteNpc: 'Eliminar NPC',
    confirmDelete: '¿Eliminar esta NPC de la clasificación?',
    deleted: 'NPC eliminada',
    modalTitle: 'Nueva competidora NPC',
    modalHint: 'Aparece en la clasificación como una residente normal.',
    name: 'Nombre',
    namePh: 'p. ej. Sofía M.',
    avatar: 'URL del avatar (opcional)',
    avatarPh: 'https://…',
    startPoints: 'Puntos iniciales',
    cancel: 'Cancelar',
    create: 'Crear',
    created: 'NPC creada',
    createError: 'No se pudo crear la NPC',
    nameRequired: 'El nombre es obligatorio',
    avatarInvalid: 'La URL debe empezar con https://',
    noName: 'Sin nombre',
  },
  pt: {
    eyebrow: 'Admin',
    title: 'Gestão de tours e classificação',
    subtitle: 'Gestão de pontos das residentes e competidoras NPC',
    total: 'Residentes',
    real: 'Reais',
    npc: 'NPC',
    search: 'Buscar por nome…',
    addNpc: 'Adicionar competidora NPC',
    colMember: 'Residente',
    colPoints: 'Pontos',
    colActions: 'Ajuste rápido',
    npcBadge: 'NPC',
    empty: 'Nenhuma residente encontrada.',
    forbidden: 'Acesso negado',
    forbiddenHint: 'Esta seção está disponível apenas para owner e admin.',
    loadError: 'Não foi possível carregar as residentes.',
    retry: 'Tentar novamente',
    saved: 'Salvo',
    saveError: 'Não foi possível salvar os pontos',
    deleteNpc: 'Excluir NPC',
    confirmDelete: 'Excluir esta NPC da classificação?',
    deleted: 'NPC excluída',
    modalTitle: 'Nova competidora NPC',
    modalHint: 'Aparece na classificação como uma residente comum.',
    name: 'Nome',
    namePh: 'ex.: Sofia M.',
    avatar: 'URL do avatar (opcional)',
    avatarPh: 'https://…',
    startPoints: 'Pontos iniciais',
    cancel: 'Cancelar',
    create: 'Criar',
    created: 'NPC criada',
    createError: 'Não foi possível criar a NPC',
    nameRequired: 'O nome é obrigatório',
    avatarInvalid: 'A URL deve começar com https://',
    noName: 'Sem nome',
  },
} as const;

type Dict = (typeof T)[Lang];

const LOCALES: Record<Lang, string> = { en: 'en-US', ru: 'ru-RU', es: 'es-ES', pt: 'pt-BR' };
const MAX_POINTS = 1_000_000;

/* ───────────────────────── Helpers ───────────────────────── */

function initials(name: string | null): string {
  if (!name) return '•';
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '•';
}

function Avatar({ src, name, size = 40 }: { src: string | null; name: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const style = { width: size, height: size };

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={style}
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
        draggable={false}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: Math.max(11, size * 0.34) }}
      className="flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 font-medium text-amber-200 ring-1 ring-zinc-700"
    >
      {initials(name)}
    </div>
  );
}

function clampPoints(n: number) {
  return Math.min(MAX_POINTS, Math.max(0, Math.round(n)));
}

/**
 * Живые имена: настоящим участницам — имя, аватар и Circle из профиля
 * (v_member_cards), NPC — как сохранено. Визитки нет (профиль удалён или
 * миграция 20261012 не применена) — остаётся то, что вернула RPC.
 */
async function withLiveNames(list: Resident[]): Promise<Resident[]> {
  const ids = list.filter((r) => !r.is_npc).map((r) => r.id);
  try {
    const cards = ids.length ? await fetchMemberCards(ids) : new Map<string, MemberCard>();
    return list.map((r) => {
      const card = r.is_npc ? undefined : cards.get(r.id);
      if (!card) return { ...r, avatar_url: resolveAvatarUrl(r.avatar_url) };
      return {
        ...r,
        full_name: card.name ?? r.full_name, // имя из профиля важнее копии
        avatar_url: card.avatarUrl, //          удалила аватар в профиле — старый не всплывёт
        circle_title: card.circleTitle,
      };
    });
  } catch (e) {
    console.warn('[admin/events] v_member_cards недоступна — имена из rpc:', e);
    return list.map((r) => ({ ...r, avatar_url: resolveAvatarUrl(r.avatar_url) }));
  }
}

/* ───────────────────────── Page ───────────────────────── */

export default function AdminEventsPage() {
  const { lang: rawLang } = useLanguage();
  
  const lang: Lang = (['en', 'ru', 'es', 'pt'] as const).includes(rawLang?.toLowerCase() as Lang) 
    ? (rawLang.toLowerCase() as Lang) 
    : 'ru';
    
  const t = T[lang];
  const nf = useMemo(() => new Intl.NumberFormat(LOCALES[lang]), [lang]);

  const [rows, setRows] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'ok' | 'forbidden' | 'error'>('ok');
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, number>>({});
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Per-row request sequence: only the latest response may overwrite the row
  const seqRef = useRef<Record<string, number>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_residents');
    if (error) {
      setStatus(error.code === '42501' || /forbidden/i.test(error.message) ? 'forbidden' : 'error');
      setRows([]);
    } else {
      const list = ((data ?? []) as Resident[]).map((r) => ({ ...r, tour_points: Number(r.tour_points ?? 0) }));
      setRows(await withLiveNames(list));
      setStatus('ok');
      setDrafts({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load]);

  /* ── Points update (optimistic) ── */
  const updatePoints = useCallback(
    async (id: string, change: { points: number } | { delta: number }) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;

      const optimistic =
        'points' in change ? clampPoints(change.points) : clampPoints(row.tour_points + change.delta);
      if (optimistic === row.tour_points) return;

      const seq = (seqRef.current[id] ?? 0) + 1;
      seqRef.current[id] = seq;

      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, tour_points: optimistic } : r)));
      setPending((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));

      const params =
        'points' in change
          ? { p_profile_id: id, p_points: optimistic }
          : { p_profile_id: id, p_delta: Math.round(change.delta) };

      const { data, error } = await supabase.rpc('admin_update_tour_points', params);

      setPending((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 1) - 1) }));

      if (error) {
        showToast({ kind: 'err', text: `${t.saveError}: ${error.message}` });
        await load(); // restore the authoritative state
        return;
      }

      if (seqRef.current[id] === seq) {
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, tour_points: Number(data) } : r)));
        setSavedFlash((s) => ({ ...s, [id]: true }));
        setTimeout(() => setSavedFlash((s) => ({ ...s, [id]: false })), 1200);
      }
    },
    [rows, load, showToast, t.saveError],
  );

  const commitDraft = (id: string) => {
    const raw = drafts[id];
    if (raw === undefined) return;
    setDrafts(({ [id]: _, ...rest }) => rest);
    const n = Number(raw.replace(/\s/g, ''));
    if (raw.trim() === '' || !Number.isFinite(n)) return;
    updatePoints(id, { points: n });
  };

  /* ── Delete NPC ── */
  const deleteNpc = async (r: Resident) => {
    if (!r.is_npc || !window.confirm(`${t.confirmDelete}\n\n${r.full_name ?? ''}`)) return;
    const { error } = await supabase.rpc('admin_delete_npc', { p_profile_id: r.id });
    if (error) {
      showToast({ kind: 'err', text: error.message });
      return;
    }
    setRows((rs) => rs.filter((x) => x.id !== r.id));
    showToast({ kind: 'ok', text: t.deleted });
  };

  /* ── Derived ── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => (r.full_name ?? '').toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      npc: rows.filter((r) => r.is_npc).length,
      real: rows.filter((r) => !r.is_npc).length,
    }),
    [rows],
  );

  /* ── Forbidden ── */
  if (!loading && status === 'forbidden') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-200/70" strokeWidth={1.25} />
          <h1 className="mt-4 text-lg font-medium text-zinc-100">{t.forbidden}</h1>
          <p className="mt-2 text-sm text-zinc-500">{t.forbiddenHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      {/* ───────────── Header ───────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-200/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200">
              <Gamepad2 className="h-3.5 w-3.5" />
              {t.eyebrow}
            </div>
            <h1 className="font-serif text-3xl font-light tracking-tight text-zinc-50 sm:text-4xl">{t.title}</h1>
            <p className="mt-2 text-sm text-zinc-400">{t.subtitle}</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            disabled={status !== 'ok'}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-200 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-100 disabled:opacity-40"
          >
            <UserPlus className="h-4 w-4" />
            {t.addNpc}
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            { Icon: Users, label: t.total, value: stats.total },
            { Icon: Trophy, label: t.real, value: stats.real },
            { Icon: Bot, label: t.npc, value: stats.npc },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                <Icon className="h-3.5 w-3.5 text-amber-200/70" />
                {label}
              </div>
              <p className="mt-1 text-xl font-light tabular-nums text-zinc-100">{loading ? '—' : nf.format(value)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── Toolbar ───────────── */}
      <div className="mt-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-full border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-200/40"
          />
        </div>
        <button
          onClick={load}
          aria-label={t.retry}
          className="rounded-full border border-zinc-800 p-2.5 text-zinc-400 transition hover:border-amber-200/40 hover:text-amber-200"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ───────────── Table ───────────── */}
      <section className="mt-4 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
        <div className="hidden grid-cols-[2.5rem_1fr_9rem_13rem_2.5rem] items-center gap-4 border-b border-zinc-800/80 px-5 py-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500 md:grid">
          <span>#</span>
          <span>{t.colMember}</span>
          <span>{t.colPoints}</span>
          <span>{t.colActions}</span>
          <span />
        </div>

        {loading && (
          <div className="space-y-px">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                <div className="h-10 w-10 rounded-full bg-zinc-800" />
                <div className="h-4 flex-1 rounded bg-zinc-800" />
                <div className="h-9 w-28 rounded-xl bg-zinc-800" />
              </div>
            ))}
          </div>
        )}

        {!loading && status === 'error' && (
          <div className="p-8 text-center">
            <p className="text-sm text-red-300">{t.loadError}</p>
            <button
              onClick={load}
              className="mt-4 rounded-full border border-amber-200/40 px-5 py-2 text-sm text-amber-200 transition hover:bg-amber-200/10"
            >
              {t.retry}
            </button>
          </div>
        )}

        {!loading && status === 'ok' && filtered.length === 0 && (
          <p className="p-10 text-center text-sm text-zinc-500">{t.empty}</p>
        )}

        {!loading && status === 'ok' && filtered.length > 0 && (
          <ul className="divide-y divide-zinc-800/60">
            {filtered.map((r) => {
              const isPending = (pending[r.id] ?? 0) > 0;
              const draft = drafts[r.id];
              const rank = rows.indexOf(r) + 1;
              return (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-zinc-900/40 md:grid-cols-[2.5rem_1fr_9rem_13rem_2.5rem] md:px-5"
                >
                  {/* Rank */}
                  <span className="hidden font-mono text-sm tabular-nums text-zinc-500 md:block">{rank}</span>

                  {/* Member */}
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={r.avatar_url} name={r.full_name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-100">{r.full_name?.trim() || t.noName}</p>
                      {!r.is_npc && r.circle_title && (
                        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-amber-200/60">{r.circle_title}</p>
                      )}
                      {r.is_npc && (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                          <Bot className="h-3 w-3" />
                          {t.npcBadge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Points input */}
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft ?? String(r.tour_points)}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [r.id]: e.target.value.replace(/[^\d]/g, '') }))
                      }
                      onBlur={() => commitDraft(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        if (e.key === 'Escape') {
                          setDrafts(({ [r.id]: _, ...rest }) => rest);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      aria-label={t.colPoints}
                      className="w-28 rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-3 pr-8 text-right font-mono text-sm tabular-nums text-amber-200 outline-none transition focus:border-amber-200/50 md:w-full"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                      ) : savedFlash[r.id] ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : null}
                    </span>
                  </div>

                  {/* Quick +/- */}
                  <div className="col-span-2 flex items-center gap-1.5 md:col-span-1">
                    {[-10, -1, 1, 10].map((d) => (
                      <button
                        key={d}
                        onClick={() => updatePoints(r.id, { delta: d })}
                        disabled={d < 0 && r.tour_points === 0}
                        className={[
                          'inline-flex h-9 flex-1 items-center justify-center gap-0.5 rounded-xl border text-xs tabular-nums transition disabled:opacity-30',
                          d > 0
                            ? 'border-amber-200/20 bg-amber-200/5 text-amber-200 hover:bg-amber-200/15'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200',
                        ].join(' ')}
                      >
                        {d > 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {Math.abs(d)}
                      </button>
                    ))}
                    {/* Delete (mobile) */}
                    {r.is_npc && (
                      <button
                        onClick={() => deleteNpc(r)}
                        aria-label={t.deleteNpc}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 transition hover:border-red-500/40 hover:text-red-400 md:hidden"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Delete (desktop) */}
                  <div className="hidden justify-end md:flex">
                    {r.is_npc && (
                      <button
                        onClick={() => deleteNpc(r)}
                        aria-label={t.deleteNpc}
                        title={t.deleteNpc}
                        className="rounded-lg p-2 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ───────────── Modal ───────────── */}
      {modalOpen && (
        <NpcModal
          t={t}
          onClose={() => setModalOpen(false)}
          onCreate={async (payload) => {
            const { data, error } = await supabase.rpc('admin_create_npc', payload);
            if (error) return `${t.createError}: ${error.message}`;
            const created = (Array.isArray(data) ? data[0] : data) as Resident | undefined;
            if (created) {
              setRows((rs) =>
                [...rs, { ...created, tour_points: Number(created.tour_points) }].sort(
                  (a, b) => b.tour_points - a.tour_points,
                ),
              );
            }
            setModalOpen(false);
            showToast({ kind: 'ok', text: t.created });
            return null;
          }}
        />
      )}

      {/* ───────────── Toast ───────────── */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm shadow-2xl backdrop-blur-xl ${
              toast.kind === 'ok'
                ? 'border-amber-200/30 bg-zinc-900/90 text-amber-100'
                : 'border-red-500/30 bg-zinc-900/90 text-red-300'
            }`}
          >
            {toast.kind === 'ok' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── NPC Modal ───────────────────────── */

function NpcModal({
  t,
  onClose,
  onCreate,
}: {
  t: Dict;
  onClose: () => void;
  onCreate: (p: { p_full_name: string; p_avatar_url: string | null; p_points: number }) => Promise<string | null>;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [points, setPoints] = useState('0');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const a = avatar.trim();
    if (!n) return setErr(t.nameRequired);
    if (a && !/^https:\/\//i.test(a)) return setErr(t.avatarInvalid);

    setSaving(true);
    setErr(null);
    const result = await onCreate({
      p_full_name: n.slice(0, 80),
      p_avatar_url: a || null,
      p_points: clampPoints(Number(points) || 0),
    });
    setSaving(false);
    if (result) setErr(result);
  };

  const field =
    'w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-200/50';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-50">
              <Bot className="h-5 w-5 text-amber-200" />
              {t.modalTitle}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">{t.modalHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
            aria-label={t.cancel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
          <Avatar src={avatar.trim() || null} name={name || null} size={52} />
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-100">{name.trim() || t.namePh}</p>
            <p className="font-mono text-xs tabular-nums text-amber-200">{clampPoints(Number(points) || 0)}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs text-zinc-400">{t.name}</span>
            <input
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePh}
              className={field}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-zinc-400">{t.avatar}</span>
            <input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder={t.avatarPh}
              inputMode="url"
              className={field}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-zinc-400">{t.startPoints}</span>
            <input
              value={points}
              onChange={(e) => setPoints(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              className={`${field} font-mono tabular-nums text-amber-200`}
            />
          </label>
        </div>

        {err && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{err}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border border-zinc-800 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-900"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-200 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-amber-100 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.create}
          </button>
        </div>
      </form>
    </div>
  );
}