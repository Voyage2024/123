"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — загрузка экрана пульта одним RPC
 * app/(dashboard)/partner/_lib/usePartnerFeed.ts
 *
 * Как useCommandData, только для любой страницы: RPC под RLS → parse.
 * Загрузка при открытии, тихое обновление при возвращении на вкладку
 * и раз в 2 минуты. Если обновление не удалось, последние данные
 * остаются на экране, а ошибка лежит рядом.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CommandError } from "@/app/(dashboard)/partner/_lib/command";

const REFRESH_MS = 120_000;

export type FeedState<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: CommandError | null;
  refresh: () => void;
};

export function toFeedError(error: { code?: string; message: string }): CommandError {
  // 42501 — роль не manager/admin/owner; PGRST202 — миграция не применена
  const reason =
    error.code === "42501" ? "forbidden" : error.code === "PGRST202" ? "missing" : !error.code ? "network" : "unknown";
  return new CommandError(reason, error.message);
}

export function usePartnerFeed<T>(rpc: string, parse: (raw: unknown) => T, args?: Record<string, unknown>): FeedState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<CommandError | null>(null);
  const [pending, setPending] = useState(true);
  const inflight = useRef(false);
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const argsKey = JSON.stringify(args ?? null);

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setPending(true);
    try {
      const params = JSON.parse(argsKey) as Record<string, unknown> | null;
      const { data: raw, error: rpcError } = params ? await supabase.rpc(rpc, params) : await supabase.rpc(rpc);
      if (rpcError) throw toFeedError(rpcError);
      setData(parseRef.current(raw));
      setError(null);
    } catch (e) {
      setError(e instanceof CommandError ? e : new CommandError("network", String(e)));
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }, [rpc, argsKey]);

  useEffect(() => {
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
  }, [load]);

  return { data, loading: pending && !data, refreshing: pending && !!data, error, refresh: () => void load() };
}
