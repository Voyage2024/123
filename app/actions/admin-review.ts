"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · очередь проверки KYC/консьержа + уведомление о загрузке KYC
 * app/actions/admin-review.ts
 *
 *   getAdminReviewQueue()  — owner/admin: кто ждёт KYC 1/2/3 (бейджи и
 *                            фильтр «Требуют проверки» в /admin)
 *   getAdminReviewCounts() — owner/admin: числа для бокового меню
 *   notifyKycSubmitted()   — резидентка после загрузки паспорта/видео;
 *                            сервер сам находит её свежую заявку в
 *                            kyc_submissions и шлёт сообщение в рабочий чат
 * ──────────────────────────────────────────────────────────────────── */

import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { loadReviewQueue } from "@/lib/server/admin-review-queue";
import { notifyAdminsOfKycSubmission } from "@/lib/server/telegram/admin-notifications";
import type { ReviewCounts, ReviewQueue } from "@/lib/admin-review";

const ADMIN_ROLES = ["admin", "owner"] as const;
/** Заявку старше этого окна считаем не «только что загруженной» — повторно не шлём. */
const FRESH_SUBMISSION_MS = 15 * 60 * 1000;

export async function getAdminReviewQueue(): Promise<{ ok: true; queue: ReviewQueue } | { ok: false; reason: "forbidden" | "server_error" }> {
  try {
    await requireRole(ADMIN_ROLES);
    const queue = await loadReviewQueue(getTelegramServiceClient());
    return { ok: true, queue };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    console.error("[admin-review] queue failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "server_error" };
  }
}

export async function getAdminReviewCounts(): Promise<{ ok: true; counts: ReviewCounts } | { ok: false }> {
  const res = await getAdminReviewQueue();
  if (!res.ok) return { ok: false };
  return { ok: true, counts: { verification: res.queue.verification, conciergeOpen: res.queue.conciergeOpen } };
}

/**
 * Вызывается из KycSection сразу после успешной загрузки файла.
 * Клиенту не доверяем ничего, кроме номера уровня: заявку, имя и контакты
 * сервер берёт из базы. Повторный вызов по той же заявке ничего не шлёт.
 */
export async function notifyKycSubmitted(input: { level: 1 | 2 }): Promise<{ ok: boolean }> {
  try {
    const level = input?.level === 2 ? 2 : input?.level === 1 ? 1 : null;
    if (!level) return { ok: false };

    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false };

    const db = getTelegramServiceClient();
    const { data: profiles, error: profileError } = await db.from("profiles")
      .select("id,user_id,full_name,name,email,telegram_id,telegram_username,location,citizenship,kyc_level,segment,role")
      .or(`id.eq.${auth.user.id},user_id.eq.${auth.user.id}`)
      .limit(2);
    if (profileError) throw profileError;
    const profile = (profiles ?? []).find((p) => p.id === auth.user.id) ?? (profiles ?? [])[0];
    if (!profile) return { ok: false };

    const owners = Array.from(new Set([auth.user.id, profile.id]));
    const { data: submission, error: subError } = await db.from("kyc_submissions")
      .select("id,level,mime_type,size_bytes,created_at,status")
      .in("profile_id", owners)
      .eq("level", level)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError) throw subError;
    if (!submission) return { ok: false };
    if (Date.now() - Date.parse(submission.created_at) > FRESH_SUBMISSION_MS) return { ok: false };

    const kycLevel = Number(profile.kyc_level);
    await notifyAdminsOfKycSubmission({
      submissionId: submission.id,
      level,
      mimeType: submission.mime_type,
      sizeBytes: submission.size_bytes == null ? null : Number(submission.size_bytes),
      person: {
        profileId: profile.id,
        fullName: profile.full_name?.trim() || profile.name?.trim() || null,
        email: profile.email,
        telegramId: profile.telegram_id == null ? null : String(profile.telegram_id),
        telegramUsername: profile.telegram_username,
        location: profile.location,
        citizenship: profile.citizenship,
        kycLevel: Number.isFinite(kycLevel) ? kycLevel : 0,
        segment: profile.segment,
      },
    });
    return { ok: true };
  } catch (error) {
    console.error("[admin-review] kyc notify failed", error instanceof Error ? error.name : "unknown");
    return { ok: false };
  }
}
