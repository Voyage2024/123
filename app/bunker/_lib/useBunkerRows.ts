"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useBunkerToast } from "@/app/bunker/_components/toast";
import { bunkerDb } from "@/app/bunker/_lib/db";
import type { BunkerTable, DbOrder } from "@/lib/bunker/db-ops";

/* ──────────────────────────────────────────────────────────────────────
 * Загрузка и правка строк таблиц бункера.
 * Запросы идут через /bunker/api/db с PIN-сессией; какие строки видны
 * (настоящие или камуфляж) решает RLS по режиму сессии. user_id и
 * is_decoy проставляет база.
 *
 * update/remove — оптимистичные: сразу меняем экран, при ошибке
 * откатываем и показываем тост.
 * ──────────────────────────────────────────────────────────────────── */

export type { BunkerTable };

export function errorText(error: unknown) {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "Что-то пошло не так";
}

export function useBunkerRows<T extends { id: string }>(table: BunkerTable, order: DbOrder[] = []) {
  const notify = useBunkerToast();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const orderKey = JSON.stringify(order);

  const reload = useCallback(async () => {
    const res = await bunkerDb<T[]>({ kind: "select", table, order: JSON.parse(orderKey) as DbOrder[] });
    if (res.locked) return;
    if (res.error) {
      setError(res.error);
    } else {
      setError(null);
      setRows(res.data ?? []);
    }
    setLoading(false);
  }, [table, orderKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const insert = useCallback(
    async (values: Partial<T> & Record<string, unknown>) => {
      const res = await bunkerDb<T>({ kind: "insert", table, values });
      if (res.error || !res.data) {
        if (!res.locked) notify(errorText(res.error), { tone: "error" });
        return null;
      }
      const row = res.data;
      setRows((list) => [row, ...list]);
      return row;
    },
    [table, notify],
  );

  const update = useCallback(
    async (id: string, patch: Partial<T> & Record<string, unknown>) => {
      const before = rowsRef.current.find((r) => r.id === id);
      setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const res = await bunkerDb<T>({ kind: "update", table, id, patch });
      if (res.error || !res.data) {
        if (before) setRows((list) => list.map((r) => (r.id === id ? before : r)));
        if (!res.locked) notify(errorText(res.error), { tone: "error" });
        return null;
      }
      // Триггеры могли что-то пересчитать (paid_amount, completed_at) — берём ответ базы.
      const row = res.data;
      setRows((list) => list.map((r) => (r.id === id ? row : r)));
      return row;
    },
    [table, notify],
  );

  const remove = useCallback(
    async (id: string) => {
      const before = rowsRef.current;
      setRows((list) => list.filter((r) => r.id !== id));
      const res = await bunkerDb({ kind: "delete", table, id });
      if (res.error) {
        setRows(before);
        if (!res.locked) notify(errorText(res.error), { tone: "error" });
        return false;
      }
      return true;
    },
    [table, notify],
  );

  /** Заменить строку тем, что вернула RPC. */
  const replace = useCallback((row: T) => setRows((list) => list.map((r) => (r.id === row.id ? row : r))), []);

  return { rows, setRows, loading, error, reload, insert, update, remove, replace };
}
