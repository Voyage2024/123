import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ──────────────────────────────────────────────────────────────────────
 * Серверный клиент — для server components, server actions и route
 * handlers. Именно его импортируют page.tsx и actions.ts в Face Control.
 *
 * В Next 15 cookies() асинхронный, поэтому функция async → в коде вызывать
 * как `const supabase = await createClient();` (как и написано в Face Control).
 * ──────────────────────────────────────────────────────────────────── */

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Вызов из Server Component, где cookie менять нельзя.
            // Это ок, если сессию обновляет middleware — можно игнорировать.
          }
        },
      },
    },
  );
}
