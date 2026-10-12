"use server";

import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { sendApprovedCredentialsTelegram } from "@/lib/server/telegram/credentials";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Server-side Supabase configuration is missing.");
  return createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function generatePassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
  return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join("");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type ApproveProfileResult =
  | { success: true; email: string; userId: string; notificationSent: boolean; warning?: string; manualCredentials?: { login: string; password: string } }
  | { success: false; error: string };

/** Approves KYC, provisions game metrics through a DB trigger, and sends a fresh password via Telegram. */
export async function approveProfile(profileId: string): Promise<ApproveProfileResult> {
  try {
    await requireRole(["owner", "admin"]);
    if (!isUuid(profileId)) return { success: false, error: "Invalid profile ID." };

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,email,full_name,status,user_id,kyc_level,telegram_id,credential_issue_id,banned_until,ban_permanent,source_metadata")
      .eq("id", profileId)
      .maybeSingle();

    if (profileError || !profile) return { success: false, error: "Application not found." };
    const activeBanUntil = typeof profile.banned_until === "string" ? Date.parse(profile.banned_until) : NaN;
    if (profile.ban_permanent === true || profile.banned_until === "infinity" || (Number.isFinite(activeBanUntil) && activeBanUntil > Date.now())) {
      return { success: false, error: "A banned profile cannot be approved or sent access credentials." };
    }
    if (profile.user_id && profile.user_id !== profile.id) {
      return { success: false, error: "The profile is linked to a different Auth ID. Approval stopped to avoid duplicate accounts." };
    }
    if (profile.status === "approved") {
      return { success: false, error: "This application has already been approved. Use credential delivery retry from the dossier." };
    }

    const { data: authResult, error: authLookupError } = await admin.auth.admin.getUserById(profile.id);
    if (authLookupError || !authResult.user) {
      return { success: false, error: "No matching Supabase Auth user was found. The profile/Auth UUID link must be repaired first." };
    }

    const email = profile.email ?? authResult.user.email ?? null;
    if (!email) return { success: false, error: "The profile has no email login." };

    const previous = {
      status: profile.status,
      kyc_level: profile.kyc_level,
      user_id: profile.user_id,
      credential_issue_id: profile.credential_issue_id,
    };
    const password = generatePassword();
    const deliveryId = randomUUID();

    // Update profile first so the KYC trigger and game metric provisioning run transactionally in Postgres.
    const { data: updatedProfile, error: updateProfileError } = await admin
      .from("profiles")
      .update({
        status: "approved",
        // The existing voyage_claim_telegram_delivery RPC requires kyc_level >= 1.
        // Setting 0 here silently prevents credential delivery after approval.
        kyc_level: 1,
        user_id: profile.id,
        email,
        telegram_id: profile.telegram_id == null ? null : String(profile.telegram_id),
        temp_password: null,
        credential_issue_id: deliveryId,
      })
      .eq("id", profile.id)
      .select("id")
      .maybeSingle();

    if (updateProfileError || !updatedProfile) {
      return { success: false, error: `Could not approve the profile: ${updateProfileError?.message ?? "profile was not updated"}` };
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(authResult.user.user_metadata ?? {}),
        full_name: profile.full_name ?? authResult.user.user_metadata?.full_name ?? null,
        name: profile.full_name ?? authResult.user.user_metadata?.name ?? null,
      },
    });

    if (passwordError) {
      await admin.from("profiles").update(previous).eq("id", profile.id);
      return { success: false, error: `The temporary password could not be set. The profile status was rolled back: ${passwordError.message}` };
    }

    const delivery = await sendApprovedCredentialsTelegram({
      deliveryId,
      profileId: profile.id,
      telegramId: profile.telegram_id == null ? null : String(profile.telegram_id),
      login: email,
      password,
      fullName: profile.full_name,
    });

    const sourceMetadata = profile.source_metadata && typeof profile.source_metadata === "object"
      ? profile.source_metadata as Record<string, unknown>
      : {};
    const linkedApplicationIds = Array.from(new Set([
      ...(typeof sourceMetadata.guest_application_id === "string" ? [sourceMetadata.guest_application_id] : []),
      ...(Array.isArray(sourceMetadata.guest_application_ids)
        ? sourceMetadata.guest_application_ids.filter((value): value is string => typeof value === "string")
        : []),
    ])).filter(isUuid);
    let linkedApplicationWarning: string | null = null;
    for (const guestApplicationId of linkedApplicationIds) {
      const { error: linkedApplicationError } = await admin.from("guest_applications")
        .update({ status: "approved" })
        .eq("id", guestApplicationId)
        .eq("telegram_id", String(profile.telegram_id ?? ""));
      if (linkedApplicationError) {
        console.error("[approveProfile] linked guest application status update failed", linkedApplicationError.code ?? "unknown");
        linkedApplicationWarning = " One or more linked website application statuses could not be synchronized; check Admin Requests.";
      }
    }

    revalidatePath("/admin/face-control");
    revalidatePath("/admin/requests");
    revalidatePath("/admin/database");
    revalidatePath(`/admin/database/${profile.id}`);

    return {
      success: true,
      email,
      userId: profile.id,
      notificationSent: delivery.sent,
      ...(!delivery.sent ? {
        warning: `Profile approved, but Telegram delivery failed. Use the credentials below to deliver access manually. ${delivery.error}${linkedApplicationWarning ?? ""}`,
        manualCredentials: { login: email, password },
      } : linkedApplicationWarning ? { warning: linkedApplicationWarning.trim() } : {}),
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("[approveProfile] failed:", error instanceof Error ? error.name : "unknown error");
    return { success: false, error: "Could not approve the profile." };
  }
}

/** Rotates the temporary password and sends it again; never returns credentials to the browser. */
export async function resendApprovedCredentials(profileId: string): Promise<ApproveProfileResult> {
  try {
    await requireRole(["owner", "admin"]);
    if (!isUuid(profileId)) return { success: false, error: "Invalid profile ID." };

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,email,full_name,status,kyc_level,telegram_id,banned_until,ban_permanent")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError || !profile) return { success: false, error: "Profile not found." };
    if (profile.status !== "approved") {
      return { success: false, error: "Approve the profile before resending credentials." };
    }
    const activeBanUntil = typeof profile.banned_until === "string" ? Date.parse(profile.banned_until) : NaN;
    if (profile.ban_permanent === true || profile.banned_until === "infinity" || (Number.isFinite(activeBanUntil) && activeBanUntil > Date.now())) {
      return { success: false, error: "Credentials cannot be sent to a banned profile." };
    }
    const telegramId = profile.telegram_id == null ? null : String(profile.telegram_id);
    if (!telegramId) return { success: false, error: "This profile has no linked Telegram account." };

    const { data: authResult, error: authLookupError } = await admin.auth.admin.getUserById(profile.id);
    if (authLookupError || !authResult.user) return { success: false, error: "The related Auth account was not found." };
    const email = profile.email ?? authResult.user.email ?? null;
    if (!email) return { success: false, error: "The profile has no email login." };

    const password = generatePassword();
    const deliveryId = randomUUID();
    const { error: passwordError } = await admin.auth.admin.updateUserById(profile.id, { email, password, email_confirm: true });
    if (passwordError) return { success: false, error: `Could not rotate the temporary password: ${passwordError.message}` };

    const { error: issueIdError } = await admin.from("profiles")
      .update({ credential_issue_id: deliveryId, temp_password: null })
      .eq("id", profile.id);
    if (issueIdError) return { success: false, error: "Password was rotated, but the delivery reference could not be saved. Try again to issue a new password." };

    const delivery = await sendApprovedCredentialsTelegram({
      deliveryId,
      profileId: profile.id,
      telegramId,
      login: email,
      password,
      fullName: profile.full_name,
    });

    revalidatePath(`/admin/database/${profile.id}`);
    return {
      success: true,
      email,
      userId: profile.id,
      notificationSent: delivery.sent,
      ...(!delivery.sent ? {
        warning: `The password was rotated but Telegram delivery failed. Use the credentials below to deliver access manually. ${delivery.error}`,
        manualCredentials: { login: email, password },
      } : {}),
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return { success: false, error: error.message };
    console.error("[resendApprovedCredentials] failed:", error instanceof Error ? error.name : "unknown error");
    return { success: false, error: "Could not resend credentials." };
  }
}
