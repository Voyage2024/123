// Заглушка существующего createConciergeRequest (app/actions/concierge.ts не меняется):
// запоминает вызов и создаёт заявку в стенде так же, как настоящая функция
// (resident_id, title, category, message, trip_stage, status 'open').
import { execFileSync } from "node:child_process";
const lit = (v) => (v === null || v === undefined ? "null" : "'" + String(v).replace(/'/g, "''") + "'");
export async function createConciergeRequest(input) {
  globalThis.__conciergeCalls = [...(globalThis.__conciergeCalls ?? []), input];
  const uid = globalThis.__testUid;
  const out = execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-q", "-c",
    `insert into public.partner_concierge_requests (resident_id, title, category, message, trip_stage, preferred_language, status)
     values (${lit(uid)}, ${lit(input.title)}, ${lit(input.category)}, ${lit(input.message)}, ${lit(input.tripStage)}, ${lit(input.language)}, 'open') returning id`],
    { env: { ...process.env, PGPASSWORD: "postgres" } }).toString().trim();
  return { ok: true, request: { id: out.split("\n").pop() } };
}

// Заглушка существующего replyToConciergeRequest: как настоящая — requireRole(manager/admin/owner),
// затем public.voyage_concierge_reply под service_role (сообщение + статус одной транзакцией),
// затем «Telegram» (здесь — запись в globalThis.__telegram).
import { requireRole, AuthorizationError } from "./require-role.mjs";
export async function replyToConciergeRequest(input) {
  globalThis.__replyCalls = [...(globalThis.__replyCalls ?? []), input];
  if (globalThis.__replyFail) return { ok: false, reason: "server_error" };
  let userId;
  try { ({ userId } = await requireRole(["manager", "admin", "owner"])); } catch (e) { if (e instanceof AuthorizationError) return { ok: false, reason: "forbidden" }; throw e; }
  try {
    const out = execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-q", "-v", "ON_ERROR_STOP=1"], {
      input: `begin;\nselect set_config('request.jwt.claims', '{"role":"service_role"}', true), set_config('request.jwt.claim.role', 'service_role', true) \\gset\nset local role service_role;\nselect public.voyage_concierge_reply(${lit(input.id)}, ${lit(userId)}, ${lit(input.message)}, ${lit(input.status)});\ncommit;\n`,
      env: { ...process.env, PGPASSWORD: "postgres" }, stdio: ["pipe", "pipe", "pipe"],
    }).toString().trim();
    globalThis.__telegram = [...(globalThis.__telegram ?? []), { requestId: input.id, body: input.message }];
    return { ok: true, messageId: out.split("\n").pop(), telegramSent: true };
  } catch (e) {
    globalThis.__dbErrors = [...(globalThis.__dbErrors ?? []), String(e.stderr)];
    return { ok: false, reason: "server_error" };
  }
}
