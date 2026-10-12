"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Lang } from "@/app/context/LanguageContext";

export type AdminTelegramSettings = { notifications_tg_id: string | null; notify_new_applications: boolean; notification_language: Lang };
export type AdminTelegramSettingsResult = { ok: true; settings: AdminTelegramSettings } | { ok: false; reason: "unauthenticated" | "forbidden" | "not_configured" | "invalid" | "server_error" };

async function getCurrentAdmin() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false as const, reason: "unauthenticated" as const };
  let { data: profile, error } = await supabase.from("profiles").select("id,role").eq("id", auth.user.id).maybeSingle();
  if (!profile && !error) {
    const fallback = await supabase.from("profiles").select("id,role").eq("user_id", auth.user.id).maybeSingle();
    profile = fallback.data; error = fallback.error;
  }
  if (error || !profile) return { ok: false as const, reason: "server_error" as const };
  if (profile.role !== "owner" && profile.role !== "admin") return { ok: false as const, reason: "forbidden" as const };
  return { ok: true as const, supabase, profileId: profile.id };
}

export async function getMyAdminTelegramSettings(): Promise<AdminTelegramSettingsResult> {
  const actor = await getCurrentAdmin();
  if (!actor.ok) return actor;
  const { data, error } = await actor.supabase.from("admin_settings")
    .select("notifications_tg_id,notify_new_applications,notification_language")
    .eq("admin_id", actor.profileId).maybeSingle();
  if (error) {
    console.error("[admin-telegram-settings] read failed", { code: error.code, message: error.message });
    return { ok: false, reason: "server_error" };
  }
  const language = String(data?.notification_language ?? "EN");
  return { ok: true, settings: {
    notifications_tg_id: data?.notifications_tg_id ?? null,
    notify_new_applications: data?.notify_new_applications ?? true,
    notification_language: (["EN", "RU", "ES", "PT"].includes(language) ? language : "EN") as Lang,
  } };
}

export async function saveMyAdminTelegramSettings(input: { telegramId: string; enabled: boolean; language: Lang }): Promise<AdminTelegramSettingsResult> {
  const actor = await getCurrentAdmin();
  if (!actor.ok) return actor;
  if (!input || typeof input !== "object" || typeof input.telegramId !== "string" || typeof input.enabled !== "boolean" || !["EN", "RU", "ES", "PT"].includes(input.language)) {
    return { ok: false, reason: "invalid" };
  }
  const telegramId = input.telegramId.trim() || null;
  if (telegramId && !/^-?[0-9]{5,20}$/.test(telegramId)) return { ok: false, reason: "invalid" };
  const { data, error } = await actor.supabase.from("admin_settings").upsert({
    admin_id: actor.profileId,
    notifications_tg_id: telegramId,
    notify_new_applications: input.enabled,
    notification_language: input.language,
    updated_at: new Date().toISOString(),
  }, { onConflict: "admin_id" }).select("notifications_tg_id,notify_new_applications,notification_language").single();
  if (error || !data) {
    console.error("[admin-telegram-settings] save failed", { code: error?.code, message: error?.message });
    return { ok: false, reason: "server_error" };
  }
  revalidatePath("/admin/settings");
  return { ok: true, settings: { notifications_tg_id: data.notifications_tg_id, notify_new_applications: data.notify_new_applications, notification_language: data.notification_language as Lang } };
}
