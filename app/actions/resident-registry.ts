"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · реестр резиденток и приглашения на кастинг (owner / admin)
 * app/actions/resident-registry.ts
 *
 *   searchResidentRegistry  весь реестр с фильтрами (выездной статус,
 *                           параметры, туры) — RPC voyage_resident_registry
 *   inviteResidents         точечные приглашения + Telegram — voyage_invite_residents
 *   revokeCastingInvite     отозвать неотвеченное приглашение
 *   listCastingInvites      кто приглашён на кастинг и что ответил
 *
 * Доступ проверяется дважды: requireRole(owner/admin) здесь и is_admin()
 * внутри каждой RPC (миграция 20261103090000). Менеджер-партнёр сюда не
 * попадает: у него остаётся слепой список /partner/residents.
 * ──────────────────────────────────────────────────────────────────── */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { CLOTHING_SIZES } from "@/lib/resident-sizes";
import {
  REGISTRY_TRAVEL,
  parseRegistry,
  type CastingInviteRow,
  type InviteSummary,
  type RegistryFilters,
  type RegistryPage,
} from "@/lib/resident-registry";

type Failure = "forbidden" | "invalid" | "closed" | "schema" | "failed";
export type RegistryResult = { ok: true; page: RegistryPage } | { ok: false; reason: Failure };
export type InviteResult = { ok: true; summary: InviteSummary } | { ok: false; reason: Failure | "too_many" };
export type InvitesListResult = { ok: true; invites: CastingInviteRow[] } | { ok: false; reason: Failure };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_MAX = 120;
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
  console.error("[resident-registry]", error.code, error.message);
  const msg = error.message ?? "";
  if (error.code === "42501" || msg.includes("voyage:forbidden")) return "forbidden";
  if (msg.includes("casting_closed")) return "closed";
  if (error.code === "42883" || error.code === "PGRST202" || error.code === "42P01") return "schema";
  if (error.code === "22023" || error.code === "22P02" || error.code === "P0002") return "invalid";
  return "failed";
}

const numOrNull = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Фильтры от клиента → только известные ключи и допустимые значения */
function sanitizeFilters(f: RegistryFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const q = typeof f.q === "string" ? f.q.trim().slice(0, 80) : "";
  if (q) out.q = q;
  if (f.travel && (REGISTRY_TRAVEL as readonly string[]).includes(f.travel)) out.travel = f.travel;
  if (f.segment === "working" || f.segment === "elite") out.segment = f.segment;
  const kyc = numOrNull(f.kycMin, 0, 3);
  if (kyc !== null) out.kyc_min = Math.round(kyc);
  const hmin = numOrNull(f.heightMin, 120, 230);
  const hmax = numOrNull(f.heightMax, 120, 230);
  if (hmin !== null) out.height_min = hmin;
  if (hmax !== null) out.height_max = hmax;
  const sizes = (f.clothingSizes ?? []).filter((s) => (CLOTHING_SIZES as readonly string[]).includes(s));
  if (sizes.length) out.clothing_sizes = sizes;
  const smin = numOrNull(f.shoeMin, 30, 50);
  const smax = numOrNull(f.shoeMax, 30, 50);
  if (smin !== null) out.shoe_min = smin;
  if (smax !== null) out.shoe_max = smax;
  const langs = (f.languages ?? []).map((l) => String(l).toUpperCase()).filter((l) => /^[A-Z]{2}$/.test(l)).slice(0, 8);
  if (langs.length) out.languages = langs;
  if (f.catalogTour && UUID_RE.test(f.catalogTour)) out.catalog_tour = f.catalogTour;
  if (f.notInvited === true) out.not_invited = true;
  return out;
}

/** Фото в приватном бакете user-uploads → подписанная ссылка на час */
async function signPhotos(page: RegistryPage): Promise<RegistryPage> {
  const paths = page.residents.map((r) => r.photo).filter((p): p is string => !!p && !/^https?:\/\//i.test(p));
  if (paths.length === 0) return page;
  try {
    const { data } = await getTelegramServiceClient().storage.from("user-uploads").createSignedUrls(paths, SIGNED_TTL);
    const map = new Map<string, string>();
    for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    return {
      ...page,
      residents: page.residents.map((r) => ({
        ...r,
        photo: r.photo && !/^https?:\/\//i.test(r.photo) ? map.get(r.photo) ?? null : r.photo,
      })),
    };
  } catch (error) {
    console.error("[resident-registry] sign photos", error);
    return { ...page, residents: page.residents.map((r) => ({ ...r, photo: r.photo && /^https?:\/\//i.test(r.photo) ? r.photo : null })) };
  }
}

export async function searchResidentRegistry(input: {
  castingId?: string | null;
  filters?: RegistryFilters;
  limit?: number;
  offset?: number;
}): Promise<RegistryResult> {
  const denied = await guard();
  if (denied) return { ok: false, reason: denied };
  const castingId = input?.castingId ?? null;
  if (castingId && !UUID_RE.test(castingId)) return { ok: false, reason: "invalid" };
  const limit = Math.min(Math.max(Number(input?.limit) || 48, 1), PAGE_MAX);
  const offset = Math.max(Number(input?.offset) || 0, 0);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_resident_registry", {
    p_casting: castingId,
    p_filters: sanitizeFilters(input?.filters ?? {}),
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true, page: await signPhotos(parseRegistry(data)) };
}

export async function inviteResidents(input: {
  castingId: string;
  residentIds: string[];
  message?: string;
}): Promise<InviteResult> {
  const denied = await guard();
  if (denied) return { ok: false, reason: denied };
  if (!input || !UUID_RE.test(input.castingId)) return { ok: false, reason: "invalid" };
  const ids = Array.from(new Set((input.residentIds ?? []).filter((id) => UUID_RE.test(id))));
  if (ids.length === 0) return { ok: false, reason: "invalid" };
  if (ids.length > 50) return { ok: false, reason: "too_many" };
  const message = typeof input.message === "string" ? input.message.trim().slice(0, 500) : "";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_invite_residents", {
    p_casting: input.castingId,
    p_residents: ids,
    p_message: message || null,
  });
  if (error) return { ok: false, reason: failureOf(error) };
  const root = (data ?? {}) as Record<string, unknown>;
  const invited = Array.isArray(root.invited) ? root.invited.filter((x): x is string => typeof x === "string") : [];
  const skipped = Array.isArray(root.skipped)
    ? root.skipped.flatMap((x) => {
        const r = (x ?? {}) as Record<string, unknown>;
        return typeof r.id === "string" && typeof r.reason === "string" ? [{ id: r.id, reason: r.reason }] : [];
      })
    : [];
  revalidatePath(`/partner/castings/${input.castingId}`);
  return { ok: true, summary: { invited, skipped, notified: Number(root.notified) || 0 } };
}

export async function revokeCastingInvite(castingId: string, residentId: string): Promise<{ ok: true } | { ok: false; reason: Failure }> {
  const denied = await guard();
  if (denied) return { ok: false, reason: denied };
  if (!UUID_RE.test(castingId) || !UUID_RE.test(residentId)) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("voyage_revoke_casting_invite", { p_casting: castingId, p_resident: residentId });
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true };
}

export async function listCastingInvites(castingId: string): Promise<InvitesListResult> {
  const denied = await guard();
  if (denied) return { ok: false, reason: denied };
  if (!UUID_RE.test(castingId)) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_casting_invites", { p_casting: castingId });
  if (error) return { ok: false, reason: failureOf(error) };
  const rows = Array.isArray(data) ? data : [];
  const invites: CastingInviteRow[] = rows.flatMap((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    if (typeof r.resident_id !== "string") return [];
    return [{
      residentId: r.resident_id,
      name: typeof r.name === "string" && r.name.trim() ? r.name : null,
      kycLevel: Number(r.kyc_level) || 0,
      status: (["invited", "accepted", "declined", "revoked"] as const).find((s) => s === r.status) ?? "invited",
      notified: r.notified === true,
      message: typeof r.message === "string" ? r.message : null,
      invitedAt: typeof r.invited_at === "string" ? r.invited_at : null,
      respondedAt: typeof r.responded_at === "string" ? r.responded_at : null,
      responseStatus: typeof r.response_status === "string" ? r.response_status : null,
    }];
  });
  return { ok: true, invites };
}
