import "server-only";

import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { isTelegramLang, languageFromTelegram, type TelegramLang } from "@/lib/server/telegram/types";

/** Returns a manually selected language, or null if this user has not selected one yet. */
export async function getStoredTelegramLanguage(telegramId: string): Promise<TelegramLang | null> {
  try {
    const { data, error } = await getTelegramServiceClient()
      .from("telegram_preferences")
      .select("language")
      .eq("telegram_id", telegramId)
      .maybeSingle();
    if (!error && data && isTelegramLang(String(data.language))) return data.language as TelegramLang;
  } catch (error) {
    console.error("[telegram-webhook] language preference lookup failed", error instanceof Error ? error.name : "unknown");
  }
  return null;
}

export async function getPreferredTelegramLanguage(telegramId: string, telegramLanguageCode?: string | null): Promise<TelegramLang> {
  return (await getStoredTelegramLanguage(telegramId)) ?? languageFromTelegram(telegramLanguageCode);
}

export async function savePreferredTelegramLanguage(
  telegramId: string,
  language: TelegramLang,
  username?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const db = getTelegramServiceClient();
  const { error } = await db.from("telegram_preferences").upsert({
    telegram_id: telegramId,
    language,
    telegram_username: username ?? null,
    updated_at: now,
  }, { onConflict: "telegram_id" });
  if (error) throw new Error("Could not save the Telegram language preference.");
  await db.from("telegram_conversations")
    .update({ telegram_language: language, updated_at: now })
    .eq("telegram_id", telegramId);
  await db.from("profiles").update({ telegram_language: language }).eq("telegram_id", telegramId);
}
