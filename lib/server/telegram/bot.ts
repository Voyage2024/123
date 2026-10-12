import "server-only";

import { Bot, GrammyError, HttpError } from "grammy";
import { copy, faqMenu, languageMenu, mainMenu } from "./copy";
import { cancelRegistration, beginRegistration, handleRegistrationPhoto, handleRegistrationText, sendWelcome, updateConversationLanguage } from "./onboarding";
import { getTelegramServiceClient } from "./service-client";
import { getPreferredTelegramLanguage, getStoredTelegramLanguage, savePreferredTelegramLanguage } from "./preferences";
import { languageFromTelegram, type TelegramLang } from "./types";

function isBanned(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  const until = profile.banned_until ? Date.parse(profile.banned_until) : NaN;
  return Number.isFinite(until) && until > Date.now();
}

async function contextLanguage(ctx: import("grammy").Context): Promise<TelegramLang> {
  if (ctx.from) return getPreferredTelegramLanguage(String(ctx.from.id), ctx.from.language_code);
  return languageFromTelegram(undefined);
}

async function getLinkedProfile(telegramId: string) {
  const { data, error } = await getTelegramServiceClient()
    .from("profiles")
    .select("id,status,kyc_level,banned_until,ban_permanent")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) {
    console.error("[telegram-webhook] linked-profile lookup failed", error.code ?? "unknown");
    throw new Error("Could not look up the VOYAGE profile.");
  }
  return data;
}

export function createVoyageTelegramBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") {
      await ctx.reply("Please use VOYAGE Concierge in a private chat.");
      return;
    }
    const telegramId = String(ctx.from.id);
    const storedLanguage = await getStoredTelegramLanguage(telegramId);
    const telegramCode = (ctx.from.language_code ?? "").toLowerCase();
    const supportedAutoLanguage = /^(en|ru|es|pt)(-|$)/.test(telegramCode);
    if (!storedLanguage && !supportedAutoLanguage) {
      // Unknown Telegram locale: show a localized language picker instead of
      // surprising a new international user with a Russian-only greeting.
      await ctx.reply("Choose your language / Выберите язык / Elige tu idioma / Escolha seu idioma:", { reply_markup: languageMenu() });
      return;
    }
    const lang = storedLanguage ?? languageFromTelegram(ctx.from.language_code);
    if (!storedLanguage) {
      await savePreferredTelegramLanguage(telegramId, lang, ctx.from.username);
    }
    const profile = await getLinkedProfile(telegramId);
    if (profile) {
      const t = copy(lang);
      if (isBanned(profile)) await ctx.reply(t.alreadyBanned, { reply_markup: mainMenu(lang) });
      else if (profile.status === "approved") await ctx.reply(t.alreadyApproved, { reply_markup: mainMenu(lang) });
      else if (profile.status === "rejected") await ctx.reply(t.alreadyRejected, { reply_markup: mainMenu(lang) });
      else await ctx.reply(t.alreadyPending, { reply_markup: mainMenu(lang) });
      return;
    }
    await sendWelcome(ctx, lang);
  });

  bot.command("cancel", cancelRegistration);
  bot.command("faq", async (ctx) => {
    const lang = await contextLanguage(ctx);
    await ctx.reply(copy(lang).faqTitle, { reply_markup: faqMenu(lang) });
  });
  bot.command("support", async (ctx) => {
    const lang = await contextLanguage(ctx);
    const supportUsername = (process.env.TELEGRAM_SUPPORT_USERNAME ?? "voyage_support").replace(/^@/, "");
    await ctx.reply(copy(lang).supportText.replace("{{username}}", supportUsername), { reply_markup: mainMenu(lang) });
  });

  bot.callbackQuery("menu:register", async (ctx) => {
    await ctx.answerCallbackQuery();
    await beginRegistration(ctx, await contextLanguage(ctx));
  });
  bot.callbackQuery("menu:faq", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = await contextLanguage(ctx);
    await ctx.reply(copy(lang).faqTitle, { reply_markup: faqMenu(lang) });
  });
  bot.callbackQuery("menu:support", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = await contextLanguage(ctx);
    const supportUsername = (process.env.TELEGRAM_SUPPORT_USERNAME ?? "voyage_support").replace(/^@/, "");
    await ctx.reply(copy(lang).supportText.replace("{{username}}", supportUsername), { reply_markup: mainMenu(lang) });
  });
  bot.callbackQuery("menu:language", async (ctx) => {
    await ctx.answerCallbackQuery();
    const lang = await contextLanguage(ctx);
    await ctx.reply(copy(lang).languageTitle, { reply_markup: languageMenu() });
  });

  const faqTopics = ["application", "review", "photos", "access"] as const;
  for (const topic of faqTopics) {
    bot.callbackQuery(`faq:${topic}`, async (ctx) => {
      await ctx.answerCallbackQuery();
      const lang = await contextLanguage(ctx);
      const item = copy(lang).faq[topic];
      await ctx.reply(`*${item.title}*\n\n${item.answer}`, { parse_mode: "Markdown", reply_markup: faqMenu(lang) });
    });
  }
  bot.callbackQuery("faq:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendWelcome(ctx, await contextLanguage(ctx));
  });

  for (const lang of ["EN", "RU", "ES", "PT"] as const) {
    bot.callbackQuery(`lang:${lang}`, async (ctx) => {
      await ctx.answerCallbackQuery();
      await updateConversationLanguage(String(ctx.from.id), lang as TelegramLang, ctx.from.username);
      await sendWelcome(ctx, lang as TelegramLang);
    });
  }

  bot.on("message:photo", async (ctx) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return;
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1];
    const handled = await handleRegistrationPhoto(ctx, photo.file_id);
    if (!handled) { const lang = await contextLanguage(ctx); await ctx.reply(copy(lang).welcome, { reply_markup: mainMenu(lang) }); }
  });

  bot.on("message:text", async (ctx) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return;
    const handled = await handleRegistrationText(ctx, ctx.message.text);
    if (!handled) {
      const lang = await contextLanguage(ctx);
      await ctx.reply(copy(lang).welcome, { reply_markup: mainMenu(lang) });
    }
  });

  bot.on("message", async (ctx) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return;
    const lang = await contextLanguage(ctx);
    await ctx.reply(copy(lang).welcome, { reply_markup: mainMenu(lang) });
  });

  bot.catch(({ ctx, error }) => {
    console.error(`[telegram-webhook] update ${ctx.update.update_id} failed`);
    if (error instanceof GrammyError) {
      console.error("[telegram-webhook] Telegram API error", error.error_code);
    } else if (error instanceof HttpError) {
      console.error("[telegram-webhook] Telegram transport error");
    } else {
      console.error("[telegram-webhook] handler error", error instanceof Error ? error.name : "unknown");
    }
    // Re-throw so Route Handler returns a non-2xx response and Telegram can retry.
    throw error;
  });

  return bot;
}
