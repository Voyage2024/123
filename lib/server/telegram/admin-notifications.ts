import "server-only";

import { InlineKeyboard } from "grammy";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import type { TelegramLang } from "@/lib/server/telegram/types";

type RegistrationSource = "landing" | "telegram_bot" | "referral";
type RegistrationNotice = {
  eventKey: string;
  source: RegistrationSource;
  fullName: string;
  profileId?: string | null;
  applicationId?: string | null;
  email?: string | null;
  contact?: string | null;
  instagram?: string | null;
  telegramId?: string | null;
  referrerName?: string | null;
};

const COPY: Record<TelegramLang, {
  title: string; source: Record<RegistrationSource, string>; name: string; email: string; contact: string;
  instagram: string; telegram: string; sponsor: string; openDossier: string; openApplications: string;
}> = {
  EN: { title: "New VOYAGE registration", source: { landing: "Website landing page", telegram_bot: "Telegram bot", referral: "Referral" }, name: "Name", email: "Email", contact: "Contact", instagram: "Instagram", telegram: "Telegram ID", sponsor: "Referred by", openDossier: "Open profile dossier", openApplications: "Open membership applications" },
  RU: { title: "Новая заявка VOYAGE", source: { landing: "С лендинга", telegram_bot: "Из Telegram-бота", referral: "По рекомендации" }, name: "Имя", email: "Email", contact: "Контакт", instagram: "Instagram", telegram: "Telegram ID", sponsor: "Рекомендатель", openDossier: "Открыть досье", openApplications: "Открыть заявки на вступление" },
  ES: { title: "Nueva solicitud de VOYAGE", source: { landing: "Desde la página web", telegram_bot: "Desde el bot de Telegram", referral: "Por recomendación" }, name: "Nombre", email: "Correo", contact: "Contacto", instagram: "Instagram", telegram: "ID de Telegram", sponsor: "Recomendado por", openDossier: "Abrir expediente", openApplications: "Abrir solicitudes de ingreso" },
  PT: { title: "Nova candidatura VOYAGE", source: { landing: "Pelo site", telegram_bot: "Pelo bot do Telegram", referral: "Por recomendação" }, name: "Nome", email: "E-mail", contact: "Contato", instagram: "Instagram", telegram: "ID do Telegram", sponsor: "Indicado por", openDossier: "Abrir dossiê", openApplications: "Abrir candidaturas" },
};

function escapeHtml(value: unknown): string {
  return String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

function sourceLabel(source: string, utmSource?: string | null): RegistrationSource {
  const value = `${source} ${utmSource ?? ""}`.toLowerCase();
  if (/referr|recommend|invite|friend|реф|рекоменд|приглаш/.test(value)) return "referral";
  if (/telegram|telegram_bot|(^|[^a-z])tg([^a-z]|$)|бот/.test(value)) return "telegram_bot";
  return "landing";
}

/** Notify each opted-in current owner/admin once per event. Errors never block signup/KYC. */
export async function notifyAdminsOfNewRegistration(input: RegistrationNotice): Promise<void> {
  try {
    const db = getTelegramServiceClient();
    const { data: settings, error: settingsError } = await db.from("admin_settings")
      .select("admin_id,notifications_tg_id,notify_new_applications,notification_language")
      .eq("notify_new_applications", true)
      .not("notifications_tg_id", "is", null);
    if (settingsError) throw settingsError;
    const configured = (settings ?? []).filter((row) => typeof row.notifications_tg_id === "string" && /^-?[0-9]{5,20}$/.test(row.notifications_tg_id));
    if (!configured.length) {
      console.info("[admin-telegram-notify] no recipients configured", { eventKey: input.eventKey });
      return;
    }
    const adminIds = Array.from(new Set(configured.map((row) => row.admin_id)));
    const { data: profiles, error: profilesError } = await db.from("profiles").select("id,role").in("id", adminIds);
    if (profilesError) throw profilesError;
    const allowed = new Set((profiles ?? []).filter((row) => row.role === "owner" || row.role === "admin").map((row) => row.id));
    const recipients = new Map<string, TelegramLang>();
    for (const row of configured) {
      if (!allowed.has(row.admin_id)) continue;
      const chatId = String(row.notifications_tg_id);
      if (!recipients.has(chatId)) recipients.set(chatId, (["EN", "RU", "ES", "PT"].includes(String(row.notification_language)) ? row.notification_language : "EN") as TelegramLang);
    }
    if (!recipients.size) return;

    const resolvedSource = sourceLabel(input.source, null);
    const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").trim();
    let destination: string | null = null;
    try {
      if (siteBase) destination = new URL(input.profileId ? `/admin/database/${input.profileId}` : "/admin/requests", siteBase).toString();
    } catch { destination = null; }

    // Dynamic import avoids a circular import: onboarding handlers are installed by bot.ts.
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    const bot = getVoyageTelegramBot();
    for (const [chatId, lang] of recipients) {
      const claimResult = await db.rpc("claim_admin_telegram_notification", { p_event_key: input.eventKey, p_recipient_chat_id: chatId });
      if (claimResult.error) {
        console.error("[admin-telegram-notify] delivery claim failed", { code: claimResult.error.code, eventKey: input.eventKey });
        continue;
      }
      if (claimResult.data !== true) continue;
      const t = COPY[lang];
      const lines = [
        `<b>${t.title}</b>`,
        `<b>${escapeHtml(t.source[resolvedSource])}</b>`,
        `${escapeHtml(t.name)}: ${escapeHtml(input.fullName)}`,
      ];
      if (input.email) lines.push(`${escapeHtml(t.email)}: ${escapeHtml(input.email)}`);
      if (input.contact) lines.push(`${escapeHtml(t.contact)}: ${escapeHtml(input.contact)}`);
      if (input.instagram) lines.push(`${escapeHtml(t.instagram)}: ${escapeHtml(input.instagram)}`);
      if (input.telegramId) lines.push(`${escapeHtml(t.telegram)}: <code>${escapeHtml(input.telegramId)}</code>`);
      if (input.referrerName) lines.push(`${escapeHtml(t.sponsor)}: ${escapeHtml(input.referrerName)}`);
      try {
        const keyboard = destination ? new InlineKeyboard().url(input.profileId ? t.openDossier : t.openApplications, destination) : undefined;
        await bot.api.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML", ...(keyboard ? { reply_markup: keyboard } : {}) });
        const { error: finishError } = await db.rpc("finish_admin_telegram_notification", { p_event_key: input.eventKey, p_recipient_chat_id: chatId, p_status: "sent", p_error: null });
        if (finishError) console.error("[admin-telegram-notify] sent status update failed", { code: finishError.code, eventKey: input.eventKey });
      } catch (error) {
        const code = error && typeof error === "object" && "error_code" in error ? String((error as { error_code: unknown }).error_code) : error instanceof Error ? error.name : "send_failed";
        await db.rpc("finish_admin_telegram_notification", { p_event_key: input.eventKey, p_recipient_chat_id: chatId, p_status: "failed", p_error: code });
        console.error("[admin-telegram-notify] Telegram delivery failed", { eventKey: input.eventKey, recipient: chatId, code });
      }
    }
  } catch (error) {
    console.error("[admin-telegram-notify] notification pipeline failed", error instanceof Error ? error.name : "unknown");
  }
}

export function normalizeRegistrationSource(source?: string | null, utmSource?: string | null): RegistrationSource {
  return sourceLabel(source ?? "landing", utmSource);
}
