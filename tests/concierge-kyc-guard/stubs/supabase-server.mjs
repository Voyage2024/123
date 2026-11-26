// Заглушка @/lib/supabase/server: сессия = пользователь из globalThis.__testUid.
// rpc() выполняется от имени этого пользователя (role authenticated + JWT), как через PostgREST.
import { runAs, rpcSql } from "./pgrun.mjs";
import { clientAs } from "./service-client.mjs";
export async function createClient() {
  return {
    auth: {
      async getUser() {
        const id = globalThis.__testUid ?? null;
        return id ? { data: { user: { id, email: `${id.slice(-2)}@t.test` } }, error: null } : { data: { user: null }, error: { message: "no session" } };
      },
    },
    from(name) { return clientAs(globalThis.__testUid).from(name); },
    async rpc(name, args) {
      globalThis.__sessionRpc = [...(globalThis.__sessionRpc ?? []), { name, args, uid: globalThis.__testUid }];
      return runAs("authenticated", globalThis.__testUid, rpcSql(name, args));
    },
  };
}
