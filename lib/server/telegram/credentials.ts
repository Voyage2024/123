import "server-only";

import { Api } from "grammy";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import type { TelegramLang } from "@/lib/server/telegram/types";
import { siteLoginKeyboard, siteLoginLine } from "@/lib/server/telegram/site-login";

export type ApprovedCredentials = {
  deliveryId: string;
  profileId: string;
  telegramId: string | null;
  login: string;
  password: string;
  fullName: string | null;
  /** partner — текст про партнёрский кабинет вместо «анкета одобрена». */
  audience?: "resident" | "partner";
};

export type CredentialDeliveryResult =
  | { sent: true; duplicate?: boolean }
  | { sent: false; error: string };

function langOrDefault(value: unknown): TelegramLang {
  return value === "EN" || value === "ES" || value === "PT" ? value : "RU";
}

function activeBan(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  const until = profile.banned_until ? Date.parse(profile.banned_until) : NaN;
  return Number.isFinite(until) && until > Date.now();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function approvedMessage(lang: TelegramLang, input: ApprovedCredentials): string {
  const safeName = input.fullName?.trim() ? ` ${escapeHtml(input.fullName.trim())}` : "";
  const safeLogin = escapeHtml(input.login);
  const safePassword = escapeHtml(input.password);
  const greeting: Record<TelegramLang, string> = input.audience === "partner"
    ? {
        EN: `Hello${safeName}! Your VOYAGE partner workspace is open.`,
        RU: `Здравствуйте${safeName}! Ваш партнёрский кабинет VOYAGE открыт.`,
        ES: `¡Hola${safeName}! Tu panel de socio de VOYAGE está abierto.`,
        PT: `Olá${safeName}! Seu painel de parceiro VOYAGE está aberto.`,
      }
    : {
        EN: `Hello${safeName}! Your VOYAGE profile has been approved.`,
        RU: `Здравствуйте${safeName}! Ваша анкета VOYAGE одобрена.`,
        ES: `¡Hola${safeName}! Tu perfil de VOYAGE ha sido aprobado.`,
        PT: `Olá${safeName}! Seu perfil VOYAGE foi aprovado.`,
      };
  const labels: Record<TelegramLang, { login: string; password: string; security: string; site: string }> = {
    EN: { login: "Login", password: "Temporary password", security: "Sign in and change this password immediately. For your safety, do not forward this message.", site: "VOYAGE account access" },
    RU: { login: "Логин", password: "Временный пароль", security: "Войдите и сразу смените этот пароль. В целях безопасности не пересылайте это сообщение.", site: "Доступ к аккаунту VOYAGE" },
    ES: { login: "Usuario", password: "Contraseña temporal", security: "Inicia sesión y cambia esta contraseña de inmediato. Por seguridad, no reenvíes este mensaje.", site: "Acceso a VOYAGE" },
    PT: { login: "Login", password: "Senha temporária", security: "Entre e altere esta senha imediatamente. Por segurança, não encaminhe esta mensagem.", site: "Acesso à conta VOYAGE" },
  };
  const text = labels[lang];
  // Telegram HTML <code> displays a copy-friendly monospace credential. All
  // untrusted inserted values are escaped to prevent markup injection.
  return `✅ ${greeting[lang]}\n\n<b>${text.site}</b>\n${text.login}: <code>${safeLogin}</code>\n${text.password}: <code>${safePassword}</code>\n${siteLoginLine(lang)}\n\n${text.security}`;
}

/** Sends credentials directly via Telegram Bot API from the Next.js server runtime. */
export async function sendApprovedCredentialsTelegram(input: ApprovedCredentials): Promise<CredentialDeliveryResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { sent: false, error: "TELEGRAM_BOT_TOKEN is not configured." };
  if (!input.telegramId || !/^\d{4,20}$/.test(input.telegramId)) {
    return { sent: false, error: "Profile has no valid linked Telegram ID." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.profileId) || !/^[0-9a-f-]{36}$/i.test(input.deliveryId)) {
    return { sent: false, error: "Invalid delivery or profile ID." };
  }
  if (!input.login.includes("@") || input.password.length < 14) {
    return { sent: false, error: "Invalid login credentials payload." };
  }

  const db = getTelegramServiceClient();
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,role,telegram_id,status,kyc_level,credential_issue_id,full_name,telegram_language,banned_until,ban_permanent")
    .eq("id", input.profileId)
    .maybeSingle();
  if (profileError || !profile) return { sent: false, error: "Profile not found for Telegram delivery." };
  if (String(profile.telegram_id ?? "") !== input.telegramId) return { sent: false, error: "Telegram ID is not linked to this profile." };
  if (profile.status !== "approved") return { sent: false, error: "Profile is not approved for access delivery." };
  if (activeBan(profile)) return { sent: false, error: "Credentials cannot be delivered to a banned profile." };
  if (profile.credential_issue_id !== input.deliveryId) return { sent: false, error: "Credential delivery is no longer current." };

  const { data: claim, error: claimError } = await db.rpc("voyage_claim_telegram_delivery", {
    p_delivery_id: input.deliveryId,
    p_profile_id: input.profileId,
    p_telegram_id: input.telegramId,
  });
  if (claimError) {
    console.error("[telegram-credentials] delivery claim failed", claimError.code ?? "unknown");
    return { sent: false, error: "The notification could not be claimed for delivery." };
  }
  if (claim === "sent") return { sent: true, duplicate: true };
  if (claim !== "claimed") return { sent: false, error: "A delivery attempt is already in progress. Retry shortly." };

  try {
    const lang = langOrDefault(profile.telegram_language);
    const message = approvedMessage(lang, {
      ...input,
      fullName: profile.full_name ?? input.fullName,
      audience: input.audience ?? (profile.role === "manager" ? "partner" : "resident"),
    });
    await new Api(token).sendMessage(Number(input.telegramId), message, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: siteLoginKeyboard(lang),
    });

    const now = new Date().toISOString();
    const { error: finishError } = await db.from("telegram_delivery_logs")
      .update({ status: "sent", last_error: null, sent_at: now, updated_at: now })
      .eq("delivery_id", input.deliveryId)
      .eq("status", "sending");
    if (finishError) {
      console.error("[telegram-credentials] send succeeded but log update failed", finishError.code ?? "unknown");
      return { sent: false, error: "Message was sent, but delivery status could not be persisted." };
    }
    return { sent: true };
  } catch (error) {
    await db.from("telegram_delivery_logs")
      .update({ status: "failed", last_error: "telegram_send_failed", updated_at: new Date().toISOString() })
      .eq("delivery_id", input.deliveryId)
      .eq("status", "sending");
    console.error("[telegram-credentials] Telegram send failed", error instanceof Error ? error.name : "unknown");
    return { sent: false, error: "Telegram could not deliver the message. Retry it from the profile dossier." };
  }
}
