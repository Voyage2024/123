"use server";

import { revalidatePath } from "next/cache";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import {
  loadActiveIdentityRequests,
  loadIdentityChangesSince,
  loadIdentityRequest,
  loadRequestProposal,
  manualChangeFor,
} from "@/lib/server/identity-requests";
import { staffUpdateResidentIdentity, type StaffIdentityResult } from "@/app/actions/admin-resident-identity";
import { replyToConciergeRequest } from "@/app/actions/concierge";
import {
  approvedNotice,
  asLang4,
  auditReasonForRequest,
  completedNotice,
  planIdentityApproval,
  rejectedNotice,
} from "@/lib/resident-identity-requests";
import type { IdentityField } from "@/lib/resident-profile-fields";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Owner/Admin обрабатывают запрос резидентки на изменение
 * гражданства / даты рождения прямо из карточки /admin/database/[id].
 *
 * Новых таблиц и RPC нет. Используются существующие механизмы:
 *  - изменение профиля и аудит — staffUpdateResidentIdentity →
 *    public.voyage_staff_set_resident_identity (роль owner/admin, причина,
 *    UPDATE + запись audit_logs в одной транзакции; оба поля одним UPDATE,
 *    частичного изменения не бывает);
 *  - закрытие запроса и уведомление резидентке — replyToConciergeRequest
 *    (public.voyage_concierge_reply + Telegram резидентке).
 *
 * Порядок при одобрении: проверки → изменение профиля → закрытие запроса.
 * Если изменение или аудит не прошли, запрос остаётся открытым.
 * Закрытие — условное (status in open/in_progress): из двух одновременных
 * нажатий запрос закроет только одно, повторно применить его нельзя.
 *
 * Ручное сохранение (Edit identity в карточке, гражданство в справочнике
 * /admin) идёт через saveResidentIdentityAndCloseRequests: после успешного
 * изменения активный запрос, чьи значения теперь совпадают с запрошенными,
 * закрывается как done тем же условным закрытием + уведомление. Профиль
 * второй раз не пишется, журнал не растёт (запись уже сделала правка).
 *
 * completeAppliedIdentityRequest — «Завершить: данные уже исправлены»:
 * закрыть запрос без изменения профиля, если после подачи запроса в журнале
 * есть ручное изменение тех же полей.
 * ──────────────────────────────────────────────────────────────────── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE = ["open", "in_progress"];

export type IdentityRequestError =
  | "invalid"
  | "reason_required"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "already_processed"
  | "unparseable"
  | "stale"
  | "not_applied"
  | "close_failed"
  | "server_error";

export type IdentityRequestDecision =
  | { ok: true; status: "done" | "impossible"; auditId: number | null; alreadyApplied?: boolean; completedManually?: boolean; fields?: IdentityField[]; notified: boolean; warning?: string }
  | { ok: false; reason: IdentityRequestError; applied?: boolean; auditId?: number | null; fields?: IdentityField[] };

const cleanReason = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max + 1) : "";

async function authorize(): Promise<{ ok: true; userId: string } | { ok: false; reason: IdentityRequestError }> {
  try {
    const { userId } = await requireRole(["owner", "admin"]);
    return { ok: true, userId };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: /sign in/i.test(error.message) ? "unauthenticated" : "forbidden" };
    throw error;
  }
}

/** Условное закрытие: только если запрос всё ещё открыт. null — его уже закрыли. */
async function closeIfActive(requestId: string, status: "done" | "impossible", userId: string, feedback: string) {
  const db = getTelegramServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await db.from("partner_concierge_requests")
    .update({ status, resolved_by: userId, resolved_at: now, admin_feedback: feedback, updated_at: now })
    .eq("id", requestId)
    .in("status", ACTIVE)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`close request: ${error.code ?? "unknown"}`);
  return data ? String(data.id) : null;
}

/** Сообщение в переписке заявки + Telegram резидентке (существующий механизм консьержа). */
async function notifyResident(requestId: string, body: string, status: "done" | "impossible") {
  try {
    const sent = await replyToConciergeRequest({ id: requestId, message: body, status });
    if (!sent.ok) return { notified: false, warning: "Запрос закрыт, но сообщение резидентке не сохранилось. Напишите ей в «Консьерже»." };
    const s = sent as { telegramSent?: boolean; warning?: string };
    return { notified: true, warning: s.telegramSent ? undefined : "Сообщение сохранено в «Консьерже», но в Telegram резидентке не ушло (нет привязки или ошибка бота)." };
  } catch {
    return { notified: false, warning: "Запрос закрыт, но сообщение резидентке не отправлено. Напишите ей в «Консьерже»." };
  }
}

function revalidate(profileId: string) {
  revalidatePath(`/admin/database/${profileId}`);
  revalidatePath("/admin/concierge");
  revalidatePath("/dashboard/concierge");
  revalidatePath("/dashboard");
}

/** Approve & Apply */
export async function approveResidentIdentityRequest(input: { requestId: string; reason: string }): Promise<IdentityRequestDecision> {
  if (!input || typeof input !== "object" || typeof input.requestId !== "string" || !UUID_RE.test(input.requestId)) {
    return { ok: false, reason: "invalid" };
  }
  const reason = cleanReason(input.reason, 400);
  if (reason.length < 5 || reason.length > 400) return { ok: false, reason: "reason_required" };

  try {
    const auth = await authorize();
    if (!auth.ok) return auth;
    const db = getTelegramServiceClient();

    // Актуальность: запрос существует, это запрос «[Данные KYC]», он открыт.
    const request = await loadIdentityRequest(db, input.requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (!ACTIVE.includes(request.status)) return { ok: false, reason: "already_processed" };

    const { data: resident, error: residentError } = await db.from("profiles")
      .select("id,role,citizenship,birth_date")
      .eq("id", request.resident_id)
      .maybeSingle();
    if (residentError) return { ok: false, reason: "server_error" };
    if (!resident || resident.role !== "resident") return { ok: false, reason: "not_found" };

    const proposal = await loadRequestProposal(db, request);
    if (!proposal) return { ok: false, reason: "unparseable" };
    const fields = (["citizenship", "birth_date"] as const).filter((f) => proposal[f]);

    // Актуальность: текущие данные профиля = «было» (или уже = «стало»).
    const plan = planIdentityApproval(proposal, { citizenship: resident.citizenship ?? null, birth_date: resident.birth_date ?? null });
    if (plan.kind === "stale") return { ok: false, reason: "stale", fields: plan.fields };

    let auditId: number | null = null;
    let alreadyApplied = plan.kind === "already_applied";
    if (plan.kind === "apply") {
      const applied = await staffUpdateResidentIdentity({
        profileId: resident.id,
        ...plan.patch,
        reason: auditReasonForRequest(request.id, reason),
      });
      if (!applied.ok) {
        // Одновременное второе нажатие: первое уже применило — повторной записи в журнал нет.
        if (applied.reason === "nothing_to_change") alreadyApplied = true;
        else if (applied.reason === "reason_required") return { ok: false, reason: "reason_required" };
        else if (applied.reason === "forbidden" || applied.reason === "unauthenticated" || applied.reason === "not_found" || applied.reason === "invalid") return { ok: false, reason: applied.reason };
        else return { ok: false, reason: "server_error" }; // профиль и журнал не изменились — запрос остаётся открытым
      } else {
        auditId = applied.auditId;
      }
    }

    const notice = approvedNotice(asLang4(request.preferred_language), fields);
    let closed: string | null;
    try {
      closed = await closeIfActive(request.id, "done", auth.userId, notice);
    } catch {
      revalidate(resident.id);
      return { ok: false, reason: "close_failed", applied: auditId !== null, auditId, fields };
    }
    if (!closed) {
      revalidate(resident.id);
      return { ok: false, reason: "already_processed", applied: auditId !== null, auditId, fields };
    }

    const n = await notifyResident(request.id, notice, "done");
    revalidate(resident.id);
    return { ok: true, status: "done", auditId, alreadyApplied: alreadyApplied || undefined, fields, notified: n.notified, ...(n.warning ? { warning: n.warning } : {}) };
  } catch (error) {
    console.error("[admin-identity-requests] approve failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, reason: "server_error" };
  }
}

/** Reject: профиль не меняется, запрос закрывается (impossible), резидентка получает причину. */
export async function rejectResidentIdentityRequest(input: { requestId: string; reason: string }): Promise<IdentityRequestDecision> {
  if (!input || typeof input !== "object" || typeof input.requestId !== "string" || !UUID_RE.test(input.requestId)) {
    return { ok: false, reason: "invalid" };
  }
  const reason = typeof input.reason === "string"
    ? input.reason.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim()
    : "";
  if (reason.length < 5 || reason.length > 1000) return { ok: false, reason: "reason_required" };

  try {
    const auth = await authorize();
    if (!auth.ok) return auth;
    const db = getTelegramServiceClient();

    const request = await loadIdentityRequest(db, input.requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (!ACTIVE.includes(request.status)) return { ok: false, reason: "already_processed" };
    const { data: resident, error: residentError } = await db.from("profiles").select("id,role").eq("id", request.resident_id).maybeSingle();
    if (residentError) return { ok: false, reason: "server_error" };
    if (!resident || resident.role !== "resident") return { ok: false, reason: "not_found" };

    const notice = rejectedNotice(asLang4(request.preferred_language), reason);
    const closed = await closeIfActive(request.id, "impossible", auth.userId, notice);
    if (!closed) return { ok: false, reason: "already_processed" };

    const n = await notifyResident(request.id, notice, "impossible");
    revalidate(resident.id);
    return { ok: true, status: "impossible", auditId: null, notified: n.notified, ...(n.warning ? { warning: n.warning } : {}) };
  } catch (error) {
    console.error("[admin-identity-requests] reject failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, reason: "server_error" };
  }
}

/* ── Ручное сохранение + закрытие связанного запроса ─────────────────── */

export type ClosedIdentityRequest = { requestId: string; fields: IdentityField[]; notified: boolean; warning?: string };

export type IdentitySaveResult =
  | (Extract<StaffIdentityResult, { ok: true }> & {
      /** Запросы, закрытые как done: значения в профиле теперь как в запросе. */
      closedRequests: ClosedIdentityRequest[];
      /** Активные запросы, которые остались открытыми (значения не совпадают с запрошенными). */
      openRequests: number;
      syncWarning?: string;
    })
  | Extract<StaffIdentityResult, { ok: false }>;

/**
 * Закрыть активные запросы резидентки, которые текущие данные профиля уже
 * выполняют (plan = already_applied). Профиль и журнал не трогаются.
 */
async function closeSatisfiedRequests(profileId: string, userId: string) {
  const db = getTelegramServiceClient();
  const { data: resident, error } = await db.from("profiles")
    .select("id,role,citizenship,birth_date")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(`resident: ${error.code ?? "unknown"}`);
  if (!resident || resident.role !== "resident") return { closed: [] as ClosedIdentityRequest[], open: 0 };

  const closed: ClosedIdentityRequest[] = [];
  let open = 0;
  for (const request of await loadActiveIdentityRequests(db, profileId)) {
    const proposal = await loadRequestProposal(db, request);
    const plan = proposal ? planIdentityApproval(proposal, { citizenship: resident.citizenship ?? null, birth_date: resident.birth_date ?? null }) : null;
    if (!proposal || plan?.kind !== "already_applied") { open++; continue; }
    const fields = (["citizenship", "birth_date"] as const).filter((f) => proposal[f]);
    const notice = approvedNotice(asLang4(request.preferred_language), fields);
    if (!(await closeIfActive(request.id, "done", userId, notice))) continue; // закрыли параллельно — не дублируем уведомление
    const n = await notifyResident(request.id, notice, "done");
    closed.push({ requestId: request.id, fields, notified: n.notified, ...(n.warning ? { warning: n.warning } : {}) });
  }
  return { closed, open };
}

/** Edit identity / справочник: сохранить (с аудитом) и закрыть выполненный этим запрос. */
export async function saveResidentIdentityAndCloseRequests(input: {
  profileId: string;
  citizenship?: string | null;
  birth_date?: string | null;
  reason: string;
}): Promise<IdentitySaveResult> {
  const saved = await staffUpdateResidentIdentity(input);
  if (!saved.ok) return saved;
  try {
    const auth = await authorize();
    if (!auth.ok) return { ...saved, closedRequests: [], openRequests: 0 };
    const synced = await closeSatisfiedRequests(input.profileId, auth.userId);
    revalidate(input.profileId);
    return { ...saved, closedRequests: synced.closed, openRequests: synced.open };
  } catch (error) {
    console.error("[admin-identity-requests] close after save failed", error instanceof Error ? error.message : "unknown");
    return {
      ...saved,
      closedRequests: [],
      openRequests: 0,
      syncWarning: "Данные сохранены, но связанный запрос закрыть не удалось. Обновите карточку и нажмите «Завершить: данные уже исправлены».",
    };
  }
}

/**
 * «Завершить: данные уже исправлены». Профиль не меняется, журнал не растёт.
 * Разрешено, только если после подачи запроса в audit_logs есть изменение
 * тех же полей (ручная правка owner/admin) или данные уже как в запросе.
 */
export async function completeAppliedIdentityRequest(input: { requestId: string }): Promise<IdentityRequestDecision> {
  if (!input || typeof input !== "object" || typeof input.requestId !== "string" || !UUID_RE.test(input.requestId)) {
    return { ok: false, reason: "invalid" };
  }
  try {
    const auth = await authorize();
    if (!auth.ok) return auth;
    const db = getTelegramServiceClient();

    const request = await loadIdentityRequest(db, input.requestId);
    if (!request) return { ok: false, reason: "not_found" };
    if (!ACTIVE.includes(request.status)) return { ok: false, reason: "already_processed" };
    const { data: resident, error: residentError } = await db.from("profiles")
      .select("id,role,citizenship,birth_date")
      .eq("id", request.resident_id)
      .maybeSingle();
    if (residentError) return { ok: false, reason: "server_error" };
    if (!resident || resident.role !== "resident") return { ok: false, reason: "not_found" };

    const proposal = await loadRequestProposal(db, request);
    const plan = proposal ? planIdentityApproval(proposal, { citizenship: resident.citizenship ?? null, birth_date: resident.birth_date ?? null }) : null;
    const changes = await loadIdentityChangesSince(db, resident.id, request.created_at);
    const manual = manualChangeFor(proposal, request.created_at, changes);
    // Данные с подачи не меняли — это не «уже исправлено»: нужен Approve & Apply или Reject.
    if (plan?.kind === "apply" || (!manual && plan?.kind !== "already_applied")) return { ok: false, reason: "not_applied" };

    const fields = proposal
      ? (["citizenship", "birth_date"] as const).filter((f) => proposal[f])
      : (["citizenship", "birth_date"] as const).filter((f) => manual?.fields.includes(f));
    const lang = asLang4(request.preferred_language);
    const notice = plan?.kind === "already_applied" ? approvedNotice(lang, fields) : completedNotice(lang, fields);
    const closed = await closeIfActive(request.id, "done", auth.userId, notice);
    if (!closed) return { ok: false, reason: "already_processed" };

    const n = await notifyResident(request.id, notice, "done");
    revalidate(resident.id);
    return { ok: true, status: "done", auditId: null, completedManually: true, fields, notified: n.notified, ...(n.warning ? { warning: n.warning } : {}) };
  } catch (error) {
    console.error("[admin-identity-requests] complete failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, reason: "server_error" };
  }
}
