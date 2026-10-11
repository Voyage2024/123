import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/** Server-only service-role client. Never import this module into client components. */
export function getTelegramServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Telegram webhook Supabase configuration is missing.");
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "voyage-concierge-next-webhook" } },
  });
  return cachedClient;
}
