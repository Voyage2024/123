import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Нужен ли этой сессии второй шаг входа.
 *
 * true — у пользователя есть подтверждённый TOTP-фактор (nextLevel = aal2),
 * а текущая сессия его ещё не прошла (currentLevel = aal1).
 * При ошибке чтения отвечаем true: для owner/admin лучше лишний раз
 * спросить код, чем пустить без него.
 */
export async function sessionNeedsMfa(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return true;
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch {
    return true;
  }
}

/** Роли, для которых второй шаг обязателен, если он включён. */
export const MFA_ENFORCED_ROLES = new Set(["owner", "admin"]);
