"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { errorCode } from "@/lib/tour-ops/types";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Скаутинг — серверные действия
 *
 *   менеджер:  инвайт-ссылки VYM-…, прямые приглашения своих моделей в тур;
 *   скаут:     те же ссылки VYM-…, напоминания моделям, реквизиты выплат
 *              (менеджер-скаут тоже может указать реквизиты и напоминать);
 *   резидент:  ответ на приглашение («Принять участие» / «Отказаться»);
 *   owner:     ручное закрепление, решения по заявкам, выплаты бонусов,
 *              ставка scout_bonus_percent.
 *
 * Здесь — только роль и сессия. Кто что может, решает БД (SECURITY DEFINER
 * RPC из 20261114101000 / 102000). admin не допускается ни к одному действию.
 * ──────────────────────────────────────────────────────────────────── */

export type ScoutResult<T = undefined> = { ok: true; data?: T } | { ok: false; code: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Gate = { userId: string; role: string };

async function gate(roles: readonly ("manager" | "owner" | "resident" | "scout")[]): Promise<Gate | ScoutResult> {
  try {
    return await requireRole(roles);
  } catch (error) {
    return { ok: false, code: error instanceof AuthorizationError ? "forbidden" : "failed" };
  }
}
const denied = (g: unknown): g is ScoutResult => typeof g === "object" && g !== null && "ok" in g;
const clean = (v: unknown, max: number): string | null => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
const ids = (list: unknown, max: number): string[] =>
  Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(0, max) : [];

/** Ссылка в бота для модели: t.me/<бот>?start=mod_VYM-XXXX-XXXX */
function scoutLink(code: string): string | null {
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(bot) ? `https://t.me/${bot}?start=mod_${code}` : null;
}

/** Ссылка в бота для будущего скаута: t.me/<бот>?start=sc_VYS-XXXX-XXXX */
function recruitLink(code: string): string | null {
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(bot) ? `https://t.me/${bot}?start=sc_${code}` : null;
}

function revalidateScouting() {
  revalidatePath("/partner/models");
  revalidatePath("/scout");
}

/* ── менеджер: инвайт-ссылки ───────────────────────────────────────── */

export async function issueScoutInvite(input: { note?: string | null; days?: number; maxUses?: number }): Promise<
  ScoutResult<{ id: string; code: string; link: string | null }>
> {
  const g = await gate(["manager", "scout"]);
  if (denied(g)) return g;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_issue_scout_invite", {
    p_note: clean(input.note, 120),
    p_days: Math.min(180, Math.max(1, Math.round(Number(input.days ?? 60)) || 60)),
    p_max_uses: Math.min(200, Math.max(1, Math.round(Number(input.maxUses ?? 25)) || 25)),
  });
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "failed" };
  const row = data as { id: string; code: string };
  revalidateScouting();
  return { ok: true, data: { id: row.id, code: row.code, link: scoutLink(row.code) } };
}

export async function revokeScoutInvite(id: string): Promise<ScoutResult> {
  const g = await gate(["manager", "scout", "owner"]);
  if (denied(g)) return g;
  if (!UUID.test(id)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_revoke_scout_invite", { p_id: id });
  if (error) return { ok: false, code: errorCode(error.message) };
  revalidateScouting();
  return data ? { ok: true } : { ok: false, code: "invite_closed" };
}

/** Ссылки для уже выданных кодов (бот задаётся env на сервере и в клиенте одинаково). */
export async function scoutInviteLinks(codes: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const c of (Array.isArray(codes) ? codes : []).slice(0, 50)) {
    if (typeof c === "string" && /^VYM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) out[c] = scoutLink(c);
  }
  return out;
}

/* ── скаут и менеджер: напоминание модели, реквизиты ───────────────── */

const NUDGES = ["photo", "kyc", "open_to_tours", "casting"] as const;

export type NudgeResult = { ok: true; notified: boolean } | { ok: false; code: string; nextAt?: string | null };

/** Мягкое напоминание модели в Telegram: только готовый шаблон, раз в 20 часов. */
export async function nudgeModel(input: { modelId: string; kind: string; castingId?: string | null }): Promise<NudgeResult> {
  const g = await gate(["manager", "scout"]);
  if (denied(g)) return { ok: false, code: g.ok ? "failed" : g.code };
  if (!UUID.test(input.modelId) || !(NUDGES as readonly string[]).includes(input.kind)) return { ok: false, code: "failed" };
  if (input.kind === "casting" && !(input.castingId && UUID.test(input.castingId))) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_scout_nudge_model", {
    p_model: input.modelId,
    p_kind: input.kind,
    p_casting: input.kind === "casting" ? input.castingId : null,
  });
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "failed" };
  const r = data as { ok?: boolean; reason?: string; notified?: boolean; next_at?: string };
  if (!r.ok) return { ok: false, code: r.reason ?? "failed", nextAt: r.next_at ?? null };
  revalidateScouting();
  return { ok: true, notified: r.notified === true };
}

/** Реквизиты для выплат скаут-бонусов. Полный номер карты база не примет. */
export async function setMyPayoutDetails(input: { method: string; details: string; holder?: string | null }): Promise<ScoutResult<{ masked: string | null }>> {
  const g = await gate(["manager", "scout"]);
  if (denied(g)) return g;
  const details = clean(input.details, 300);
  if (!details) return { ok: false, code: "payout_details_invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_set_my_payout_details", {
    p_method: String(input.method ?? ""),
    p_details: details,
    p_holder: clean(input.holder, 120),
  });
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "failed" };
  revalidatePath("/scout/profile");
  return { ok: true, data: { masked: (data as { masked?: string | null }).masked ?? null } };
}

/* ── менеджер / owner: ссылки для новых скаутов (VYS-…) ─────────────── */

export async function issueScoutRecruitInvite(input: { note?: string | null; days?: number; maxUses?: number }): Promise<
  ScoutResult<{ id: string; code: string; link: string | null }>
> {
  const g = await gate(["manager", "owner"]);
  if (denied(g)) return g;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_issue_scout_recruit_invite", {
    p_note: clean(input.note, 120),
    p_days: Math.min(90, Math.max(1, Math.round(Number(input.days ?? 30)) || 30)),
    p_max_uses: Math.min(50, Math.max(1, Math.round(Number(input.maxUses ?? 3)) || 3)),
  });
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "failed" };
  const row = data as { id: string; code: string };
  revalidatePath("/partner/models");
  revalidatePath("/admin/tour-control/scouts");
  return { ok: true, data: { id: row.id, code: row.code, link: recruitLink(row.code) } };
}

export async function revokeScoutRecruitInvite(id: string): Promise<ScoutResult> {
  const g = await gate(["manager", "owner"]);
  if (denied(g)) return g;
  if (!UUID.test(id)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_revoke_scout_recruit_invite", { p_id: id });
  if (error) return { ok: false, code: errorCode(error.message) };
  revalidatePath("/partner/models");
  revalidatePath("/admin/tour-control/scouts");
  return data ? { ok: true } : { ok: false, code: "invite_closed" };
}

export async function scoutRecruitLinks(codes: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const c of (Array.isArray(codes) ? codes : []).slice(0, 60)) {
    if (typeof c === "string" && /^VYS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) out[c] = recruitLink(c);
  }
  return out;
}

/* ── менеджер / owner: прямые приглашения в тур ────────────────────── */

export async function inviteModelsToTour(input: { tourId: string; residentIds: string[]; message?: string | null; hours?: number }): Promise<
  ScoutResult<{ invited: number; notified: number; skipped: { id: string; reason: string }[] }>
> {
  const g = await gate(["manager", "owner"]);
  if (denied(g)) return g;
  if (!UUID.test(input.tourId)) return { ok: false, code: "failed" };
  const residents = ids(input.residentIds, 30);
  if (!residents.length) return { ok: false, code: "pick_models" };
  const hours = [24, 48, 72, 168].includes(Number(input.hours)) ? Number(input.hours) : 48;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_invite_models_to_tour", {
    p_tour: input.tourId,
    p_residents: residents,
    p_message: clean(input.message, 500),
    p_hours: hours,
  });
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "failed" };
  const r = data as { invited?: unknown[]; notified?: number; skipped?: { id: string; reason: string }[] };
  revalidatePath("/partner/models");
  revalidatePath("/partner/bookings");
  return {
    ok: true,
    data: { invited: Array.isArray(r.invited) ? r.invited.length : 0, notified: Number(r.notified ?? 0), skipped: Array.isArray(r.skipped) ? r.skipped : [] },
  };
}

export async function revokeTourInvite(id: string): Promise<ScoutResult> {
  const g = await gate(["manager", "owner"]);
  if (denied(g)) return g;
  if (!UUID.test(id)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_revoke_tour_invite", { p_invite: id });
  if (error) return { ok: false, code: errorCode(error.message) };
  return data ? { ok: true } : { ok: false, code: "invite_closed" };
}

/* ── резидент: ответ на приглашение ────────────────────────────────── */

export async function respondTourInvite(id: string, accept: boolean): Promise<ScoutResult<{ tourId: string | null; accepted: boolean }>> {
  const g = await gate(["resident"]);
  if (denied(g)) return g;
  if (!UUID.test(id)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_respond_tour_invite", { p_invite: id, p_accept: accept === true });
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "failed" };
  const r = data as { accepted?: boolean; tour_id?: string | null };
  revalidatePath("/dashboard/castings");
  return { ok: true, data: { tourId: typeof r.tour_id === "string" ? r.tour_id : null, accepted: r.accepted === true || accept === true } };
}

/* ── owner ─────────────────────────────────────────────────────────── */

async function ownerRpc(fn: string, args: Record<string, unknown>): Promise<ScoutResult<unknown>> {
  const g = await gate(["owner"]);
  if (denied(g)) return g;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, code: errorCode(error.message) };
  revalidatePath("/admin/tour-control/scouts");
  return { ok: true, data };
}

export async function ownerSetScout(profileId: string, managerId: string | null, reason: string): Promise<ScoutResult> {
  if (!UUID.test(profileId) || (managerId !== null && !UUID.test(managerId))) return { ok: false, code: "failed" };
  const note = clean(reason, 300);
  if (!note || note.length < 3) return { ok: false, code: "reason_required" };
  const r = await ownerRpc("voyage_owner_set_scout", { p_profile: profileId, p_manager: managerId, p_note: note });
  return r.ok ? { ok: true } : r;
}

export async function ownerDecideScoutClaim(claimId: string, approve: boolean, note?: string | null): Promise<ScoutResult> {
  if (!UUID.test(claimId)) return { ok: false, code: "failed" };
  const r = await ownerRpc("voyage_owner_decide_scout_claim", { p_claim: claimId, p_approve: approve === true, p_note: clean(note, 300) });
  return r.ok ? { ok: true } : r;
}

/** Выплата пачкой: на каждого скаута × валюту — отдельная выплата со снимком реквизитов. */
export async function ownerMarkScoutPaid(rowIds: string[], payoutRef: string, note?: string | null): Promise<ScoutResult<{ count: number; payouts: number }>> {
  const list = ids(rowIds, 500);
  if (!list.length) return { ok: false, code: "nothing_selected" };
  const ref = clean(payoutRef, 120);
  if (!ref || ref.length < 2) return { ok: false, code: "payout_ref_required" };
  const r = await ownerRpc("voyage_owner_mark_scout_paid", { p_ids: list, p_ref: ref, p_note: clean(note, 300) });
  if (!r.ok) return r;
  const d = (r.data ?? {}) as { count?: number; payouts?: unknown[] };
  return { ok: true, data: { count: Number(d.count ?? 0), payouts: Array.isArray(d.payouts) ? d.payouts.length : 0 } };
}

/* ── owner: скауты — ставка, статус, повышение, заявки ─────────────── */

/** percent = null — вернуть ставку платформы. Действует только на будущие начисления. */
export async function ownerSetScoutRate(scoutId: string, percent: number | null, note?: string | null): Promise<ScoutResult> {
  if (!UUID.test(scoutId)) return { ok: false, code: "failed" };
  const p = percent === null ? null : Number(percent);
  if (p !== null && (!Number.isFinite(p) || p < 0 || p > 50)) return { ok: false, code: "percent_invalid" };
  const r = await ownerRpc("voyage_owner_set_scout_rate", { p_scout: scoutId, p_percent: p === null ? null : Math.round(p * 100) / 100, p_note: clean(note, 300) });
  return r.ok ? { ok: true } : r;
}

export async function ownerSetScoutStatus(scoutId: string, status: "active" | "suspended", note: string): Promise<ScoutResult> {
  if (!UUID.test(scoutId) || (status !== "active" && status !== "suspended")) return { ok: false, code: "failed" };
  const reason = clean(note, 300);
  if (!reason || reason.length < 3) return { ok: false, code: "reason_required" };
  const r = await ownerRpc("voyage_owner_set_scout_status", { p_scout: scoutId, p_status: status, p_note: reason });
  return r.ok ? { ok: true } : r;
}

/** Скаут → менеджер: тот же профиль, модели, ссылки и история бонусов остаются. */
export async function ownerPromoteScout(scoutId: string, note: string): Promise<ScoutResult> {
  if (!UUID.test(scoutId)) return { ok: false, code: "failed" };
  const reason = clean(note, 300);
  if (!reason || reason.length < 3) return { ok: false, code: "reason_required" };
  const r = await ownerRpc("voyage_owner_promote_scout", { p_scout: scoutId, p_note: reason });
  return r.ok ? { ok: true } : r;
}

/** Решение по заявке скаута из кабинета owner (то же, что кнопки в Telegram). */
export async function ownerDecideScoutApplication(applicationId: string, approve: boolean, note?: string | null): Promise<
  ScoutResult<{ login?: string; delivered?: boolean }>
> {
  const g = await gate(["owner"]);
  if (denied(g)) return g;
  if (!UUID.test(applicationId)) return { ok: false, code: "failed" };
  const { provisionScoutAccount, rejectScoutApplication } = await import("@/lib/server/telegram/scout-registration");
  revalidatePath("/admin/tour-control/scouts");
  if (approve) {
    const r = await provisionScoutAccount(applicationId, g.userId);
    return r.ok ? { ok: true, data: { login: r.login.split("@")[0], delivered: r.delivered } } : { ok: false, code: r.error };
  }
  return (await rejectScoutApplication(applicationId, g.userId, clean(note, 500))) ? { ok: true } : { ok: false, code: "not_pending" };
}

export async function ownerVoidScoutBonus(rowId: string, reason: string): Promise<ScoutResult> {
  if (!UUID.test(rowId)) return { ok: false, code: "failed" };
  const note = clean(reason, 200);
  if (!note || note.length < 3) return { ok: false, code: "reason_required" };
  const r = await ownerRpc("voyage_owner_void_scout_bonus", { p_id: rowId, p_reason: note });
  if (!r.ok) return r;
  return r.data ? { ok: true } : { ok: false, code: "not_pending" };
}

export async function ownerSetFinanceSettings(input: { percent: number; base: "total" | "agency"; windowMonths: number; graceDays: number }): Promise<ScoutResult> {
  const percent = Number(input.percent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) return { ok: false, code: "failed" };
  const r = await ownerRpc("voyage_set_finance_settings", {
    p_percent: Math.round(percent * 100) / 100,
    p_base: input.base === "agency" ? "agency" : "total",
    p_window_months: Math.min(120, Math.max(0, Math.round(Number(input.windowMonths) || 0))),
    p_grace_days: Math.min(365, Math.max(0, Math.round(Number(input.graceDays) || 0))),
  });
  return r.ok ? { ok: true } : r;
}
