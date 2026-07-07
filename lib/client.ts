import { createBrowserClient } from "@supabase/ssr";

/* ──────────────────────────────────────────────────────────────────────
 * Браузерный клиент — для клиентских компонентов ("use client").
 * Например, отсюда его берёт AuthContext. Читает сессию из cookie,
 * которые проставляет серверная часть @supabase/ssr.
 * ──────────────────────────────────────────────────────────────────── */

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
