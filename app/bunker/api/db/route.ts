import { NextResponse, type NextRequest } from "next/server";

import { getBunkerViewer } from "@/lib/bunker/access";
import { BUNKER_RPCS, BUNKER_TABLES, type DbOp, type DbResult } from "@/lib/bunker/db-ops";
import { bunkerSupabase, clearBunkerToken, getBunkerToken } from "@/lib/bunker/session";

/* ──────────────────────────────────────────────────────────────────────
 * POST /bunker/api/db — единственная дверь к данным бункера из браузера.
 *
 * Проверки по порядку: тот же origin → владелец (getBunkerViewer) →
 * PIN-сессия в httpOnly cookie жива (bunker_touch продлевает её) →
 * операция из белого списка. Дальше всё режет RLS по заголовку
 * x-bunker-session: в режиме Duress видны только камуфляжные строки.
 *
 * Route handler, а не server action: server actions Next выполняет по
 * одному, а хабу нужно грузить четыре таблицы параллельно.
 * ──────────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: DbResult, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

const SYSTEM_COLUMNS = ["user_id", "is_decoy", "id", "created_at", "updated_at"];

function clean(values: Record<string, unknown>, keepId = false) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values ?? {})) {
    if (!/^[a-z_]+$/.test(k)) continue;
    if (SYSTEM_COLUMNS.includes(k) && !(keepId && k === "id")) continue;
    out[k] = v;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return json({ data: null, error: "Not found" }, 404);
  }

  const viewer = await getBunkerViewer();
  if (!viewer) return json({ data: null, error: "Not found" }, 404);

  const token = await getBunkerToken();
  if (!token) return json({ data: null, error: null, locked: true });

  const supabase = await bunkerSupabase(token);
  const { data: alive } = await supabase.rpc("bunker_touch");
  if (alive !== true) {
    await clearBunkerToken();
    return json({ data: null, error: null, locked: true });
  }

  let op: DbOp;
  try {
    op = (await request.json()) as DbOp;
  } catch {
    return json({ data: null, error: "Bad request" }, 400);
  }

  if (op.kind === "rpc") {
    if (!(BUNKER_RPCS as readonly string[]).includes(op.fn)) return json({ data: null, error: "Bad request" }, 400);
    const { data, error } = await supabase.rpc(op.fn, op.args ?? {});
    return json({ data, error: error?.message ?? null });
  }

  if (!(BUNKER_TABLES as readonly string[]).includes(op.table)) return json({ data: null, error: "Bad request" }, 400);
  const table = supabase.from(op.table);

  switch (op.kind) {
    case "select": {
      let query = table.select("*");
      for (const o of op.order ?? []) {
        if (/^[a-z_]+$/.test(o.column)) query = query.order(o.column, { ascending: o.ascending ?? true });
      }
      const { data, error } = await query;
      return json({ data, error: error?.message ?? null });
    }
    case "insert": {
      const { data, error } = await table.insert(clean(op.values)).select("*").single();
      return json({ data, error: error?.message ?? null });
    }
    case "update": {
      const { data, error } = await table.update(clean(op.patch)).eq("id", op.id).select("*").single();
      return json({ data, error: error?.message ?? null });
    }
    case "delete": {
      const { error } = await table.delete().eq("id", op.id);
      return json({ data: null, error: error?.message ?? null });
    }
    case "deleteAll": {
      if (op.table !== "bunker_vault" && op.table !== "bunker_vault_keys") return json({ data: null, error: "Bad request" }, 400);
      const { error } = await table.delete().eq("user_id", viewer.userId);
      return json({ data: null, error: error?.message ?? null });
    }
    default:
      return json({ data: null, error: "Bad request" }, 400);
  }
}
