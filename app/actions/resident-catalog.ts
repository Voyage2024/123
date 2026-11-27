"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог резиденток — действия менеджера (этап 2)
 * app/actions/resident-catalog.ts
 *
 * Все вызовы идут через RPC от имени пользователя (его сессия): доступ,
 * видимость, пауза, «скрыться от менеджера» и лимиты проверяет база на
 * каждое обращение (миграции 20261201090000, 20261203090000). Сервисный ключ — только для
 * подписи ссылок на фото и обложки, которые RPC уже вернула (lib/server/resident-catalog).
 * ──────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import { signCard, signItems } from "@/lib/server/resident-catalog";
import {
  CATALOG_MATERIALS,
  CLOTHING_SIZES,
  INVITE_MESSAGE_MAX,
  catalogFailureOf,
  parseCard,
  parseCastings,
  parseItem,
  parseLimits,
  parseSentInvites,
  parseShortlists,
  parseViewer,
  type CatalogCard,
  type CatalogFailure,
  type CatalogFilters,
  type CatalogItem,
  type CatalogLimits,
  type CatalogViewer,
  type ManagerCasting,
  type SentInvite,
  type Shortlist,
  type ShortlistEntry,
} from "@/lib/resident-catalog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
type Fail = { ok: false; reason: CatalogFailure };
const fail = (reason: CatalogFailure): Fail => ({ ok: false, reason });

export async function getCatalogViewer(): Promise<{ ok: true; viewer: CatalogViewer } | Fail> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_viewer");
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, viewer: parseViewer(data) };
}

/** Фильтры от клиента приводятся к белому списку и границам до отправки в базу */
function cleanFilters(f: CatalogFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const city = typeof f.city === "string" ? f.city.trim().slice(0, 60) : "";
  if (city) out.city = city;
  const hub = typeof f.hub === "string" ? f.hub.trim().slice(0, 64) : "";
  if (hub) out.hub = hub;
  const langs = Array.isArray(f.languages) ? f.languages.filter((l) => /^[A-Za-z]{2}$/.test(l)).slice(0, 5) : [];
  if (langs.length) out.languages = langs.map((l) => l.toUpperCase());
  const h = (v: unknown) => (typeof v === "number" && v >= 120 && v <= 230 ? Math.round(v) : null);
  if (h(f.height_min) !== null) out.height_min = h(f.height_min);
  if (h(f.height_max) !== null) out.height_max = h(f.height_max);
  if (typeof f.kyc_min === "number" && f.kyc_min >= 1 && f.kyc_min <= 3) out.kyc_min = Math.round(f.kyc_min);
  if (typeof f.size === "string" && (CLOTHING_SIZES as readonly string[]).includes(f.size)) out.size = f.size;
  // этап A: «Материалы» и порядок; старый ключ video по-прежнему понимается базой
  if (f.materials && f.materials !== "any" && (CATALOG_MATERIALS as readonly string[]).includes(f.materials)) out.materials = f.materials;
  else if (f.video === "has" || f.video === "fresh") out.video = f.video;
  if (f.sort === "new") out.sort = "new";
  if (typeof f.free_from === "string" && DATE_RE.test(f.free_from)) out.free_from = f.free_from;
  if (typeof f.free_to === "string" && DATE_RE.test(f.free_to)) out.free_to = f.free_to;
  return out;
}

export async function searchCatalog(
  filters: CatalogFilters,
  page: number,
): Promise<{ ok: true; items: CatalogItem[]; total: number; hasMore: boolean; page: number } | Fail> {
  const db = await createClient();
  const p = Number.isInteger(page) ? Math.max(0, Math.min(page, 40)) : 0;
  const { data, error } = await db.rpc("voyage_rcat_search", { p_filters: cleanFilters(filters ?? {}), p_page: p });
  if (error) return fail(catalogFailureOf(error));
  const d = (data ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(d.items) ? d.items : []).map(parseItem).filter((x): x is CatalogItem => !!x);
  return { ok: true, items: await signItems(items), total: Number(d.total) || 0, hasMore: d.has_more === true, page: p };
}

export async function openCatalogCard(
  residentId: string,
): Promise<{ ok: true; card: CatalogCard; limits: CatalogLimits | null } | (Fail & { limits?: CatalogLimits | null })> {
  if (!UUID_RE.test(String(residentId))) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_card", { p_resident: residentId });
  if (error) return fail(catalogFailureOf(error));
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.error === "limit_opens") return { ok: false, reason: "limit_opens", limits: parseLimits(d.limits) };
  const card = parseCard(d.card);
  if (!card) return fail("failed");
  return { ok: true, card: await signCard(card), limits: parseLimits(d.limits) };
}

/* ── подборки ──────────────────────────────────────────────────────── */

export async function listShortlists(): Promise<{ ok: true; lists: Shortlist[] } | Fail> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_shortlists");
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, lists: parseShortlists(data) };
}

export async function saveShortlist(id: string | null, title: string): Promise<{ ok: true; id: string } | Fail> {
  if (id !== null && !UUID_RE.test(String(id))) return fail("invalid");
  const t = typeof title === "string" ? title.trim() : "";
  if (t.length < 1 || t.length > 80) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_shortlist_save", { p_id: id, p_title: t });
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, id: String((data as Record<string, unknown>)?.id ?? "") };
}

export async function deleteShortlist(id: string): Promise<{ ok: boolean; reason?: CatalogFailure }> {
  if (!UUID_RE.test(String(id))) return fail("invalid");
  const db = await createClient();
  const { error } = await db.rpc("voyage_rcat_shortlist_delete", { p_id: id });
  return error ? fail(catalogFailureOf(error)) : { ok: true };
}

export async function toggleShortlist(id: string, residentId: string, add: boolean): Promise<{ ok: boolean; reason?: CatalogFailure }> {
  if (!UUID_RE.test(String(id)) || !UUID_RE.test(String(residentId)) || typeof add !== "boolean") return fail("invalid");
  const db = await createClient();
  const { error } = await db.rpc("voyage_rcat_shortlist_toggle", { p_id: id, p_resident: residentId, p_add: add });
  return error ? fail(catalogFailureOf(error)) : { ok: true };
}

export async function shortlistEntries(id: string): Promise<{ ok: true; entries: ShortlistEntry[] } | Fail> {
  if (!UUID_RE.test(String(id))) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_shortlist_items", { p_id: id });
  if (error) return fail(catalogFailureOf(error));
  const raw = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const available = raw.map((r) => (r.unavailable ? null : parseItem(r))).filter((x): x is CatalogItem => !!x);
  const signed = new Map((await signItems(available)).map((i) => [i.id, i]));
  const entries: ShortlistEntry[] = raw.map((r) => {
    const addedAt = String(r.added_at ?? "");
    const item = typeof r.id === "string" ? signed.get(r.id) : undefined;
    return r.unavailable || !item ? { unavailable: true as const, addedAt } : { ...item, unavailable: false as const, addedAt };
  });
  return { ok: true, entries };
}

export async function pruneShortlist(id: string): Promise<{ ok: true; removed: number } | Fail> {
  if (!UUID_RE.test(String(id))) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_shortlist_prune", { p_id: id });
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, removed: Number(data) || 0 };
}

/* ── приглашения ───────────────────────────────────────────────────── */

export async function myCatalogCastings(): Promise<{ ok: true; castings: ManagerCasting[] } | Fail> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_my_castings");
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, castings: parseCastings(data) };
}

export type InviteOutcome = { residentId: string; ok: boolean; reason?: CatalogFailure };

/** Приглашение одной или нескольким (подборка). Каждое проверяет база отдельно. */
export async function inviteFromCatalog(
  residentIds: string[],
  castingId: string,
  message: string | null,
): Promise<{ ok: true; results: InviteOutcome[]; limits: CatalogLimits | null } | Fail> {
  const ids = Array.from(new Set((Array.isArray(residentIds) ? residentIds : []).filter((x) => UUID_RE.test(String(x))))).slice(0, 100);
  if (!ids.length || !UUID_RE.test(String(castingId))) return fail("invalid");
  const text = typeof message === "string" ? message.trim() : "";
  if (text.length > INVITE_MESSAGE_MAX) return fail("message_contacts");
  const db = await createClient();
  const results: InviteOutcome[] = [];
  let limits: CatalogLimits | null = null;
  for (const id of ids) {
    const { data, error } = await db.rpc("voyage_rcat_invite", { p_resident: id, p_casting: castingId, p_message: text || null });
    if (error) {
      const reason = catalogFailureOf(error);
      results.push({ residentId: id, ok: false, reason });
      if (reason === "message_contacts" || reason === "not_your_casting" || reason === "casting_closed" || reason === "no_access"
          || reason === "catalog_disabled" || reason === "suspended" || reason === "expired") break;
      continue;
    }
    const d = (data ?? {}) as Record<string, unknown>;
    limits = parseLimits(d.limits) ?? limits;
    if (d.error === "limit_invites") {
      results.push({ residentId: id, ok: false, reason: "limit_invites" });
      break;
    }
    results.push({ residentId: id, ok: true });
  }
  return { ok: true, results, limits };
}

export async function withdrawCatalogInvite(inviteId: string): Promise<{ ok: boolean; reason?: CatalogFailure }> {
  if (!UUID_RE.test(String(inviteId))) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_invite_withdraw", { p_invite: inviteId });
  if (error) return fail(catalogFailureOf(error));
  return data === true ? { ok: true } : fail("invite_closed");
}

export async function sentCatalogInvites(): Promise<{ ok: true; invites: SentInvite[] } | Fail> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_rcat_sent_invites", { p_limit: 50 });
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, invites: parseSentInvites(data) };
}
