"use client";

/* ──────────────────────────────────────────────────────────────────────
 * useClubStanding — текущий Circle резидента прямо из базы.
 *
 * Источник правды тот же, что у «Паспорта» и лидерборда:
 *   v_global_leaderboard (своя строка) → circle_key, total_influence
 *   game_circles                      → названия и пороги кругов
 *
 * Realtime: штампы, комбо, веса направлений, поручительства и пороги
 * кругов пересчитывают вью — хук перечитывает её (с дебаунсом), и
 * кардхолдер сам меняет цвет при повышении круга. Плюс перечитка при
 * возврате на вкладку — страховка для источников без realtime-подписки
 * (например, баллов туров).
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
      const [circleRes, rowRes] = await Promise.all([
        supabase.from("game_circles").select("level, key, title, min_influence"),
        supabase.from("v_global_leaderboard").select("*").eq("profile_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;

      if (circleRes.error) console.error("[Cardholder] circles:", circleRes.error.message);
      if (rowRes.error) console.error("[Cardholder] standing:", rowRes.error.message);

      setSnap({
        userId,
        circles: resolveCircles(circleRes.error ? null : (circleRes.data as GameCircleRow[])),
        row: rowRes.error ? null : ((rowRes.data ?? null) as LeaderboardRow | null),
      });
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), RELOAD_DEBOUNCE_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };

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
        { event: "*", schema: "public", table: "club_invites", filter: `patron_id=eq.${userId}` },
        schedule,
      )
      .subscribe();

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // данные чужого аккаунта (после смены пользователя) не применяем ни на миг
  const current = snap && snap.userId === userId ? snap : null;

  return useMemo<ClubStanding>(() => {
    const circles = [...(current?.circles ?? resolveCircles())].sort((a, b) => a.level - b.level);
    const index = num(current?.row?.total_influence) ?? 0;

    // 1) круг, посчитанный базой; 2) по индексу, если строка есть; 3) profiles.status; 4) база
    const dbKey = normalizeCircleKey(current?.row?.circle_key);
    const statusKey = normalizeCircleKey(fallbackStatus);
    const circle =
      circles.find((c) => c.key === dbKey) ??
      (current?.row ? circleFor(index, circles) : undefined) ??
      circles.find((c) => c.key === statusKey) ??
      circleFor(index, circles);

    // следующий — по уровню показанного круга, чтобы шкала не спорила с картой
    const next = circles.find((c) => c.level > circle.level) ?? null;
    const span = next ? next.min - circle.min : 0;
    const progress = next && span > 0 ? Math.min(1, Math.max(0, (index - circle.min) / span)) : 1;

    return { circle, next, circles, index, progress, loading: Boolean(userId) && !current };
  }, [current, fallbackStatus, userId]);
}
