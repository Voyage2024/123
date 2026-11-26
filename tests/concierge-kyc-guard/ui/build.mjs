// Собирает настоящий ConciergeAdminChecklist.tsx; заменены только Server Actions, язык и next/link.
import path from "node:path";
import fs from "node:fs";
import * as esbuild from "esbuild";
const [P, outfile] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const S = path.join(here, "stub");
const special = { "@/app/actions/concierge": "concierge.ts", "@/app/context/LanguageContext": "lang.tsx", "next/link": "link.tsx" };
const file = (base) => ["", ".tsx", ".ts"].map((e) => base + e).find((f) => { try { return fs.statSync(f).isFile(); } catch { return false; } });
await esbuild.build({
  entryPoints: [path.join(here, "entry.tsx")], bundle: true, outfile, format: "esm", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' }, nodePaths: [path.join(P, "node_modules")], logLevel: "error",
  plugins: [{ name: "alias", setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (special[a.path]) return { path: path.join(S, special[a.path]) };
      if (a.path.startsWith("@/")) return { path: file(path.join(P, a.path.slice(2))) };
      return undefined;
    });
  } }],
});
