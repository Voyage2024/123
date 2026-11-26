// Заглушка @/lib/server/require-role: та же логика (роль из profiles по auth.uid, бан), пользователь — globalThis.__testUid.
import { execFileSync } from "node:child_process";
export class AuthorizationError extends Error { constructor(m = "You are not authorized to perform this action.") { super(m); this.name = "AuthorizationError"; } }
export async function requireRole(allowed) {
  const uid = globalThis.__testUid;
  if (!uid) throw new AuthorizationError("Please sign in.");
  const out = execFileSync("psql", ["-h", "127.0.0.1", "-p", "55432", "-U", "postgres", "-d", "postgres", "-At", "-c",
    `select role::text || '|' || coalesce(coalesce(ban_permanent,false) or banned_until = 'infinity' or banned_until > now(), false)::text from public.profiles where id = '${uid.replace(/'/g, "")}'`],
    { env: { ...process.env, PGPASSWORD: "postgres" } }).toString().trim();
  const [role, banned] = out.split("|");
  if (!role || !allowed.includes(role)) throw new AuthorizationError("You do not have permission to perform this action.");
  if (banned === "true") throw new AuthorizationError("Access is restricted for this account.");
  return { userId: uid, role };
}
