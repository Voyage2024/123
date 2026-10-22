import { NextResponse } from "next/server";

import { bunkerSupabase, clearBunkerToken, getBunkerToken } from "@/lib/bunker/session";

/* POST /bunker/lock — закрыть PIN-сессию. Зовётся через navigator.sendBeacon
 * при сворачивании приложения, поэтому ответ пустой и быстрый. */

export const dynamic = "force-dynamic";

export async function POST() {
  const token = await getBunkerToken();
  if (token) {
    const supabase = await bunkerSupabase(token);
    await supabase.rpc("bunker_end_session");
  }
  await clearBunkerToken();
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
