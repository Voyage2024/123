"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity — действия резидентки со своим видео
 * app/actions/resident-media.ts
 *
 * Как устроена загрузка (браузер никогда не пишет в бакет сам):
 *   1. createMediaUploadSlot — сервер проверяет роль, бан, согласие,
 *      лимит Moments, формат и размер и выдаёт одноразовый signed-слот
 *      на путь <profile>/<kind>/<uuid>.<ext> (+ слот для обложки .jpg).
 *   2. Браузер загружает файл по слоту прямо в Storage (без лимита
 *      размера тела server action).
 *   3. attachMedia — сервер проверяет, что файл реально лежит в бакете,
 *      его размер и первые байты (MP4/MOV — "ftyp", WebM — EBML), и
 *      только потом пишет строку через voyage_media_attach. Любая ошибка
 *      → загруженные файлы удаляются.
 *
 * Чтение — через RPC voyage_resident_media_for_viewer от имени сессии:
 * права решает база. Подписываются только пути, которые вернула RPC.
 * ──────────────────────────────────────────────────────────────────── */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import {
  EXT_BY_MIME,
  INTRO_MAX_BYTES,
  INTRO_MAX_SECONDS,
  MEDIA_BUCKET,
  MOMENT_MAX_BYTES,
  MOMENT_MAX_COUNT,
  MOMENT_MAX_SECONDS,
  MOMENT_MIN_SECONDS,
  MOMENT_TOPICS,
  POSTER_MAX_BYTES,
  baseMime,
  type MediaBundle,
  type MediaKind,
  type MediaSource,
  type ProfileViews,
  type VideoScope,
} from "@/lib/resident-media";
import {
  UUID_RE,
  bundleFromRpc,
  isMediaPathOf,
  mediaFailureOf,
  removeMediaFiles,
  viewsFromRpc,
  type MediaFailure,
} from "@/lib/server/resident-media";

type Fail = { ok: false; reason: MediaFailure };
export type MyMediaResult = { ok: true; bundle: MediaBundle } | Fail;
export type MyViewsResult = { ok: true; views: ProfileViews } | Fail;
export type MediaSlot = { path: string; token: string; posterPath: string | null; posterToken: string | null };
export type SlotResult = { ok: true; slot: MediaSlot } | Fail;
export type VisibilityResult = { ok: true; scope: VideoScope; consent: boolean } | Fail;
export type SimpleResult = { ok: true } | Fail;

const INTRO_MIN_SECONDS = 1;

async function sessionResident(): Promise<{ ok: true; id: string } | Fail> {
  const session = await createClient();
  const { data, error } = await session.auth.getUser();
  if (error || !data.user) return { ok: false, reason: "unauthenticated" };
  // Как и во всех RPC VOYAGE: profiles.id = auth.uid().
  const { data: row, error: rowError } = await getTelegramServiceClient()
    .from("profiles")
    .select("id,role,banned_until,ban_permanent")
    .eq("id", data.user.id)
    .maybeSingle();
  if (rowError) return { ok: false, reason: "failed" };
  if (!row || String(row.role) !== "resident") return { ok: false, reason: "forbidden" };
  const banned =
    row.ban_permanent === true ||
    (typeof row.banned_until === "string" && (row.banned_until === "infinity" || Date.parse(row.banned_until) > Date.now()));
  if (banned) return { ok: false, reason: "forbidden" };
  return { ok: true, id: String(row.id) };
}

function revalidate() {
  revalidatePath("/dashboard");
}

/** Своё видео (включая скрытое администрацией, с причиной) + настройки видимости. */
export async function getMyVideoIdentity(): Promise<MyMediaResult> {
  const me = await sessionResident();
  if (!me.ok) return me;
  const session = await createClient();
  const { data, error } = await session.rpc("voyage_resident_media_for_viewer", {
    p_resident: me.id,
    p_context: null,
    p_context_id: null,
  });
  if (error) return { ok: false, reason: mediaFailureOf(error) };
  const bundle = await bundleFromRpc(me.id, data);
  return bundle ? { ok: true, bundle } : { ok: false, reason: "failed" };
}

/** «Кто смотрел»: менеджеры по имени, персонал — как «Администрация VOYAGE». */
export async function getMyProfileViews(): Promise<MyViewsResult> {
  const session = await createClient();
  const { data, error } = await session.rpc("voyage_my_profile_views", { p_limit: 50 });
  if (error) return { ok: false, reason: mediaFailureOf(error) };
  return { ok: true, views: viewsFromRpc(data) };
}

export async function setMyVideoVisibility(scope: VideoScope | null, consent: boolean | null): Promise<VisibilityResult> {
  if (scope !== null && scope !== "engaged" && scope !== "hidden") return { ok: false, reason: "invalid" };
  if (consent !== null && typeof consent !== "boolean") return { ok: false, reason: "invalid" };
  const session = await createClient();
  const { data, error } = await session.rpc("voyage_set_media_visibility", { p_scope: scope, p_consent: consent });
  if (error) return { ok: false, reason: mediaFailureOf(error) };
  const d = (data ?? {}) as { scope?: string; consent?: boolean };
  revalidate();
  return {
    ok: true,
    scope: d.scope === "hidden" || d.scope === "catalog" ? d.scope : "engaged",
    consent: d.consent === true,
  };
}

export async function createMediaUploadSlot(input: {
  kind: MediaKind;
  mime: string;
  sizeBytes: number;
  withPoster: boolean;
}): Promise<SlotResult> {
  const kind = input?.kind;
  const mime = baseMime(input?.mime);
  const size = Number(input?.sizeBytes);
  if ((kind !== "intro" && kind !== "moment") || !mime || !Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: "invalid" };
  }
  if (size > (kind === "intro" ? INTRO_MAX_BYTES : MOMENT_MAX_BYTES)) return { ok: false, reason: "too_large" };

  const me = await sessionResident();
  if (!me.ok) return me;
  const db = getTelegramServiceClient();

  const { data: vis, error: visError } = await db
    .from("resident_visibility")
    .select("video_consent_at")
    .eq("resident_id", me.id)
    .maybeSingle();
  if (visError) return { ok: false, reason: mediaFailureOf(visError) };
  if (!vis?.video_consent_at) return { ok: false, reason: "consent_required" };

  if (kind === "moment") {
    const { count, error } = await db
      .from("resident_media")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", me.id)
      .eq("kind", "moment");
    if (error) return { ok: false, reason: mediaFailureOf(error) };
    if ((count ?? 0) >= MOMENT_MAX_COUNT) return { ok: false, reason: "limit" };
  }

  const path = `${me.id}/${kind}/${randomUUID()}.${EXT_BY_MIME[mime]}`;
  const bucket = db.storage.from(MEDIA_BUCKET);
  const video = await bucket.createSignedUploadUrl(path);
  if (video.error || !video.data?.token) {
    console.error("[resident-media] slot", video.error?.name ?? "unknown");
    return { ok: false, reason: "failed" };
  }
  let posterPath: string | null = null;
  let posterToken: string | null = null;
  if (input.withPoster) {
    posterPath = `${me.id}/${kind}/${randomUUID()}.jpg`;
    const poster = await bucket.createSignedUploadUrl(posterPath);
    if (poster.error || !poster.data?.token) posterPath = null;
    else posterToken = poster.data.token;
  }
  return { ok: true, slot: { path, token: video.data.token, posterPath, posterToken } };
}

type StoredObject = { size: number; mime: string | null };

async function storedObject(path: string): Promise<StoredObject | null> {
  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data, error } = await getTelegramServiceClient().storage.from(MEDIA_BUCKET).list(folder, { search: name, limit: 5 });
  if (error) return null;
  const item = (data ?? []).find((x) => x.name === name);
  if (!item) return null;
  const meta = (item.metadata ?? {}) as { size?: number; mimetype?: string };
  return { size: Number(meta.size) || 0, mime: typeof meta.mimetype === "string" ? meta.mimetype : null };
}

/** Первые байты файла: MP4/MOV — "ftyp" на смещении 4, WebM — EBML 1A 45 DF A3, JPEG — FF D8 FF. */
async function headerMatches(path: string, expect: "video" | "jpeg"): Promise<boolean> {
  const { data } = await getTelegramServiceClient().storage.from(MEDIA_BUCKET).createSignedUrl(path, 60);
  if (!data?.signedUrl) return false;
  try {
    const res = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" }, cache: "no-store" });
    if (!res.ok && res.status !== 206) return false;
    const buf = new Uint8Array(await res.arrayBuffer()).slice(0, 16);
    if (expect === "jpeg") return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const ftyp = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]) === "ftyp";
    const ebml = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    return ftyp || ebml;
  } catch {
    return false;
  }
}

export async function attachMedia(input: {
  kind: MediaKind;
  source: MediaSource;
  topic: string | null;
  path: string;
  posterPath: string | null;
  durationMs: number;
  width: number | null;
  height: number | null;
}): Promise<MyMediaResult> {
  const me = await sessionResident();
  if (!me.ok) return me;

  const kind = input?.kind;
  const source = input?.source;
  const path = String(input?.path ?? "");
  const posterPath = input?.posterPath ? String(input.posterPath) : null;
  const cleanup = () => removeMediaFiles(me.id, [path, posterPath]);

  const duration = Math.round(Number(input?.durationMs));
  const topic = typeof input?.topic === "string" && (MOMENT_TOPICS as readonly string[]).includes(input.topic) ? input.topic : null;
  const dim = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 16 && v <= 4096 ? Math.round(v) : null);
  const valid =
    (kind === "intro" || kind === "moment") &&
    (source === "in_app_camera" || source === "upload") &&
    !(kind === "moment" && source !== "in_app_camera") &&
    isMediaPathOf(me.id, path) &&
    path.split("/")[1] === kind &&
    !path.endsWith(".jpg") &&
    (posterPath === null || (isMediaPathOf(me.id, posterPath) && posterPath.endsWith(".jpg"))) &&
    Number.isFinite(duration) &&
    (kind === "intro"
      ? duration >= INTRO_MIN_SECONDS * 1000 && duration <= (INTRO_MAX_SECONDS + 2) * 1000
      : duration >= MOMENT_MIN_SECONDS * 1000 - 500 && duration <= (MOMENT_MAX_SECONDS + 1.5) * 1000);
  if (!valid) {
    if (isMediaPathOf(me.id, path)) await cleanup();
    return { ok: false, reason: "invalid" };
  }

  const stored = await storedObject(path);
  const maxBytes = kind === "intro" ? INTRO_MAX_BYTES : MOMENT_MAX_BYTES;
  if (!stored || stored.size <= 0) {
    await cleanup();
    return { ok: false, reason: "not_found" };
  }
  if (stored.size > maxBytes) {
    await cleanup();
    return { ok: false, reason: "too_large" };
  }
  const mime = baseMime(stored.mime) ?? baseMime(`video/${path.endsWith(".webm") ? "webm" : path.endsWith(".mov") ? "quicktime" : "mp4"}`);
  if (!mime || !(await headerMatches(path, "video"))) {
    await cleanup();
    return { ok: false, reason: "invalid" };
  }
  let poster = posterPath;
  if (poster) {
    const p = await storedObject(poster);
    if (!p || p.size <= 0 || p.size > POSTER_MAX_BYTES || !(await headerMatches(poster, "jpeg"))) {
      await removeMediaFiles(me.id, [poster]);
      poster = null;
    }
  }

  const { data, error } = await getTelegramServiceClient().rpc("voyage_media_attach", {
    p_profile: me.id,
    p_kind: kind,
    p_source: source,
    p_topic: kind === "moment" ? topic : null,
    p_storage_path: path,
    p_poster_path: poster,
    p_mime: mime,
    p_size_bytes: stored.size,
    p_duration_ms: duration,
    p_width: dim(input.width),
    p_height: dim(input.height),
  });
  if (error) {
    await removeMediaFiles(me.id, [path, poster]);
    return { ok: false, reason: mediaFailureOf(error) };
  }
  // Старая Визитка заменена — её файлы больше не нужны.
  await removeMediaFiles(me.id, (data as { removed_paths?: unknown } | null)?.removed_paths);
  revalidate();
  return getMyVideoIdentity();
}

/** Отмена загрузки до attachMedia: убрать файлы по своему слоту. */
export async function discardMediaUpload(paths: string[]): Promise<SimpleResult> {
  const me = await sessionResident();
  if (!me.ok) return me;
  const list = (Array.isArray(paths) ? paths : []).filter((p) => isMediaPathOf(me.id, p));
  if (!list.length) return { ok: true };
  // Удаляем только файлы, у которых ещё нет строки в resident_media.
  const { data } = await getTelegramServiceClient()
    .from("resident_media")
    .select("storage_path,poster_path")
    .eq("profile_id", me.id);
  const attached = new Set<string>();
  for (const r of data ?? []) {
    if (r.storage_path) attached.add(String(r.storage_path));
    if (r.poster_path) attached.add(String(r.poster_path));
  }
  await removeMediaFiles(me.id, list.filter((p) => !attached.has(p)));
  return { ok: true };
}

export async function removeMyMedia(mediaId: string): Promise<MyMediaResult> {
  if (!UUID_RE.test(String(mediaId))) return { ok: false, reason: "invalid" };
  const me = await sessionResident();
  if (!me.ok) return me;
  const { data, error } = await getTelegramServiceClient().rpc("voyage_media_remove", { p_profile: me.id, p_media: mediaId });
  if (error) return { ok: false, reason: mediaFailureOf(error) };
  await removeMediaFiles(me.id, (data as { removed_paths?: unknown } | null)?.removed_paths);
  revalidate();
  return getMyVideoIdentity();
}

export async function reorderMyMoments(ids: string[]): Promise<SimpleResult> {
  if (!Array.isArray(ids) || ids.length > MOMENT_MAX_COUNT || !ids.every((id) => UUID_RE.test(String(id)))) {
    return { ok: false, reason: "invalid" };
  }
  const me = await sessionResident();
  if (!me.ok) return me;
  const { error } = await getTelegramServiceClient().rpc("voyage_media_reorder", { p_profile: me.id, p_ids: ids });
  if (error) return { ok: false, reason: mediaFailureOf(error) };
  revalidate();
  return { ok: true };
}
