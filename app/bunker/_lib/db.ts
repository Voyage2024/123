"use client";

import type { DbOp, DbResult } from "@/lib/bunker/db-ops";

/* ──────────────────────────────────────────────────────────────────────
 * Клиент данных бункера. Все запросы идут на /bunker/api/db: напрямую
 * в Supabase браузер в бункер не ходит (без PIN-сессии RLS всё равно
 * вернул бы пустоту, а токен сессии живёт только в httpOnly-cookie).
 *
 * Если сервер ответил «сессии нет» — зовём обработчик блокировки
 * (его ставит BunkerLock), и бункер снова показывает экран PIN.
 * ──────────────────────────────────────────────────────────────────── */

let onSessionLost: () => void = () => {};

export function setSessionLostHandler(fn: () => void) {
  onSessionLost = fn;
}

export async function bunkerDb<T = unknown>(op: DbOp): Promise<DbResult<T>> {
  try {
    const res = await fetch("/bunker/api/db", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(op),
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = (await res.json()) as DbResult<T>;
    if (body.locked) {
      onSessionLost();
      return { data: null, error: "Бункер заблокирован", locked: true };
    }
    return body;
  } catch {
    return { data: null, error: "Нет связи с сервером" };
  }
}
