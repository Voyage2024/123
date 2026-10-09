import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/* ──────────────────────────────────────────────────────────────────────
 * Клиент Supabase — наша линия связи с базой.
 *
 * Ключи берутся из скрытого файла .env.local.
 *
 * `supabase` создаётся через createBrowserClient из @supabase/ssr:
 * сессия хранится в cookies (а не в localStorage), поэтому middleware
 * на сервере видит, кто залогинен. В браузере это синглтон.
 *
 * `createClient` по-прежнему экспортируется — если он где-то
 * используется в проекте (например, для серверного клиента
 * с service role ключом), импорты не сломаются.
 * ──────────────────────────────────────────────────────────────────── */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Не найдены NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY. Проверь файл .env.local"
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export { createClient };
