"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · «Моя видимость» и приглашения из каталога — действия резидентки
 * app/actions/catalog-visibility.ts (этап 2)
 *
 * Все вызовы — RPC от имени самой резидентки (миграция 20261201090000).
 * Сервисный ключ — только для подписи её собственных фото в превью
 * «Так вас видит менеджер».
 * ──────────────────────────────────────────────────────────────────── */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signCard } from "@/lib/server/resident-catalog";
import {
  catalogFailureOf,
  parseCard,
  parseResidentInvites,
  parseState,
  type CatalogCard,
  type CatalogFailure,
  type CatalogState,
  type ResidentInvite,
} from "@/lib/resident-catalog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Fail = { ok: false; reason: CatalogFailure };
const fail = (reason: CatalogFailure): Fail => ({ ok: false, reason });
export type CatalogStateResult = { ok: true; state: CatalogState } | Fail;

function stateOf(data: unknown): CatalogStateResult {
  const state = parseState(data);
  return state ? { ok: true, state } : fail("failed");
}

export async function getMyCatalogState(): Promise<CatalogStateResult> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_my_catalog_state");
  return error ? fail(catalogFailureOf(error)) : stateOf(data);
}

export type VisibilityPatch = {
  visible?: boolean;
  body?: boolean;
  pauseDays?: 0 | 7 | 14 | 30;
  dismissPrompt?: boolean;
  previewSeen?: boolean;
};

export async function setMyCatalogVisibility(patch: VisibilityPatch): Promise<CatalogStateResult> {
  const p = patch ?? {};
  const bool = (v: unknown) => (typeof v === "boolean" ? v : null);
  const pause = p.pauseDays === undefined ? null : [0, 7, 14, 30].includes(Number(p.pauseDays)) ? Number(p.pauseDays) : NaN;
  if (Number.isNaN(pause)) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_set_catalog_visibility", {
    p_visible: bool(p.visible),
    p_body: bool(p.body),
    p_pause_days: pause,
    p_dismiss_prompt: p.dismissPrompt === true ? true : null,
    p_preview_seen: p.previewSeen === true ? true : null,
  });
  if (error) return fail(catalogFailureOf(error));
  revalidatePath("/dashboard");
  return stateOf(data);
}

export async function setManagerHidden(managerId: string, mode: "hidden" | "no_invites" | null): Promise<CatalogStateResult> {
  if (!UUID_RE.test(String(managerId)) || (mode !== null && mode !== "hidden" && mode !== "no_invites")) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_set_manager_hidden", { p_manager: managerId, p_mode: mode });
  return error ? fail(catalogFailureOf(error)) : stateOf(data);
}

/** «Так вас видит менеджер»: та же карточка, что в каталоге, с её фото */
export async function getMyCatalogPreview(): Promise<{ ok: true; card: CatalogCard } | Fail> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_catalog_preview");
  if (error) return fail(catalogFailureOf(error));
  const card = parseCard((data as Record<string, unknown>)?.card);
  if (!card) return fail("failed");
  return { ok: true, card: await signCard(card) };
}

export async function getMyCatalogInvites(): Promise<{ ok: true; invites: ResidentInvite[] } | Fail> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_my_catalog_invites");
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, invites: parseResidentInvites(data) };
}

export async function respondCatalogInvite(
  inviteId: string,
  answer: "interested" | "not_now" | "blocked",
): Promise<{ ok: true; castingId: string; canRespond: boolean } | Fail> {
  if (!UUID_RE.test(String(inviteId)) || !["interested", "not_now", "blocked"].includes(answer)) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_catalog_invite_respond", { p_invite: inviteId, p_answer: answer });
  if (error) return fail(catalogFailureOf(error));
  const d = (data ?? {}) as Record<string, unknown>;
  return { ok: true, castingId: String(d.casting_id ?? ""), canRespond: d.can_respond === true };
}
