"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · лист ожидания локации (owner / admin)
 * app/actions/location-waiting-list.ts
 *
 *   getLocationWaitingList    таблица с фильтрами — RPC voyage_location_waiting_list
 *   getLocationOpenCastings   открытые кастинги локации — voyage_location_open_castings
 *
 * Пригласить в тур / кастинг — существующий inviteResidents из
 * app/actions/resident-registry.ts (RPC voyage_invite_residents + Telegram).
 * Доступ проверяется дважды: requireRole здесь и is_admin() в RPC.
 * ──────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import {
  parseOpenCastings,
  parseWaitingPage,
  waitingFiltersToRpc,
  type OpenCasting,
  type WaitingFilters,
  type WaitingPage,
} from "@/lib/location-waiting-list";

type Failure = "forbidden" | "invalid" | "schema" | "failed";
export type WaitingListResult = { ok: true; page: WaitingPage } | { ok: false; reason: Failure };
export type OpenCastingsResult = { ok: true; castings: OpenCasting[] } | { ok: false; reason: Failure };

const PAGE_MAX = 300;
const SIGNED_TTL = 60 * 60;

async function guard(): Promise<Failure | null> {
  try {
    await requireRole(["owner", "admin"]);
    return null;
  } catch (error) {
    if (error instanceof AuthorizationError) return "forbidden";
    throw error;
  }
}

function failureOf(error: { code?: string; message?: string }): Failure {
  console.error("[location-waiting-list]", error.code, error.message);
  const msg = error.message ?? "";
  if (error.code === "42501" || msg.includes("voyage:forbidden")) return "forbidden";
  if (error.code === "42883" || error.code === "PGRST202" || error.code === "42P01") return "schema";
  if (error.code === "22023" || error.code === "22P02" || error.code === "22007" || error.code === "22008") return "invalid";
  return "failed";
}

/** Фото в приватном бакете user-uploads → подписанная ссылка на час */
async function signPhotos(page: WaitingPage): Promise<WaitingPage> {
  const paths = Array.from(new Set(page.rows.map((r) => r.photo).filter((p): p is string => !!p && !/^https?:\/\//i.test(p))));
  if (paths.length === 0) return page;
  try {
    const { data } = await getTelegramServiceClient().storage.from("user-uploads").createSignedUrls(paths, SIGNED_TTL);
    const map = new Map<string, string>();
    for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    return {
      ...page,
      rows: page.rows.map((r) => ({
        ...r,
        photo: r.photo && !/^https?:\/\//i.test(r.photo) ? map.get(r.photo) ?? null : r.photo,
      })),
    };
  } catch (error) {
    console.error("[location-waiting-list] sign photos", error);
    return { ...page, rows: page.rows.map((r) => ({ ...r, photo: r.photo && /^https?:\/\//i.test(r.photo) ? r.photo : null })) };
  }
}

export async function getLocationWaitingList(input: {
  filters?: WaitingFilters;
  limit?: number;
  offset?: number;
}): Promise<WaitingListResult> {
  const denied = await guard();
  if (denied) return { ok: false, reason: denied };
  const limit = Math.min(Math.max(Number(input?.limit) || 100, 1), PAGE_MAX);
  const offset = Math.max(Number(input?.offset) || 0, 0);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_location_waiting_list", {
    p_filters: waitingFiltersToRpc(input?.filters ?? {}),
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true, page: await signPhotos(parseWaitingPage(data)) };
}

export async function getLocationOpenCastings(hubId: string): Promise<OpenCastingsResult> {
  const denied = await guard();
  if (denied) return { ok: false, reason: denied };
  if (typeof hubId !== "string" || !hubId.trim() || hubId.length > 120) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_location_open_castings", { p_hub: hubId });
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true, castings: parseOpenCastings(data) };
}
