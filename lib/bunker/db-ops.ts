/* ──────────────────────────────────────────────────────────────────────
 * Операции с данными бункера: общий формат для браузера и сервера.
 * Браузер шлёт их на /bunker/api/db, сервер выполняет с PIN-сессией.
 * ──────────────────────────────────────────────────────────────────── */

export const BUNKER_TABLES = [
  "bunker_projects",
  "bunker_tasks",
  "bunker_debts",
  "bunker_investments",
  "bunker_notes",
  "bunker_vault",
  "bunker_vault_keys",
] as const;
export type BunkerTable = (typeof BUNKER_TABLES)[number];

export const BUNKER_RPCS = ["bunker_debt_add_payment"] as const;
export type BunkerRpc = (typeof BUNKER_RPCS)[number];

export type DbOrder = { column: string; ascending?: boolean };

export type DbOp =
  | { kind: "select"; table: BunkerTable; order?: DbOrder[] }
  | { kind: "insert"; table: BunkerTable; values: Record<string, unknown> }
  | { kind: "update"; table: BunkerTable; id: string; patch: Record<string, unknown> }
  | { kind: "delete"; table: BunkerTable; id: string }
  /** Только сейф: удалить все свои записи текущего режима (сброс сейфа). */
  | { kind: "deleteAll"; table: "bunker_vault" | "bunker_vault_keys" }
  | { kind: "rpc"; fn: BunkerRpc; args: Record<string, unknown> };

export type DbResult<T = unknown> = { data: T | null; error: string | null; locked?: boolean };
