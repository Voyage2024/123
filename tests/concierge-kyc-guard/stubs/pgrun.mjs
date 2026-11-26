// Общий исполнитель SQL стенда: как PostgREST — либо под service_role, либо под authenticated с JWT пользователя.
import { execFileSync } from "node:child_process";
export const lit = (v) => (v === null || v === undefined ? "null" : "'" + String(v).replace(/'/g, "''") + "'");
export function runAs(role, uid, sql) {
  const claims = uid ? `select set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: uid, role: "authenticated" }))}, true), set_config('request.jwt.claim.sub', ${lit(uid)}, true) \\gset\n` : "";
  try {
    const out = execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1"], {
      input: `\\set VERBOSITY verbose\nbegin;\n${claims}set local role ${role};\n${sql};\ncommit;\n`,
      env: { ...process.env, PGPASSWORD: "postgres" },
      stdio: ["pipe", "pipe", "pipe"],
    }).toString().trim().split("\n").filter((l) => l && !["SET", "BEGIN", "COMMIT"].includes(l));
    const line = [...out].reverse().find((l) => l.startsWith("{") || l.startsWith("[") || l === "true" || l === "false" || l.startsWith('"'));
    return { data: line === undefined ? null : JSON.parse(line), error: null };
  } catch (e) {
    const msg = String(e.stderr ?? e.message);
    const m = msg.match(/ERROR:\s+([0-9A-Z]{5}):\s+(.*)/);
    globalThis.__dbErrors = [...(globalThis.__dbErrors ?? []), msg.trim()];
    return { data: null, error: { code: m?.[1] ?? "unknown", message: m?.[2] ?? msg } };
  }
}
export function rpcSql(name, args) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("bad rpc");
  const parts = Object.entries(args ?? {}).map(([k, v]) => {
    if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error("bad arg");
    if (v !== null && typeof v === "object") return `${k} => ${lit(JSON.stringify(v))}::jsonb`;
    return `${k} => ${lit(v)}`;
  });
  return `select to_jsonb(public.${name}(${parts.join(", ")}))`;
}
