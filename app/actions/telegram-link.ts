"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";

export type TelegramConnectLinkResult =
  | { ok: true; link: string; expiresAt: string }
  | { ok: false; error: string };

/** Create a ten-minute, single-use deep link for the signed-in user's own profile. */
export async function createTelegramConnectLink(): Promise<TelegramConnectLinkResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return { ok: false, error: "Необходима авторизация." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,role,status,banned_until,ban_permanent")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) return { ok: false, error: "Профиль не найден." };

  const role = String(profile.role ?? "");
  if (!["resident", "admin", "manager"].includes(role)) {
    return { ok: false, error: "Для этой роли подключение Telegram недоступно." };
  }
  if (role === "resident" && profile.status !== "approved") {
    return { ok: false, error: "Сначала необходимо пройти Face Control." };
  }
  const bannedUntil = typeof profile.banned_until === "string" ? Date.parse(profile.banned_until) : NaN;
  if (profile.ban_permanent === true || profile.banned_until === "infinity" || (Number.isFinite(bannedUntil) && bannedUntil > Date.now())) {
    return { ok: false, error: "Нельзя подключить Telegram для заблокированного профиля." };
  }
  if (!String(profile.email ?? "").trim()) {
    return { ok: false, error: "У профиля отсутствует email. Обратитесь в поддержку." };
  }

  const botUsername = (process.env.NEXT_PUBLIC_BOT_USERNAME ?? "").trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(botUsername)) {
    return { ok: false, error: "Не задан корректный NEXT_PUBLIC_BOT_USERNAME." };
  }

  const service = getTelegramServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // Invalidate older unconsumed links for this profile before issuing a new token.
  const { error: revokeError } = await service
    .from("telegram_identity_recovery_tokens")
    .update({ revoked_at: now.toISOString() })
    .eq("profile_id", user.id)
    .is("used_at", null)
    .is("revoked_at", null);
  if (revokeError) {
    console.error("[telegram-link] existing token revocation failed", { code: revokeError.code ?? "unknown" });
    return { ok: false, error: "Не удалось подготовить ссылку. Попробуйте ещё раз." };
  }

  const { error: insertError } = await service.from("telegram_identity_recovery_tokens").insert({
    token_hash: tokenHash,
    profile_id: user.id,
    created_by: user.id,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (insertError) {
    console.error("[telegram-link] token insert failed", { code: insertError.code ?? "unknown" });
    return { ok: false, error: "Не удалось сохранить ссылку. Попробуйте ещё раз." };
  }

  revalidatePath("/dashboard/settings");
  return {
    ok: true,
    link: `https://t.me/${botUsername}?start=${rawToken}`,
    expiresAt: expiresAt.toISOString(),
  };
}
