"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useBunkerToast } from "@/app/bunker/_components/toast";
import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────────────────
 * Загрузка и правка строк таблиц бункера прямо из браузера.
 * Доступ режет RLS (свои строки + bunker_has_access()), user_id
 * проставляет default auth.uid().
 *
 * update/remove — оптимистичные: сразу меняем экран, при ошибке
 * откатываем и показываем тост.
 * ──────────────────────────────────────────────────────────────────── */

export type BunkerTable =
  | "bunker_tasks"
  | "bunker_debts"
  | "bunker_investments"
  | "bunker_notes"
  | "bunker_vault"
  | "bunker_projects";

type Order = { column: string; ascending?: boolean };

export function errorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return "Что-то пошло не так";
}

export function useBunkerRows<T extends { id: string }>(table: BunkerTable, order: Order[] = []) {
  const notify = useBunkerToast();
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const orderKey = JSON.stringify(order);

  const reload = useCallback(async () => {
    let query = supabase.from(table).select("*");
    for (const o of JSON.parse(orderKey) as Order[]) query = query.order(o.column, { ascending: o.ascending ?? true });
    const { data, error: err } = await query;
    if (err) {
      setError(errorText(err));
    } else {
      setError(null);
      setRows((data ?? []) as T[]);
    }
    setLoading(false);
  }, [table, orderKey]);

  useEffect(() => {
    void reload();
    // Вернулись в приложение (PWA из фона) — подтягиваем свежие данные.
    const onVisible = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const insert = useCallback(
    async (values: Partial<T> & Record<string, unknown>) => {
      const { data, error: err } = await supabase.from(table).insert(values).select("*").single();
      if (err) {
        notify(errorText(err), { tone: "error" });
        return null;
      }
      setRows((list) => [data as T, ...list]);
      return data as T;
    },
    [table, notify],
  );

  const update = useCallback(
    async (id: string, patch: Partial<T> & Record<string, unknown>) => {
      const before = rowsRef.current.find((r) => r.id === id);
      setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const { data, error: err } = await supabase.from(table).update(patch as Record<string, unknown>).eq("id", id).select("*").single();
      if (err) {
        if (before) setRows((list) => list.map((r) => (r.id === id ? before : r)));
        notify(errorText(err), { tone: "error" });
        return null;
      }
      // Триггеры могли что-то пересчитать (paid_amount, completed_at) — берём ответ базы.
      setRows((list) => list.map((r) => (r.id === id ? (data as T) : r)));
      return data as T;
    },
    [table, notify],
  );

  const remove = useCallback(
    async (id: string) => {
      const before = rowsRef.current;
      setRows((list) => list.filter((r) => r.id !== id));
      const { error: err } = await supabase.from(table).delete().eq("id", id);
      if (err) {
        setRows(before);
        notify(errorText(err), { tone: "error" });
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
