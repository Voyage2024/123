"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · GAMIFICATION — страница управления
 * app/(dashboard)/admin/gamification/page.tsx
 *
 * Данные (браузерный Supabase-клиент под сессией персонала, видимость
 * строк определяет RLS):
 *   profiles (role = resident)  — имена, аватары, статус аппрува
 *   v_global_leaderboard        — Индекс, Circle, позиция, счётчики
 *   game_destinations           — цензы и веса направлений
 *   game_combos / game_circles  — легендарные комбо и пороги Circle
 *
 * Realtime: правки настроек (в том числе от другого админа) и новые
 * штампы приходят по подписке; после них лидерборд перечитывается,
 * так что Индекс и Circle резидентов всегда совпадают с базой.
 *
 * i18n: строки страницы — в словаре админки (useAdminI18n). В state не
 * кладутся переведённые строки, поэтому смена языка не требует загрузки.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { AlertTriangle, Loader2, Radio, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import GamificationAdminClient, {
  cormorant,
  useAdminI18n,
  type AdminResident,
  type ExtraDestination,
  type SavedRow,
} from "./GamificationAdminClient";
import {
  TIERS,
  circleFor,
  isDestId,
  isTier,
  normalizeCircleKey,
  num,
  resolveCircles,
  resolveCombos,
  resolveDestinations,
  type CircleConfig,
  type GameCircleRow,
  type GameComboRow,
  type GameDestinationRow,
  type LeaderboardRow,
} from "@/lib/gamification";

/** Бакет Supabase Storage, если в profiles.avatar_url лежит путь, а не URL */
const AVATAR_BUCKET = "avatars";

const STANDINGS_DEBOUNCE_MS = 500;

/* ── Типы ─────────────────────────────────────────────────────────── */

type ProfileRow = { id: string } & Record<string, unknown>;

type Raw = {
  profiles: ProfileRow[];
  leaderboard: LeaderboardRow[];
  destinations: GameDestinationRow[];
  combos: GameComboRow[];
  circles: GameCircleRow[];
};

const EMPTY: Raw = { profiles: [], leaderboard: [], destinations: [], combos: [], circles: [] };

type LoadMode = "initial" | "refresh" | "silent";

/** message: null → текста от Supabase нет, UI покажет t.networkError. */
type LoadError = { message: string | null; code: string | null } | null;

/* ── Резиденты: имя, аватар, статус ───────────────────────────────── */

function firstText(...values: unknown[]) {
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

function resolveAvatar(raw: unknown): string | null {
  const value = firstText(raw);
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  // в профиле хранится путь внутри бакета — собираем публичный URL
  const path = value.replace(/^\/+/, "").replace(new RegExp(`^${AVATAR_BUCKET}/`), "");
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl || null;
}

function residentName(p: ProfileRow, lb: LeaderboardRow | undefined, email: string | null) {
  const parts = [p.first_name, p.last_name]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ");
  return (
    firstText(p.full_name, lb?.full_name, p.display_name, p.name, parts, p.nickname, p.username) ??
    (email ? email.split("@")[0] : undefined) ??
    `Resident · ${p.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`
  );
}

function buildResidents(
  profiles: ProfileRow[],
  leaderboard: LeaderboardRow[],
  circles: CircleConfig[],
): AdminResident[] {
  const stats = new Map(leaderboard.map((s) => [s.profile_id, s]));

  return profiles
    .map((p): AdminResident => {
      const s = stats.get(p.id);
      const email = firstText(p.email) ?? null;
      const influence = num(s?.total_influence) ?? 0;
      // Circle — из вью (единый расчёт в БД); если вью старая, считаем по тем же порогам
      const fromDb = normalizeCircleKey(s?.circle_key);
      const circle = circles.find((c) => c.key === fromDb) ?? circleFor(influence, circles);

      return {
        profileId: p.id,
        fullName: residentName(p, s, email),
        email,
        avatarUrl: resolveAvatar(p.avatar_url ?? s?.avatar_url),
        approval: firstText(p.status) ?? null,
        influence,
        level: circle.level,
        circleKey: circle.key,
        stampsCount: num(s?.stamps_count) ?? 0,
        destinationsCount: num(s?.destinations_count) ?? 0,
        combosCompleted: num(s?.combos_completed) ?? 0,
        position: num(s?.position) ?? null,
      };
    })
    .sort((a, b) => b.influence - a.influence || a.fullName.localeCompare(b.fullName));
}

function buildExtras(rows: GameDestinationRow[]): ExtraDestination[] {
  return rows
    .filter((r) => !isDestId(r.id))
    .map((r) => {
      const tier = isTier(r.visa_tier) ? r.visa_tier : "free";
      return {
        id: r.id,
        name: firstText(r.name) ?? r.id,
        tier,
        points: num(r.points) ?? TIERS[tier].points,
        multiplier: num(r.multiplier) ?? TIERS[tier].multiplier,
        active: r.active !== false,
      };
    });
}

/* ── Патчи из realtime / после сохранения ─────────────────────────── */

function upsertBy<T, K extends keyof T>(list: T[], row: T, key: K): T[] {
  const i = list.findIndex((x) => x[key] === row[key]);
  if (i === -1) return [...list, row];
  const next = list.slice();
  next[i] = { ...list[i], ...row };
  return next;
}

function applyPayload<T extends Record<string, unknown>, K extends keyof T>(
  list: T[],
  payload: RealtimePostgresChangesPayload<T>,
  key: K,
): T[] {
  if (payload.eventType === "DELETE") {
    const old = payload.old as Partial<T>;
    return list.filter((x) => x[key] !== old[key]);
  }
  return upsertBy(list, payload.new as T, key);
}

function isSchemaError(error: LoadError) {
  if (!error) return false;
  return (
    ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

/* ── Страница ─────────────────────────────────────────────────────── */

export default function AdminGamificationPage() {
  const { loading: authLoading } = useAuth();
  const { t, nf } = useAdminI18n();

  const [raw, setRaw] = useState<Raw>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<LoadError>(null);
  const [hasData, setHasData] = useState(false);
  const [live, setLive] = useState(false);

  // Защита от гонок и записи в state после размонтирования.
  const requestId = useRef(0);
  const mounted = useRef(true);
  const standingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (standingsTimer.current) clearTimeout(standingsTimer.current);
    };
  }, []);

  const load = useCallback(async (mode: LoadMode = "initial") => {
    const id = ++requestId.current;
    const isCurrent = () => mounted.current && id === requestId.current;

    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    setError(null);

    try {
      const [profilesRes, statsRes, destRes, comboRes, circleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "resident").order("full_name", { ascending: true }),
        supabase.from("v_global_leaderboard").select("*"),
        supabase.from("game_destinations").select("*").order("sort_order", { ascending: true }),
        supabase.from("game_combos").select("*").order("sort_order", { ascending: true }),
        supabase.from("game_circles").select("*").order("level", { ascending: true }),
      ]);

      if (!isCurrent()) return;

      const firstError =
        profilesRes.error ?? statsRes.error ?? destRes.error ?? comboRes.error ?? circleRes.error;
      if (firstError) {
        console.error("[Gamification Admin] Load error:", {
          profiles: profilesRes.error,
          leaderboard: statsRes.error,
          destinations: destRes.error,
          combos: comboRes.error,
          circles: circleRes.error,
        });
        setError({ message: firstError.message || null, code: firstError.code || null });
        return; // уже загруженные данные НЕ стираем
      }

      setRaw({
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        leaderboard: (statsRes.data ?? []) as LeaderboardRow[],
        destinations: (destRes.data ?? []) as GameDestinationRow[],
        combos: (comboRes.data ?? []) as GameComboRow[],
        circles: (circleRes.data ?? []) as GameCircleRow[],
      });
      setHasData(true);
    } catch (e) {
      if (!isCurrent()) return;
      console.error("[Gamification Admin] Load exception:", e);
      setError({ message: e instanceof Error && e.message ? e.message : null, code: null });
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  /** Перечитать только лидерборд (Индекс и Circle считает БД) */
  const reloadStandings = useCallback(async () => {
    const { data, error: lbError } = await supabase.from("v_global_leaderboard").select("*");
    if (!mounted.current) return;
    if (lbError) {
      console.error("[Gamification Admin] Leaderboard reload error:", lbError);
      return;
    }
    setRaw((r) => ({ ...r, leaderboard: (data ?? []) as LeaderboardRow[] }));
  }, []);

  const scheduleStandings = useCallback(() => {
    if (standingsTimer.current) clearTimeout(standingsTimer.current);
    standingsTimer.current = setTimeout(() => void reloadStandings(), STANDINGS_DEBOUNCE_MS);
  }, [reloadStandings]);

  useEffect(() => {
    if (authLoading) return; // ждём браузерную сессию админа
    void load("initial");
  }, [authLoading, load]);

  // Realtime: настройки и штампы
  useEffect(() => {
    if (authLoading) return;

    const channel = supabase
      .channel("voyage-admin-gamification")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_destinations" },
        (payload: RealtimePostgresChangesPayload<GameDestinationRow>) => {
          setRaw((r) => ({ ...r, destinations: applyPayload(r.destinations, payload, "id") }));
          scheduleStandings();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_combos" },
        (payload: RealtimePostgresChangesPayload<GameComboRow>) => {
          setRaw((r) => ({ ...r, combos: applyPayload(r.combos, payload, "id") }));
          scheduleStandings();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_circles" },
        (payload: RealtimePostgresChangesPayload<GameCircleRow>) => {
          setRaw((r) => ({ ...r, circles: applyPayload(r.circles, payload, "level") }));
          scheduleStandings();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "game_attendance" }, () => {
        scheduleStandings();
      })
      .subscribe((status) => {
        if (mounted.current) setLive(status === "SUBSCRIBED");
      });

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [authLoading, scheduleStandings]);

  // Собственное сохранение: патчим сразу, не дожидаясь эха из realtime
  const handleSaved = useCallback(
    (saved: SavedRow) => {
      setRaw((r) => {
        switch (saved.table) {
          case "game_destinations":
            return { ...r, destinations: upsertBy(r.destinations, saved.row, "id") };
          case "game_combos":
            return { ...r, combos: upsertBy(r.combos, saved.row, "id") };
          case "game_circles":
            return { ...r, circles: upsertBy(r.circles, saved.row, "level") };
        }
      });
      scheduleStandings();
    },
    [scheduleStandings],
  );

  const handleStamped = useCallback(() => {
    scheduleStandings();
  }, [scheduleStandings]);

  /* ── Производные данные ── */

  const destinations = useMemo(() => resolveDestinations(raw.destinations), [raw.destinations]);
  const extras = useMemo(() => buildExtras(raw.destinations), [raw.destinations]);
  const combos = useMemo(() => resolveCombos(raw.combos), [raw.combos]);
  const circles = useMemo(() => resolveCircles(raw.circles), [raw.circles]);
  const residents = useMemo(
    () => buildResidents(raw.profiles, raw.leaderboard, circles),
    [raw.profiles, raw.leaderboard, circles],
  );

  const stats = useMemo(
    () => [
      { label: t.statResidents, value: nf.format(residents.length) },
      { label: t.statStamps, value: nf.format(residents.reduce((s, r) => s + r.stampsCount, 0)) },
      {
        label: t.statDestinations,
        value: `${nf.format(destinations.filter((d) => d.active).length)} / ${nf.format(destinations.length)}`,
      },
      {
        label: t.statCombos,
        value: `${nf.format(combos.filter((c) => c.active).length)} / ${nf.format(combos.length)}`,
      },
    ],
    [t, nf, residents, destinations, combos],
  );

  const busy = loading || refreshing;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_-10%,rgba(253,230,138,0.06)_0%,transparent_60%)]" />
      </div>

      <header className="mb-8 border-b border-zinc-800/80 pb-6 sm:mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.45em] text-zinc-600">{t.eyebrow}</p>
            <h1 className={`${cormorant.className} mt-2 text-4xl font-medium tracking-wide text-zinc-50`}>
              {t.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500">{t.subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-3 self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] ${
                live
                  ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300/90"
                  : "border-zinc-800 text-zinc-600"
              }`}
            >
              <Radio size={11} strokeWidth={2} className={live ? "animate-pulse" : ""} />
              {live ? t.live : t.offline}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void load("refresh")}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={14} strokeWidth={1.75} className={refreshing ? "animate-spin" : ""} />
              {t.refresh}
            </button>
          </div>
        </div>

        {hasData && (
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3">
                <dt className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">{s.label}</dt>
                <dd className={`${cormorant.className} mt-1 text-2xl font-medium tabular-nums text-amber-200`}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 px-5 py-4">
          <div className="flex items-center gap-3 text-sm font-medium text-red-300">
            <AlertTriangle size={18} strokeWidth={1.5} />
            {hasData ? t.refreshFailed : t.loadFailed}
          </div>
          <p className="mt-2 break-words pl-[30px] font-mono text-xs text-red-300/80">
            {error.message ?? t.networkError}
          </p>
          {isSchemaError(error) && <p className="mt-2 pl-[30px] text-xs text-amber-200/80">{t.migrationHint}</p>}
          {!hasData && (
            <button
              type="button"
              onClick={() => void load("initial")}
              className="ml-[30px] mt-3 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-200 transition-colors hover:bg-red-500/10"
            >
              {t.retry}
            </button>
          )}
        </div>
      )}

      {loading && !hasData ? (
        <div className="flex items-center justify-center gap-2.5 py-24 text-sm text-zinc-500">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
          {t.loading}
        </div>
      ) : hasData ? (
        <GamificationAdminClient
          residents={residents}
          destinations={destinations}
          extras={extras}
          combos={combos}
          circles={circles}
          onSaved={handleSaved}
          onStamped={handleStamped}
        />
      ) : null}
    </div>
  );
}
