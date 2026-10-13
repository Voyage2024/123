"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · DEAL ROOM — источник данных комнаты тура
 * app/(dashboard)/partner/_lib/useDealRoom.ts
 *
 * demo: buildRoomMock(id); действия меняют данные локально (update).
 * live: RPC partner_deal_room, обновление каждые 30 с и при возврате на
 *       вкладку — подписи, сделанные в Telegram, появляются сами.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CommandError } from "./command";
import { buildRoomMock, fetchDealRoom, type DealRoomData } from "./dealRoom";
import { DATA_SOURCE, type DataSource } from "./routes";

const REFRESH_MS = 30_000;

export type DealRoomState = {
  source: DataSource;
  data: DealRoomData | null;
  loading: boolean;
  refreshing: boolean;
  error: CommandError | null;
  refresh: () => void;
  /** Локальное изменение (демо) — в live после действия вызываем refresh */
  update: (fn: (d: DealRoomData) => DealRoomData) => void;
};

export function useDealRoom(tourId: string): DealRoomState {
  const live = DATA_SOURCE === "live";
  const [data, setData] = useState<DealRoomData | null>(() => (live || !tourId ? null : buildRoomMock(tourId)));
  const [error, setError] = useState<CommandError | null>(null);
  const [pending, setPending] = useState(live);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (!live || !tourId || inflight.current) return;
    inflight.current = true;
    setPending(true);
    try {
      setData(await fetchDealRoom(supabase, tourId));
      setError(null);
    } catch (e) {
      setError(e instanceof CommandError ? e : new CommandError("network", String(e)));
    } finally {
      inflight.current = false;
      setPending(false);
    }
  }, [live, tourId]);

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

  const update = useCallback((fn: (d: DealRoomData) => DealRoomData) => {
    setData((d) => (d ? fn(d) : d));
  }, []);

  return {
    source: DATA_SOURCE,
    data,
    loading: pending && !data,
    refreshing: pending && !!data,
    error,
    refresh: () => void load(),
    update,
  };
}
