"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { provisionOperatorAccount, rejectOperatorApplication } from "@/lib/server/telegram/operator-registration";
import { purgeExpiredTelegramMessages } from "@/lib/server/telegram/message-purge";
import { errorCode } from "@/lib/tour-ops/types";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — «Моя команда (Операторы)»
 *
 * Менеджер решает только по заявкам, где он указан менеджером; owner —
 * по любым. Проверку «кто решает» делает БД (voyage_operator_app_actor_ok),
 * здесь — роль и сессия. admin сюда не допускается.
 * ──────────────────────────────────────────────────────────────────── */

export type TeamResult<T = undefined> = { ok: true; data?: T } | { ok: false; code: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lead(): Promise<{ userId: string; role: string } | TeamResult> {
  try {
    return await requireRole(["manager", "owner"]);
  } catch (error) {
    return { ok: false, code: error instanceof AuthorizationError ? "forbidden" : "failed" };
  }
}
const denied = (g: unknown): g is TeamResult => typeof g === "object" && g !== null && "ok" in g;

export async function decideOperatorApplication(
  applicationId: string,
  decision: "approve" | "reject",
  note?: string | null,
): Promise<TeamResult<{ login?: string; delivered?: boolean }>> {
  const g = await lead();
  if (denied(g)) return g;
  if (!UUID.test(applicationId)) return { ok: false, code: "failed" };

  if (decision === "reject") {
    const ok = await rejectOperatorApplication(applicationId, g.userId, typeof note === "string" ? note.trim().slice(0, 300) || null : null);
    revalidatePath("/partner/team");
    return ok ? { ok: true } : { ok: false, code: "not_pending" };
  }

  const result = await provisionOperatorAccount(applicationId, g.userId);
  await purgeExpiredTelegramMessages(10);
  revalidatePath("/partner/team");
  if (!result.ok) return { ok: false, code: result.error === "auth_failed" ? "email_exists" : result.error };
  return { ok: true, data: { login: result.login, delivered: result.delivered } };
}

function inviteLink(code: string): string | null {
  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(bot) ? `https://t.me/${bot}?start=op_${code}` : null;
}

export async function issueOperatorInvite(input: { note?: string | null; days?: number; maxUses?: number }): Promise<TeamResult<{ id: string; code: string; link: string | null }>> {
  const g = await lead();
  if (denied(g)) return g;
  const supabase = await createClient();
  const days = Math.min(90, Math.max(1, Math.round(Number(input.days ?? 30)) || 30));
  const maxUses = Math.min(50, Math.max(1, Math.round(Number(input.maxUses ?? 10)) || 10));
  const { data, error } = await supabase.rpc("voyage_issue_operator_invite", {
    p_note: typeof input.note === "string" ? input.note.trim().slice(0, 120) || null : null,
    p_days: days,
    p_max_uses: maxUses,
  });
  if (error || !data) return { ok: false, code: error ? errorCode(error.message) : "failed" };
  const row = data as { id: string; code: string };
  revalidatePath("/partner/team");
  return { ok: true, data: { id: row.id, code: row.code, link: inviteLink(row.code) } };
}

export async function revokeOperatorInvite(id: string): Promise<TeamResult> {
  const g = await lead();
  if (denied(g)) return g;
  if (!UUID.test(id)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_revoke_operator_invite", { p_id: id });
  if (error || data !== true) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  revalidatePath("/partner/team");
  return { ok: true };
}

export async function setOperatorStatus(operatorId: string, status: "active" | "suspended"): Promise<TeamResult> {
  const g = await lead();
  if (denied(g)) return g;
  if (!UUID.test(operatorId) || (status !== "active" && status !== "suspended")) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_set_operator_status", { p_operator: operatorId, p_status: status });
  if (error || data !== true) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  revalidatePath("/partner/team");
  return { ok: true };
}

/** Перепривязать оператора к другому менеджеру — только owner. */
export async function reassignOperator(operatorId: string, managerId: string): Promise<TeamResult> {
  try {
    await requireRole(["owner"]);
  } catch (error) {
    return { ok: false, code: error instanceof AuthorizationError ? "forbidden" : "failed" };
  }
  if (!UUID.test(operatorId) || !UUID.test(managerId)) return { ok: false, code: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_reassign_operator", { p_operator: operatorId, p_manager: managerId });
  if (error || data !== true) return { ok: false, code: error ? errorCode(error.message) : "forbidden" };
  revalidatePath("/admin/tour-control");
  return { ok: true };
}

/** Ссылка-приглашение по коду (для уже созданных инвайтов на странице команды). */
export async function operatorInviteLink(code: string): Promise<string | null> {
  return /^VYO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code) ? inviteLink(code) : null;
}
