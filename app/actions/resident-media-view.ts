"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Video Identity — просмотр видео резидентки менеджером и
 * администрацией, модерация.
 * app/actions/resident-media-view.ts
 *
 *   getResidentMediaForViewer  видео для менеджера кастинга/тура или
 *                              owner/admin; право решает RPC
 *                              voyage_resident_media_for_viewer (сессия
 *                              пользователя), она же пишет журнал
 *                              «Кто смотрел» и audit_logs
 *   recordResidentProfileView  отметка «менеджер открыл анкету»
 *   staffSetMediaHidden        owner/admin скрывает или возвращает видео
 *
 * Сервисный ключ нужен только для подписи ссылок (10 минут) на пути,
 * которые RPC уже вернула этому пользователю, и для модерации после
 * проверки роли owner/admin.
 * ──────────────────────────────────────────────────────────────────── */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import type { MediaBundle, MediaContext } from "@/lib/resident-media";
import { UUID_RE, bundleFromRpc, mediaFailureOf, type MediaFailure } from "@/lib/server/resident-media";

type Fail = { ok: false; reason: MediaFailure };
export type ViewerMediaResult = { ok: true; bundle: MediaBundle } | Fail;

function validContext(context: unknown, contextId: unknown): context is MediaContext {
  if (context !== "casting" && context !== "tour" && context !== "admin") return false;
  if (context === "casting") return typeof contextId === "string" && UUID_RE.test(contextId);
  return contextId === null || (typeof contextId === "string" && UUID_RE.test(contextId));
}

export async function getResidentMediaForViewer(
  residentId: string,
  context: MediaContext,
  contextId: string | null,
): Promise<ViewerMediaResult> {
  if (!UUID_RE.test(String(residentId)) || !validContext(context, contextId)) return { ok: false, reason: "invalid" };
  const session = await createClient();
  const { data, error } = await session.rpc("voyage_resident_media_for_viewer", {
    p_resident: residentId,
    p_context: context,
    p_context_id: contextId,
  });
  if (error) return { ok: false, reason: mediaFailureOf(error) };
  const bundle = await bundleFromRpc(residentId, data);
  return bundle ? { ok: true, bundle } : { ok: false, reason: "failed" };
}

export async function recordResidentProfileView(
  residentId: string,
  context: "casting" | "tour",
  contextId: string | null,
): Promise<{ ok: boolean }> {
  if (!UUID_RE.test(String(residentId)) || !validContext(context, contextId)) return { ok: false };
  const session = await createClient();
  const { data, error } = await session.rpc("voyage_record_profile_view", {
    p_resident: residentId,
    p_context: context,
    p_context_id: contextId,
  });
  if (error) {
    // Журнал — вспомогательный: ошибка не мешает открыть анкету.
    mediaFailureOf(error);
    return { ok: false };
  }
  return { ok: data === true };
}

export async function staffSetMediaHidden(
  residentId: string,
  mediaId: string,
  hide: boolean,
  reason: string | null,
): Promise<ViewerMediaResult> {
  if (!UUID_RE.test(String(residentId)) || !UUID_RE.test(String(mediaId)) || typeof hide !== "boolean") {
    return { ok: false, reason: "invalid" };
  }
  const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
  if (hide && cleanReason.length < 3) return { ok: false, reason: "invalid" };

  const session = await createClient();
  const { data: auth, error: authError } = await session.auth.getUser();
  if (authError || !auth.user) return { ok: false, reason: "unauthenticated" };

  const db = getTelegramServiceClient();
  const cols = "id,role,banned_until,ban_permanent";
  let actor = (await db.from("profiles").select(cols).eq("id", auth.user.id).maybeSingle()).data;
  if (!actor) actor = (await db.from("profiles").select(cols).eq("user_id", auth.user.id).maybeSingle()).data;
  if (!actor || !["owner", "admin"].includes(String(actor.role))) return { ok: false, reason: "forbidden" };

  // Видео должно принадлежать этой резидентке (защита от подмены id в форме).
  const { data: row } = await db.from("resident_media").select("profile_id").eq("id", mediaId).maybeSingle();
  if (!row || String(row.profile_id) !== residentId) return { ok: false, reason: "not_found" };

  const { error } = await db.rpc("voyage_staff_hide_media", {
    p_actor: actor.id,
    p_media: mediaId,
    p_hide: hide,
    p_reason: hide ? cleanReason : null,
  });
  if (error) return { ok: false, reason: mediaFailureOf(error) };
  revalidatePath(`/admin/database/${residentId}`);
  return getResidentMediaForViewer(residentId, "admin", null);
}
