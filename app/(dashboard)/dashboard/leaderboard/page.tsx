"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · GLOBAL RANKING — абсолютный топ клуба (Influence Index)
 * app/(dashboard)/dashboard/leaderboard/page.tsx
 *
 * Глобальный рейтинг ≠ рейтинг тура:
 *   /dashboard/tours, /admin/events — «спринт»: баллы текущего тура;
 *   /dashboard/leaderboard           — «марафон»: Индекс за всё время в клубе,
 *                                      куда автоматически входят баллы всех туров.
 *
 * Данные:
 *   v_global_leaderboard — Индекс (штампы + комбо + туры + патронаж), Circle,
 *                          позиция, имя и аватар прямо из profiles
 *   game_circles         — названия и пороги Circle (если админ менял)
 * Обновление: realtime по штампам, ключам и правилам + тихий опрос раз в
 * минуту, пока вкладка открыта (чужие штампы и смену имён RLS в realtime
 * не отдаёт — опрос их подхватит).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  CIRCLES,
  circleFor,
  normalizeCircleKey,
  normalizeLang,
  num,
  resolveCircles,
  type GameCircleRow,
  type Lang,
  type LeaderboardRow,
} from "@/lib/gamification";
import { resolveAvatarUrl } from "@/lib/memberCards";
import LeaderboardClient, { type LeaderboardData, type LeaderboardEntry } from "./LeaderboardClient";

const RELOAD_DEBOUNCE_MS = 600;
const POLL_MS = 60_000;

const COLUMNS =
  "profile_id, position, total_influence, rank_title, level, circle_key, full_name, avatar_url, " +
  "stamps_count, destinations_count, combos_completed, patronage_points, proteges_count, tour_points, tours_count";

const TEXT: Record<Lang, { loading: string; failed: string; migration: string; retry: string }> = {
  en: {
    loading: "Gathering the club's standings…",
    failed: "Couldn't load the ranking",
    migration: "The gamification migrations haven't been applied in Supabase yet.",
    retry: "Retry",
  },
  ru: {
    loading: "Собираем рейтинг клуба…",
    failed: "Не удалось загрузить рейтинг",
    migration: "Миграции геймификации ещё не применены в Supabase.",
    retry: "Повторить",
  },
  es: {
    loading: "Reuniendo la clasificación del club…",
    failed: "No se pudo cargar el ranking",
    migration: "Las migraciones de gamificación aún no se aplicaron en Supabase.",
    retry: "Reintentar",
  },
  pt: {
    loading: "Reunindo a classificação do clube…",
    failed: "Não foi possível carregar o ranking",
    migration: "As migrações de gamificação ainda não foram aplicadas no Supabase.",
    retry: "Tentar de novo",
  },
};

type Raw = { rows: LeaderboardRow[]; circles: GameCircleRow[]; loadedAt: string };

function toEntries(raw: Raw): LeaderboardEntry[] {
  const circles = resolveCircles(raw.circles);
  return raw.rows
    .map((r): LeaderboardEntry => {
      const influence = Math.max(0, Math.round(num(r.total_influence) ?? 0));
      const circle = circles.find((c) => c.key === normalizeCircleKey(r.circle_key)) ?? circleFor(influence, circles);
      return {
        profileId: r.profile_id,
        position: num(r.position) ?? 0,
        name: r.full_name?.trim() || "",
        avatarUrl: resolveAvatarUrl(r.avatar_url),
        circleKey: circle.key,
        circleTitle: r.rank_title?.trim() || circle.title || CIRCLES[0].title,
        influence,
        stamps: num(r.stamps_count) ?? 0,
        destinations: num(r.destinations_count) ?? 0,
        combos: num(r.combos_completed) ?? 0,
        patronage: num(r.patronage_points) ?? 0,
        proteges: num(r.proteges_count) ?? 0,
        tourPoints: num(r.tour_points) ?? 0,
      };
    })
    .sort((a, b) => b.influence - a.influence || a.position - b.position || a.name.localeCompare(b.name));
}

export default function LeaderboardPage() {
  const auth = useAuth() as unknown as { user?: { id?: string } | null; loading?: boolean } | null;
  const userId = auth?.user?.id ?? null;
  const authLoading = auth?.loading ?? false;
  const ctx: unknown = useLanguage();
  const lang = normalizeLang(ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).lang : ctx);
  const text = TEXT[lang];

  const [raw, setRaw] = useState<Raw | null>(null);
  const [error, setError] = useState<{ message: string; schema: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [lbRes, circlesRes] = await Promise.all([
        supabase.from("v_global_leaderboard").select(COLUMNS).order("position", { ascending: true }),
        supabase.from("game_circles").select("*").order("level", { ascending: true }),
      ]);
      if (!mounted.current) return;
      // старая схема без патронажа — берём всё, что есть
      type Res = { data: unknown; error: { message: string; code?: string } | null };
      let lb = lbRes as unknown as Res;
      if (lb.error && /column .* does not exist/i.test(lb.error.message ?? "")) {
        lb = (await supabase.from("v_global_leaderboard").select("*").order("position", { ascending: true })) as unknown as Res;
        if (!mounted.current) return;
      }
      const firstError = lb.error ?? circlesRes.error;
      if (firstError) {
        console.error("[Leaderboard] Load error:", firstError);
        setError({
          message: firstError.message,
          schema:
            ["42P01", "42883", "PGRST202", "PGRST205"].includes(firstError.code ?? "") ||
            /does not exist|schema cache/i.test(firstError.message ?? ""),
        });
        return;
      }
      setRaw({
        rows: (lb.data ?? []) as LeaderboardRow[],
        circles: (circlesRes.data ?? []) as GameCircleRow[],
        loadedAt: new Date().toISOString(),
      });
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      console.error("[Leaderboard] Load exception:", e);
      setError({ message: e instanceof Error ? e.message : String(e), schema: false });
    }
  }, [userId]);

  const scheduleReload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    if (mounted.current) setRefreshing(false);
  }, [load]);

  useEffect(() => {
    if (authLoading || !userId) return;
    void load();

    const channel = supabase.channel(`voyage-global-ranking-${userId}`);
    // только таблицы из публикации supabase_realtime (миграции gamification_v2 и club_invites)
    for (const table of ["game_attendance", "club_invites", "game_circles", "game_destinations", "game_combos", "club_patronage_rules"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleReload);
    }
    channel.subscribe();

    // чужие штампы realtime не покажет (RLS) — тихо перечитываем, пока вкладка на экране
    const poll = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") scheduleReload();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleReload();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [authLoading, userId, load, scheduleReload]);

  const data = useMemo<LeaderboardData | null>(() => {
    if (!raw) return null;
    return { entries: toEntries(raw), meId: userId, updatedAt: raw.loadedAt };
  }, [raw, userId]);

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-950 px-4 py-24">
        <div role="alert" className="w-full max-w-lg rounded-2xl border border-red-500/25 bg-red-950/20 px-6 py-5">
          <p className="flex items-center gap-2.5 text-sm font-medium text-red-200">
            <AlertTriangle size={17} strokeWidth={1.5} aria-hidden />
            {text.failed}
          </p>
          <p className="mt-2 break-words font-mono text-xs text-red-300/70">{error.message}</p>
          {error.schema && <p className="mt-2 text-xs text-amber-200/80">{text.migration}</p>}
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-100 transition-colors hover:bg-red-500/10"
          >
            {text.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-950 px-4 py-32 text-sm text-zinc-500">
        <span className="inline-flex items-center gap-2.5">
          <Loader2 size={17} strokeWidth={1.5} className="animate-spin" aria-hidden />
          {text.loading}
        </span>
      </div>
    );
  }

  return <LeaderboardClient data={data} onRefresh={refresh} refreshing={refreshing} />;
}