"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Личные настройки Telegram-оповещений и приватности
 * app/actions/notification-preferences.ts
 *
 * Таблица public.member_preferences (миграция 20261020090000_member_preferences.sql).
 * Нет строки — всё включено. Пишем под сессией пользователя: RLS пускает
 * только к своей строке, сервисный ключ не нужен.
 * ──────────────────────────────────────────────────────────────────── */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PREFERENCES,
  MANAGER_PREFERENCE_KEYS,
  RESIDENT_PREFERENCE_KEYS,
  type MemberPreferences,
  type PreferenceKey,
} from "@/lib/memberPreferences";

export type PreferencesResult =
  | { ok: true; preferences: MemberPreferences; telegramLinked: boolean; role: string }
  | { ok: false; reason: "unauthenticated" | "invalid" | "forbidden" | "server_error" };

const DEFAULTS = DEFAULT_PREFERENCES;
const ALL_KEYS = Object.keys(DEFAULTS) as PreferenceKey[];
const STAFF = new Set(["manager", "admin", "owner"]);

async function getActor() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) return { ok: false as const, reason: "unauthenticated" as const };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,telegram_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError || !profile) return { ok: false as const, reason: "server_error" as const };
  return {
    ok: true as const,
    supabase,
    profileId: String(profile.id),
    role: String(profile.role),
    telegramLinked: typeof profile.telegram_id === "string" && profile.telegram_id.trim() !== "",
  };
}

function normalize(row: Partial<Record<PreferenceKey, unknown>> | null): MemberPreferences {
  const out = { ...DEFAULTS };
  for (const key of ALL_KEYS) if (typeof row?.[key] === "boolean") out[key] = row[key] as boolean;
  return out;
}

export async function getMyNotificationPreferences(): Promise<PreferencesResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const { data, error } = await actor.supabase
    .from("member_preferences")
    .select(ALL_KEYS.join(","))
    .eq("profile_id", actor.profileId)
    .maybeSingle();
  if (error) {
    console.error("[member-preferences] read failed", { code: error.code });
    return { ok: false, reason: "server_error" };
  }
  return {
    ok: true,
    preferences: normalize(data as Partial<Record<PreferenceKey, unknown>> | null),
    telegramLinked: actor.telegramLinked,
    role: actor.role,
  };
}

/** Сохраняет только переданные тумблеры; ключи чужой роли отклоняются */
export async function saveMyNotificationPreferences(patch: Partial<MemberPreferences>): Promise<PreferencesResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  if (!patch || typeof patch !== "object") return { ok: false, reason: "invalid" };

  const allowed = new Set<PreferenceKey>(
    STAFF.has(actor.role) ? MANAGER_PREFERENCE_KEYS : RESIDENT_PREFERENCE_KEYS,
  );
  const update: Partial<MemberPreferences> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key as PreferenceKey) || typeof value !== "boolean") return { ok: false, reason: "invalid" };
    update[key as PreferenceKey] = value;
  }
  if (!Object.keys(update).length) return { ok: false, reason: "invalid" };

  const { data, error } = await actor.supabase
    .from("member_preferences")
    .upsert({ profile_id: actor.profileId, ...update }, { onConflict: "profile_id" })
    .select(ALL_KEYS.join(","))
    .single();
  if (error || !data) {
    console.error("[member-preferences] save failed", { code: error?.code });
    return { ok: false, reason: "server_error" };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard/settings");
  revalidatePath("/admin/settings");
  revalidatePath("/partner/settings");
  if ("hide_points" in update) {
    revalidatePath("/dashboard/leaderboard");
    revalidatePath("/dashboard/tours");
  }
  return {
    ok: true,
    preferences: normalize(data as Partial<Record<PreferenceKey, unknown>>),
    telegramLinked: actor.telegramLinked,
    role: actor.role,
  };
}
