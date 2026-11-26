// Заглушка @supabase/supabase-js для настоящего app/actions/concierge.ts: сервисный клиент = psql под service_role.
import { getTelegramServiceClient } from "./service-client.mjs";
export function createClient() { return getTelegramServiceClient(); }
