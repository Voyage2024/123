"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог резиденток — owner и персонал (этап 2)
 * app/actions/owner-catalog.ts
 *
 * Обзор видят owner и admin; менять выключатель, доступы и лимиты может
 * только owner — это проверяет база (voyage_ops_role() = 'owner'),
 * каждое изменение с причиной пишется в audit_logs.
 * ──────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import { catalogFailureOf, parseLimits, type CatalogFailure, type CatalogLimits } from "@/lib/resident-catalog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Fail = { ok: false; reason: CatalogFailure };
const fail = (reason: CatalogFailure): Fail => ({ ok: false, reason });
type R = Record<string, unknown>;
const rec = (v: unknown): R => (v && typeof v === "object" && !Array.isArray(v) ? (v as R) : {});
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const sn = (v: unknown) => (typeof v === "string" && v ? v : null);
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));

export type OwnerCatalogManager = {
  id: string; name: string; agency: string | null; badge: string | null; status: string; eligible: boolean; code: string;
  access: { status: "active" | "suspended"; openLimit: number | null; inviteLimit: number | null; expiresAt: string | null; reason: string; updatedAt: string } | null;
  today: CatalogLimits | null;
  lastLimitAt: string | null;
};

export type OwnerCatalogOverview = {
  canManage: boolean;
  /** present=false: в базе нет строки общего выключателя (каталог для всех выключен) */
  settings: { present: boolean; enabled: boolean; defaultOpenLimit: number; defaultInviteLimit: number; updatedAt: string };
  residents: { optedIn: number; listed: number; paused: number; videoCatalog: number; missingBasics: number };
  invites7d: number;
  managers: OwnerCatalogManager[];
  limitEvents: { at: string; kind: string; manager: string }[];
  accessEvents: { at: string; action: string; manager: string; status: string | null; reason: string | null; enabled: boolean | null }[];
};

function parseOverview(data: unknown): OwnerCatalogOverview {
  const d = rec(data);
  const st = rec(d.settings);
  const rs = rec(d.residents);
  return {
    canManage: d.can_manage === true,
    settings: { present: st.present === true || (st.present === undefined && typeof st.enabled === "boolean"), enabled: st.enabled === true, defaultOpenLimit: Number(st.default_open_limit) || 200, defaultInviteLimit: Number(st.default_invite_limit) || 30, updatedAt: s(st.updated_at) },
    residents: { optedIn: Number(rs.opted_in) || 0, listed: Number(rs.listed) || 0, paused: Number(rs.paused) || 0, videoCatalog: Number(rs.video_catalog) || 0, missingBasics: Number(rs.missing_basics) || 0 },
    invites7d: Number(d.invites_7d) || 0,
    managers: (Array.isArray(d.managers) ? d.managers : []).map(rec).map((m) => {
      const a = m.access ? rec(m.access) : null;
      return {
        id: s(m.id), name: s(m.name) || "—", agency: sn(m.agency), badge: sn(m.badge), status: s(m.status), eligible: m.eligible === true, code: s(m.code),
        access: a ? { status: a.status === "suspended" ? "suspended" as const : "active" as const, openLimit: n(a.open_limit), inviteLimit: n(a.invite_limit), expiresAt: sn(a.expires_at), reason: s(a.reason), updatedAt: s(a.updated_at) } : null,
        today: parseLimits(m.today),
        lastLimitAt: sn(m.last_limit_at),
      };
    }),
    limitEvents: (Array.isArray(d.limit_events) ? d.limit_events : []).map(rec).map((e) => ({ at: s(e.at), kind: s(e.kind), manager: s(e.manager) || "—" })),
    accessEvents: (Array.isArray(d.access_events) ? d.access_events : []).map(rec).map((e) => {
      const md = rec(e.metadata);
      return { at: s(e.at), action: s(e.action), manager: s(e.manager), status: sn(md.status), reason: sn(md.reason), enabled: typeof md.enabled === "boolean" ? md.enabled : null };
    }),
  };
}

export async function getOwnerCatalogOverview(): Promise<{ ok: true; overview: OwnerCatalogOverview } | Fail> {
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_owner_catalog_overview");
  if (error) return fail(catalogFailureOf(error));
  return { ok: true, overview: parseOverview(data) };
}

const validReason = (r: unknown) => typeof r === "string" && r.trim().length >= 3 && r.trim().length <= 500;
const limit = (v: unknown, max: number) => (v === null || v === undefined || v === "" ? null : Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= max ? Number(v) : NaN);

export async function ownerSetCatalogAccess(input: {
  managerId: string; status: "active" | "suspended" | "none"; openLimit?: number | null; inviteLimit?: number | null; expiresAt?: string | null; reason: string;
}): Promise<{ ok: true; overview: OwnerCatalogOverview } | Fail> {
  const o = limit(input.openLimit, 1000);
  const i = limit(input.inviteLimit, 200);
  const exp = input.expiresAt ? new Date(input.expiresAt) : null;
  if (!UUID_RE.test(String(input.managerId)) || !["active", "suspended", "none"].includes(input.status) || !validReason(input.reason)
      || Number.isNaN(o) || Number.isNaN(i) || (exp && Number.isNaN(exp.getTime()))) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_owner_catalog_set_access", {
    p_manager: input.managerId, p_status: input.status, p_open_limit: o, p_invite_limit: i,
    p_expires_at: exp ? exp.toISOString() : null, p_reason: input.reason.trim(),
  });
  if (error) return fail(catalogFailureOf(error));
  const overview = parseOverview(data);
  // успех — только если база вернула именно то состояние доступа, которое просили
  const row = overview.managers.find((m) => m.id === input.managerId);
  const got = row?.access?.status ?? "none";
  if (row && got !== input.status) return fail("not_saved");
  return { ok: true, overview };
}

export async function ownerSetCatalogSettings(input: {
  enabled?: boolean | null; openLimit?: number | null; inviteLimit?: number | null; reason: string;
}): Promise<{ ok: true; overview: OwnerCatalogOverview } | Fail> {
  const o = limit(input.openLimit, 1000);
  const i = limit(input.inviteLimit, 200);
  if (!validReason(input.reason) || Number.isNaN(o) || Number.isNaN(i)) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_owner_catalog_settings", {
    p_enabled: typeof input.enabled === "boolean" ? input.enabled : null, p_open_limit: o, p_invite_limit: i, p_reason: input.reason.trim(),
  });
  if (error) return fail(catalogFailureOf(error));
  const overview = parseOverview(data);
  // успех — только если база вернула включённое/выключенное состояние, о котором просили
  if (!overview.settings.present
      || (typeof input.enabled === "boolean" && overview.settings.enabled !== input.enabled)
      || (o !== null && overview.settings.defaultOpenLimit !== o)
      || (i !== null && overview.settings.defaultInviteLimit !== i)) return fail("not_saved");
  return { ok: true, overview };
}

export type StaffCatalogStatus = {
  enabled: boolean; catalogVisible: boolean; pausedUntil: string | null; listed: boolean; videoScope: string; views30d: number; invites30d: number;
};

/** Строка каталога в /admin/database/[id] (owner/admin) */
export async function staffCatalogStatus(residentId: string): Promise<{ ok: true; status: StaffCatalogStatus } | Fail> {
  if (!UUID_RE.test(String(residentId))) return fail("invalid");
  const db = await createClient();
  const { data, error } = await db.rpc("voyage_staff_catalog_status", { p_resident: residentId });
  if (error) return fail(catalogFailureOf(error));
  const d = rec(data);
  return {
    ok: true,
    status: {
      enabled: d.enabled === true, catalogVisible: d.catalog_visible === true, pausedUntil: sn(d.paused_until), listed: d.listed === true,
      videoScope: s(d.video_scope) || "engaged", views30d: Number(d.views_30d) || 0, invites30d: Number(d.invites_30d) || 0,
    },
  };
}
