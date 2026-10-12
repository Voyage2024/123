"use server";

import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { notifyAdminsOfNewRegistration } from "@/lib/server/telegram/admin-notifications";

export async function notifyCurrentReferralRegistration(): Promise<void> {
  try {
    const session = await createClient();
    const { data: auth, error: authError } = await session.auth.getUser();
    if (authError || !auth.user) return;
    let { data: current, error } = await session.from("profiles").select("id,invited_by,status,full_name,created_at").eq("id", auth.user.id).maybeSingle();
    if (!current && !error) {
      const fallback = await session.from("profiles").select("id,invited_by,status,full_name,created_at").eq("user_id", auth.user.id).maybeSingle();
      current = fallback.data;
      error = fallback.error;
    }
    if (error || !current || !current.invited_by || current.status !== "pending") return;
    const age = Date.now() - Date.parse(current.created_at ?? "");
    if (!Number.isFinite(age) || age > 48 * 60 * 60 * 1000) return;
    const db = getTelegramServiceClient();
    const { data: sponsor } = await db.from("profiles").select("full_name").eq("id", current.invited_by).maybeSingle();
    await notifyAdminsOfNewRegistration({
      eventKey: `referral_registration:${current.id}`,
      source: "referral",
      profileId: current.id,
      fullName: current.full_name || auth.user.user_metadata?.full_name || auth.user.email || "New member",
      email: auth.user.email,
      referrerName: sponsor?.full_name ?? null,
    });
  } catch (error) {
    console.error("[referral-registration] admin notification failed", error instanceof Error ? error.name : "unknown");
  }
}
