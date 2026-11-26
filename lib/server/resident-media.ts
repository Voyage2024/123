import "server-only";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity — серверные помощники
 * lib/server/resident-media.ts
 *
 * Разбор ответа RPC voyage_resident_media_for_viewer и подпись ссылок.
 * Подписываются ТОЛЬКО пути, которые эта RPC вернула текущему
 * пользователю, и только из папки той резидентки, о которой шёл запрос.
 * Путь от клиента сюда не попадает никогда.
 * ──────────────────────────────────────────────────────────────────── */

import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import {
  MEDIA_BUCKET,
  MEDIA_SIGNED_TTL,
  type MediaBundle,
  type MediaFailure,
  type MediaItem,
  type ProfileViews,
  type VideoScope,
} from "@/lib/resident-media";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH_RE = /^[0-9a-f-]{36}\/(intro|moment)\/[0-9a-f-]{36}\.(mp4|mov|webm|jpg)$/;

export type { MediaFailure };

export function mediaFailureOf(error: { code?: string | null; message?: string | null } | null): MediaFailure {
  const msg = error?.message ?? "";
  if (msg.includes("voyage:consent_required")) return "consent_required";
  if (msg.includes("voyage:media_limit")) return "limit";
  if (msg.includes("voyage:media_not_found") || error?.code === "P0002") return "not_found";
  if (msg.includes("voyage:not_authenticated") || error?.code === "28000") return "unauthenticated";
  if (msg.includes("voyage:forbidden") || error?.code === "42501") return "forbidden";
  if (error?.code === "42883" || error?.code === "PGRST202" || error?.code === "42P01") return "schema";
  if (error?.code === "22023" || error?.code === "22P02" || error?.code === "23514") return "invalid";
  console.error("[resident-media]", error?.code ?? "unknown");
  return "failed";
}

export function isMediaPathOf(profileId: string, path: unknown): path is string {
  return typeof path === "string" && PATH_RE.test(path) && path.split("/")[0] === profileId;
}

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data, error } = await getTelegramServiceClient().storage.from(MEDIA_BUCKET).createSignedUrls(paths, MEDIA_SIGNED_TTL);
  if (error) console.error("[resident-media] sign", error.name ?? "unknown");
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl);
  }
  return out;
}

type RawItem = Record<string, unknown>;

/** Ответ RPC → MediaBundle с подписанными ссылками (10 минут). */
export async function bundleFromRpc(residentId: string, data: unknown): Promise<MediaBundle | null> {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const rawItems = Array.isArray(d.items) ? (d.items as RawItem[]) : [];
  const paths: string[] = [];
  for (const it of rawItems) {
    if (isMediaPathOf(residentId, it.storage_path)) paths.push(it.storage_path);
    if (isMediaPathOf(residentId, it.poster_path)) paths.push(it.poster_path);
  }
  const signed = await signPaths(paths);
  const items: MediaItem[] = rawItems
    .filter((it) => typeof it.id === "string" && (it.kind === "intro" || it.kind === "moment"))
    .map((it) => ({
      id: String(it.id),
      kind: it.kind as MediaItem["kind"],
      source: it.source === "upload" ? "upload" : "in_app_camera",
      topic: typeof it.topic === "string" ? it.topic : null,
      mime: typeof it.mime === "string" ? it.mime : "video/mp4",
      durationMs: Number(it.duration_ms) || 0,
      width: typeof it.width === "number" ? it.width : null,
      height: typeof it.height === "number" ? it.height : null,
      status: it.status === "hidden_by_staff" ? "hidden_by_staff" : "active",
      hiddenReason: typeof it.hidden_reason === "string" ? it.hidden_reason : null,
      recordedAt: String(it.recorded_at ?? ""),
      src: typeof it.storage_path === "string" ? signed.get(it.storage_path) ?? null : null,
      poster: typeof it.poster_path === "string" ? signed.get(it.poster_path) ?? null : null,
    }));
  const access = d.access === "self" || d.access === "staff" || d.access === "casting" || d.access === "tour" ? d.access : null;
  if (!access) return null;
  const scope: VideoScope = d.scope === "hidden" || d.scope === "catalog" ? d.scope : "engaged";
  return {
    access,
    scope,
    consent: d.consent === true,
    latestAt: typeof d.latest_at === "string" ? d.latest_at : null,
    items,
  };
}

export function viewsFromRpc(data: unknown): ProfileViews {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const items = Array.isArray(d.items) ? (d.items as RawItem[]) : [];
  return {
    week: Number(d.week) || 0,
    month: Number(d.month) || 0,
    items: items.map((it) => ({
      viewer: typeof it.viewer === "string" ? it.viewer : null,
      staff: it.staff === true,
      badge: typeof it.badge === "string" ? it.badge : null,
      context: it.context === "tour" || it.context === "admin" || it.context === "catalog" ? it.context : "casting",
      contextLabel: typeof it.context_label === "string" ? it.context_label : null,
      what: it.what === "video" ? "video" : "profile",
      at: String(it.at ?? ""),
    })),
  };
}

/** Удаляет файлы из бакета; ошибки только логируются (строка в базе уже удалена). */
export async function removeMediaFiles(profileId: string, paths: unknown): Promise<void> {
  const list = (Array.isArray(paths) ? paths : []).filter((p): p is string => isMediaPathOf(profileId, p));
  if (!list.length) return;
  const { error } = await getTelegramServiceClient().storage.from(MEDIA_BUCKET).remove(list);
  if (error) console.error("[resident-media] remove files", error.name ?? "unknown");
}
