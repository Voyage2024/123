"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER COMMAND — источник данных Штаба
 * app/(dashboard)/partner/_lib/useCommandData.ts
 *
 * Режим задаётся переменной окружения (в .env.local):
 *   NEXT_PUBLIC_PARTNER_DATA=live  → RPC public.partner_command()
 *   не задана                      → демо-данные (buildMock)
 *
 * live: загрузка при открытии, тихое обновление раз в минуту и при
 * возвращении на вкладку. Если обновление не удалось, последние данные
 * остаются на экране, а ошибка показывается рядом.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildMock, CommandError, fetchCommand, type CommandData } from "@/app/(dashboard)/partner/_lib/command";
import { DATA_SOURCE, type DataSource } from "@/app/(dashboard)/partner/_lib/routes";

export type CommandSource = DataSource;
export const COMMAND_SOURCE: CommandSource = DATA_SOURCE;

const REFRESH_MS = 60_000;

export type CommandState = {
  source: CommandSource;
  data: CommandData | null;
  /** Первая загрузка (данных ещё нет) */
  loading: boolean;
  /** Идёт фоновое обновление */
  refreshing: boolean;
  error: CommandError | null;
  refresh: () => void;
};

export function useCommandData(): CommandState {
  const live = COMMAND_SOURCE === "live";
  const [data, setData] = useState<CommandData | null>(() => (live ? null : buildMock()));
  const [error, setError] = useState<CommandError | null>(null);
  const [pending, setPending] = useState(live);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (!live || inflight.current) return;
    inflight.current = true;
    setPending(true);
    try {
      const next = await fetchCommand(supabase);
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof CommandError ? e : new CommandError("network", String(e)));
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }, [live]);

  useEffect(() => {
    if (!live) return;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, load]);

  return {
    source: COMMAND_SOURCE,
    data,
    loading: pending && !data,
    refreshing: pending && !!data,
    error,
    refresh: () => void load(),
  };
}
