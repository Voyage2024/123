"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Доступ партнёров: инвайты владельца и заявки из Telegram-бота
 *
 *   issuePartnerInvite        owner — код VYP-XXXX-XXXX + deep link в бота
 *   revokePartnerInvite       owner — отзыв неиспользованного кода
 *   approvePartnerApplication owner/admin — аккаунт manager + логин и пароль в Telegram
 *   rejectPartnerApplication  owner/admin — отказ + короткое сообщение заявителю
 *
 * Инвайты идут через RPC под сессией (права проверяет БД), одобрение и отказ —
 * через сервисный клиент после requireRole: создание Auth-пользователя
 * и отправка пароля возможны только на сервере.
 * ──────────────────────────────────────────────────────────────────── */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import {
  provisionPartnerAccount,
  rejectPartnerApplication as rejectApplication,
} from "@/lib/server/telegram/partner-registration";

export type PartnerAccessResult<T = undefined> = ({ ok: true } & (T extends undefined ? unknown : { data: T })) | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

function botUsername(): string | null {
  const name = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  return BOT_USERNAME_RE.test(name) ? name : null;
}

/** https://t.me/<bot>?start=partner_<CODE> — или null, если имя бота не задано. */
function partnerDeepLink(code: string): string | null {
  const bot = botUsername();
  return bot ? `https://t.me/${bot}?start=partner_${code}` : null;
}

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message };
  return { ok: false, error: "Не удалось выполнить действие. Попробуйте ещё раз." };
}

export type IssuedInvite = { id: string; code: string; expiresAt: string; link: string | null };

export async function issuePartnerInvite(note: string, days: number): Promise<PartnerAccessResult<IssuedInvite>> {
  try {
    await requireRole(["owner"]);
    const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.round(days))) : 14;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_issue_partner_invite", {
      p_note: note.trim().slice(0, 200) || null,
      p_days: safeDays,
    });
    const row = (Array.isArray(data) ? data[0] : data) as { id?: string; code?: string; expires_at?: string } | null;
    if (error || !row?.id || !row.code) {
      if (error) console.error("[partner-access] issue failed", error.code ?? "unknown");
      return { ok: false, error: error?.code === "42501" ? "Выпускать партнёрские коды может только владелец." : "Код не выпущен." };
    }
    revalidatePath("/admin/invites");
    return { ok: true, data: { id: row.id, code: row.code, expiresAt: row.expires_at ?? "", link: partnerDeepLink(row.code) } };
  } catch (error) {
    return failure(error);
  }
}

export async function revokePartnerInvite(id: string): Promise<PartnerAccessResult> {
  try {
    await requireRole(["owner"]);
    if (!UUID_RE.test(id)) return { ok: false, error: "Некорректный код." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_revoke_partner_invite", { p_id: id });
    if (error) {
      console.error("[partner-access] revoke failed", error.code ?? "unknown");
      return { ok: false, error: "Код уже использован или отозван." };
    }
    revalidatePath("/admin/invites");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export type ApprovedPartner = { profileId: string; delivered: boolean };

export async function approvePartnerApplication(id: string): Promise<PartnerAccessResult<ApprovedPartner>> {
  try {
    const { userId } = await requireRole(["owner", "admin"]);
    if (!UUID_RE.test(id)) return { ok: false, error: "Некорректная заявка." };
    const result = await provisionPartnerAccount(id, userId);
    if (!result.ok) {
      const messages: Record<typeof result.error, string> = {
        not_pending: "Заявка уже обработана.",
        email_exists: "На этот email уже есть аккаунт — заявка возвращена в очередь.",
        auth_failed: "Не удалось создать аккаунт. Заявка возвращена в очередь.",
        provision_failed: "Не удалось выдать роль партнёра. Заявка возвращена в очередь.",
      };
      return { ok: false, error: messages[result.error] };
    }
    revalidatePath("/admin/invites");
    return { ok: true, data: { profileId: result.profileId, delivered: result.delivered } };
  } catch (error) {
    return failure(error);
  }
}

export async function rejectPartnerApplication(id: string, note: string): Promise<PartnerAccessResult> {
  try {
    const { userId } = await requireRole(["owner", "admin"]);
    if (!UUID_RE.test(id)) return { ok: false, error: "Некорректная заявка." };
    const done = await rejectApplication(id, userId, note);
    if (!done) return { ok: false, error: "Заявка уже обработана." };
    revalidatePath("/admin/invites");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
