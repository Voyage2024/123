// Заглушка getTelegramServiceClient: тот же интерфейс supabase-js
// (from().select().eq().maybeSingle(), from().update().eq().select().maybeSingle()),
// но запросы идут в стенд через psql под ролью service_role — как PostgREST с сервисным ключом.
import { execFileSync } from "node:child_process";

const lit = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const ident = (c) => { if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error("bad column " + c); return '"' + c + '"'; };
const cols = (list) => list.split(",").map((c) => ident(c.trim())).join(",");

let CTX = { role: "service_role", claims: { role: "service_role" } };
function run(sql) {
  try {
    const out = execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate"], {
      input: `\\set VERBOSITY sqlstate\nbegin;\nselect set_config('request.jwt.claims', ${lit(JSON.stringify(CTX.claims))}, true), set_config('request.jwt.claim.role', ${lit(CTX.claims.role)}, true), set_config('request.jwt.claim.sub', ${lit(CTX.claims.sub ?? "")}, true) \\gset\nset local role ${CTX.role};\n${sql};\ncommit;\n`,
      env: { ...process.env, PGPASSWORD: "postgres" },
      stdio: ["pipe", "pipe", "pipe"],
    }).toString().trim().split("\n").filter((l) => l && l !== "SET" && l !== "BEGIN" && l !== "COMMIT");
    const line = out.find((l) => l.startsWith("{") || l === "true" || l === "false" || l.startsWith("[") || l.startsWith("\""));
    return { data: line ? JSON.parse(line) : null, error: null };
  } catch (e) {
    const msg = String(e.stderr ?? e.message);
    const code = (msg.match(/ERROR:\s+([0-9A-Z]{5})/) ?? [])[1] ?? "unknown";
    globalThis.__dbErrors = [...(globalThis.__dbErrors ?? []), msg.trim()];
    return { data: null, error: { code, message: msg } };
  }
}

function table(name) {
  const t = ident(name);
  return {
    select(list) {
      const filters = [];
      let order = "", lim = "";
      const where = () => (filters.length ? `where ${filters.join(" and ")}` : "");
      const q = {
        eq(c, v) { filters.push(`${ident(c)} = ${lit(v)}`); return q; },
        in(c, vs) { filters.push(`${ident(c)} in (${vs.map(lit).join(",")})`); return q; },
        like(c, v) { filters.push(`${ident(c)} like ${lit(v)}`); return q; },
        order(c, o) { order = `order by ${ident(c)} ${o && o.ascending === false ? "desc" : "asc"}`; return q; },
        limit(n) { lim = `limit ${Number(n)}`; return q; },
        async maybeSingle() {
          return run(`select row_to_json(x) from (select ${cols(list)} from public.${t} ${where()} ${order} limit 1) x`);
        },
        then(res, rej) {
          const r = run(`select coalesce(jsonb_agg(x), '[]'::jsonb) from (select ${cols(list)} from public.${t} ${where()} ${order} ${lim}) x`);
          return Promise.resolve(r).then(res, rej);
        },
      };
      return q;
    },
    insert(row) {
      const keys = Object.keys(row).map(ident);
      const json = lit(JSON.stringify(row));
      let returning = "id";
      const q = {
        select(list) { returning = cols(list); return q; },
        async single() {
          globalThis.__inserts = [...(globalThis.__inserts ?? []), { table: name, row }];
          return run(`with i as (insert into public.${t} (${keys.join(",")}) select ${keys.join(",")} from json_populate_record(null::public.${t}, ${json}::json) returning ${returning}) select row_to_json(i) from i`);
        },
      };
      return q;
    },
    delete() {
      const filters = [];
      const q = {
        eq(c, v) { filters.push(`${ident(c)} = ${lit(v)}`); return q; },
        then(res) { res(run(`delete from public.${t} where ${filters.join(" and ")}`)); },
      };
      return q;
    },
    update(patch) {
      const keys = Object.keys(patch).map(ident);
      const json = lit(JSON.stringify(patch));
      const filters = [];
      let returning = "id";
      const q = {
        eq(c, v) { filters.push(`${ident(c)} = ${lit(v)}`); return q; },
        in(c, vs) { filters.push(`${ident(c)} in (${vs.map(lit).join(",")})`); return q; },
        select(list) { returning = cols(list); return q; },
        async maybeSingle() {
          globalThis.__updates = [...(globalThis.__updates ?? []), Object.keys(patch)];
          if (globalThis.__failUpdate === name) return { data: null, error: { code: "57014", message: "test: update failed" } };
          return run(`with u as (update public.${t} set (${keys.join(",")}) = (select ${keys.join(",")} from json_populate_record(null::public.${t}, ${json}::json)) where ${filters.join(" and ")} returning ${returning}) select row_to_json(u) from u`);
        },
      };
      return q;
    },
  };
}

function rpc(name, args) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("bad rpc");
  const parts = Object.entries(args ?? {}).map(([k, v]) => `${k} => ${v !== null && typeof v === "object" ? lit(JSON.stringify(v)) + "::jsonb" : lit(v)}`);
  return Promise.resolve(run(`select to_jsonb(public.${name}(${parts.join(", ")}))`)).then((r) => {
    if (r.error) return r;
    return r;
  });
}

const withCtx = (ctx, fn) => (...args) => { const prev = CTX; CTX = ctx; try { return fn(...args); } finally { CTX = prev; } };
// Запрос резолвится синхронно (execFileSync) внутри maybeSingle/single/then, поэтому контекст оборачивает и их.
function wrapQuery(ctx, q) {
  return new Proxy(q, { get(target, key) {
    const v = target[key];
    if (typeof v !== "function") return v;
    return (...args) => { const prev = CTX; CTX = ctx; try { const r = v.apply(target, args); return r === target ? wrapQuery(ctx, target) : r; } finally { CTX = prev; } };
  } });
}
export function getTelegramServiceClient() { return { from: table, rpc }; }
/** Клиент «как PostgREST с JWT пользователя»: роль authenticated, auth.uid() = uid (RLS и права на колонки работают). */
export function clientAs(uid) {
  const ctx = { role: "authenticated", claims: { sub: uid, role: "authenticated" } };
  return { from: (name) => wrapQuery(ctx, table(name)), rpc: withCtx(ctx, rpc) };
}
