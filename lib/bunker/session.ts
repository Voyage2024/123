import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ──────────────────────────────────────────────────────────────────────
 * PIN-сессия бункера на сервере.
 *
 * Токен сессии выдаёт база (bunker_unlock / bunker_setup_master), мы
 * храним его только в httpOnly-cookie — JavaScript страницы его не видит.
 * В каждый запрос к Supabase токен уходит заголовком x-bunker-session,
 * а RLS таблиц бункера сверяет его с bunker_sessions.
 * ──────────────────────────────────────────────────────────────────── */

export const BUNKER_COOKIE = "bunker_sid";

export async function getBunkerToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(BUNKER_COOKIE)?.value ?? "";
  return /^[0-9a-f]{64}$/.test(value) ? value : null;
}

export async function setBunkerToken(token: string) {
  const store = await cookies();
  store.set(BUNKER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

export async function clearBunkerToken() {
  const store = await cookies();
  store.delete(BUNKER_COOKIE);
}

/** Серверный клиент Supabase с сессией пользователя и (если есть) PIN-токеном. */
export async function bunkerSupabase(token: string | null) {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // вызов вне server action / route handler — cookie обновит middleware
        }
      },
    },
    global: token ? { headers: { "x-bunker-session": token } } : undefined,
  });
}
