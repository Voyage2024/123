// Собирает настоящие Server Actions из репозитория в один ESM-бандл,
// подменяя только инфраструктуру Next/Supabase (и существующий createConciergeRequest) на заглушки стенда.
// usage: node build_actions.mjs <repo-root> <out.mjs>
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const [root, out, mode] = process.argv.slice(2);
// mode "real-concierge": настоящий app/actions/concierge.ts (для проверки защиты KYC-запросов).
const stubs = {
  "next/cache": path.join(here, "stubs/next-cache.mjs"),
  "next/headers": path.join(here, "stubs/next-headers.mjs"),
  "@/lib/supabase/server": path.join(here, "stubs/supabase-server.mjs"),
  "@/lib/server/telegram/service-client": path.join(here, "stubs/service-client.mjs"),
  ...(mode === "real-concierge"
    ? { "@supabase/supabase-js": path.join(here, "stubs/supabase-js.mjs"), grammy: path.join(here, "stubs/grammy.mjs"), "@/lib/server/telegram/admin-notifications": path.join(here, "stubs/admin-notifications.mjs") }
    : { "@/app/actions/concierge": path.join(here, "stubs/concierge.mjs") }),
  "@/lib/server/require-role": path.join(here, "stubs/require-role.mjs"),
  "server-only": path.join(here, "stubs/server-only.mjs"),
};
const file = (base) => [".ts", ".tsx", "/index.ts"].map((e) => base + e).find((f) => fs.existsSync(f));
await build({
  stdin: {
    contents: `export { updateResidentProfileFields, requestResidentIdentityChange, getResidentIdentityLock } from "@/app/actions/resident-profile-fields";
export { staffUpdateResidentIdentity } from "@/app/actions/admin-resident-identity";
export { updateResidentPhysical } from "@/app/actions/resident-physical";
export { updateResidentSizes } from "@/app/actions/resident-sizes";
export * as fieldsLib from "@/lib/resident-profile-fields";
export { approveResidentIdentityRequest, rejectResidentIdentityRequest } from "@/app/actions/admin-identity-requests";
export { loadIdentityCard } from "@/lib/server/identity-requests";
export { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
export * as requestsLib from "@/lib/resident-identity-requests";
${mode === "real-concierge" ? 'export { updateConciergeRequest, replyToConciergeRequest, createConciergeRequest } from "@/app/actions/concierge";' : ""}`,
    resolveDir: root, loader: "ts",
  },
  bundle: true, format: "esm", platform: "node", outfile: out, logLevel: "error",
  plugins: [{
    name: "voyage-alias",
    setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => {
        if (stubs[a.path]) return { path: stubs[a.path] };
        if (a.path.startsWith("@/")) return { path: file(path.join(root, a.path.slice(2))) };
        return undefined;
      });
    },
  }],
});
