"use client";

/* ──────────────────────────────────────────────────────────────────────
 * useClubStanding — текущий Circle резидента прямо из базы.
 *
 * Источник правды тот же, что у «Паспорта» и лидерборда:
 *   v_global_leaderboard (своя строка) → circle_key, total_influence
 *   game_circles                      → названия и пороги кругов
 *
 * Realtime: серверная витрина resident_metrics / v_global_leaderboard является
 * источником баллов и круга. Подписки на ledger + metrics вызывают перечитку
 * после выдачи штампов, ачивок и завершения активности. Периодическая проверка
 * и перечитка при возврате на вкладку страхуют сценарии без realtime-публикации.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  circleFor,
  normalizeCircleKey,
  num,
  resolveCircles,
  type CircleConfig,
  type GameCircleRow,
  type LeaderboardRow,
} from "@/lib/gamification";

const RELOAD_DEBOUNCE_MS = 400;

type Snapshot = {
  userId: string;
  circles: CircleConfig[];
  row: LeaderboardRow | null;
  metricsPoints: number | null;
  profileLevel: number | null;
  profileCircle: string | null;
};

export type ClubStanding = {
  circle: CircleConfig;
  next: CircleConfig | null;
  /** все круги клуба по возрастанию уровня */
  circles: CircleConfig[];
  /** Индекс глобального влияния */
  index: number;
  /** 0…1 — путь от текущего круга к следующему */
  progress: number;
  loading: boolean;
};

/**
 * @param userId          id резидента (auth.users.id = profiles.id)
 * @param fallbackStatus  profiles.status — используется, только если
 *                        во вью ещё нет строки резидента
 */
export function useClubStanding(
  userId: string | null | undefined,
  fallbackStatus?: string | null,
): ClubStanding {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      const [circleRes, rowRes, metricsRes, profileRes] = await Promise.all([
        supabase.from("game_circles").select("level, key, title, min_influence"),
        supabase.from("v_global_leaderboard").select("*").eq("profile_id", userId).maybeSingle(),
        supabase.from("resident_metrics").select("total_points").eq("profile_id", userId).maybeSingle(),
        supabase.from("profiles").select("level, circle, influence_index").eq("id", userId).maybeSingle(),
      ]);
      if (cancelled) return;

      if (circleRes.error) console.error("[Cardholder] circles:", circleRes.error.message);
      if (rowRes.error) console.error("[Cardholder] standing:", rowRes.error.message);
      if (metricsRes.error) console.error("[Cardholder] resident metrics:", metricsRes.error.message);
      if (profileRes.error) console.error("[Cardholder] cached profile status:", profileRes.error.message);

      const profile = profileRes.error ? null : profileRes.data;
      const metricPoints = metricsRes.error ? null : Number(metricsRes.data?.total_points);
      setSnap({
        userId,
        circles: resolveCircles(circleRes.error ? null : (circleRes.data as GameCircleRow[])),
        row: rowRes.error ? null : ((rowRes.data ?? null) as LeaderboardRow | null),
        metricsPoints: Number.isFinite(metricPoints) ? metricPoints : null,
        profileLevel: profile?.level == null ? null : Number(profile.level),
        profileCircle: typeof profile?.circle === "string" ? profile.circle : null,
      });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };
    const poll = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") schedule();
    }, 60_000);

    void load();

    const channel = supabase
      .channel(`voyage-cardholder-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_circles" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_destinations" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_combos" }, schedule)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_attendance", filter: `profile_id=eq.${userId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_metrics", filter: `profile_id=eq.${userId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_score_events", filter: `profile_id=eq.${userId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_passport_stamps", filter: `profile_id=eq.${userId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_achievements", filter: `profile_id=eq.${userId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resident_activities", filter: `profile_id=eq.${userId}` },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_invites", filter: `patron_id=eq.${userId}` },
        schedule,
      )
      .subscribe();

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // данные чужого аккаунта (после смены пользователя) не применяем ни на миг
  const current = snap && snap.userId === userId ? snap : null;

  return useMemo<ClubStanding>(() => {
    const circles = [...(current?.circles ?? resolveCircles())].sort((a, b) => a.level - b.level);
    const index = current?.metricsPoints ?? num(current?.row?.total_influence) ?? 0;

    // Metrics points are canonical. Use profiles.level/circle only when that cached
    // status agrees with the threshold-derived level for the same ledger balance.
    const thresholdCircle = circleFor(index, circles);
    const profileCircleKey = normalizeCircleKey(current?.profileCircle);
    const cachedCircle = circles.find((c) => c.level === current?.profileLevel)
      ?? circles.find((c) => c.key === profileCircleKey);
    const viewCircle = circles.find((c) => c.key === normalizeCircleKey(current?.row?.circle_key));
    const statusKey = normalizeCircleKey(fallbackStatus);
    const circle = cachedCircle && cachedCircle.level === thresholdCircle.level
      ? cachedCircle
      : viewCircle ?? thresholdCircle ?? circles.find((c) => c.key === statusKey) ?? circles[0];

    // следующий — по уровню показанного круга, чтобы шкала не спорила с картой
    const next = circles.find((c) => c.level > circle.level) ?? null;
    const span = next ? next.min - circle.min : 0;
    const progress = next && span > 0 ? Math.min(1, Math.max(0, (index - circle.min) / span)) : 1;

    return { circle, next, circles, index, progress, loading: Boolean(userId) && !current };
  }, [current, fallbackStatus, userId]);
}
