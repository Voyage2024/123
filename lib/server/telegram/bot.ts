import "server-only";

import { Bot, GrammyError, HttpError } from "grammy";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { copy, faqMenu, languageMenu, mainMenu } from "@/lib/server/telegram/copy";
import { cancelRegistration, beginRegistration, getConversationState, saveConversationState, handleRegistrationPhoto, handleRegistrationText, sendWelcome, updateConversationLanguage } from "@/lib/server/telegram/onboarding";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { getPreferredTelegramLanguage } from "@/lib/server/telegram/preferences";
import { sendApprovedCredentialsTelegram } from "@/lib/server/telegram/credentials";
import { languageFromTelegram, type TelegramLang } from "@/lib/server/telegram/types";
import { handlePartnerContractSignCallback } from "@/lib/server/telegram/partner-notifications";

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

async function connectTelegramIdentity(
  ctx: import("grammy").Context,
  lang: TelegramLang,
  rawToken: string,
): Promise<void> {
  const messages = {
    EN: { invalid: "This Telegram connection link is invalid, expired, or already used.", conflict: "This Telegram account is already linked to another VOYAGE profile.", unavailable: "This profile is not eligible to connect Telegram. Contact VOYAGE support.", failed: "Could not connect Telegram right now. Please request a new link.", success: "Telegram has been connected to your VOYAGE profile. Notifications will arrive in this chat." },
    RU: { invalid: "Ссылка подключения Telegram недействительна, истекла или уже использована.", conflict: "Этот Telegram уже привязан к другому профилю VOYAGE.", unavailable: "Этот профиль не может подключить Telegram. Обратитесь в поддержку VOYAGE.", failed: "Не удалось подключить Telegram. Запросите новую ссылку.", success: "Telegram привязан к вашему профилю VOYAGE. Уведомления будут приходить в этот чат." },
    ES: { invalid: "El enlace para conectar Telegram no es válido, ha caducado o ya se utilizó.", conflict: "Esta cuenta de Telegram ya está vinculada a otro perfil de VOYAGE.", unavailable: "Este perfil no puede conectar Telegram. Contacta con soporte.", failed: "No se pudo conectar Telegram. Solicita un nuevo enlace.", success: "Telegram está conectado a tu perfil de VOYAGE. Las notificaciones llegarán a este chat." },
    PT: { invalid: "O link para conectar o Telegram é inválido, expirou ou já foi usado.", conflict: "Esta conta do Telegram já está vinculada a outro perfil VOYAGE.", unavailable: "Este perfil não pode conectar o Telegram. Entre em contato com o suporte.", failed: "Não foi possível conectar o Telegram. Solicite um novo link.", success: "O Telegram foi conectado ao seu perfil VOYAGE. As notificações chegarão neste chat." },
  }[lang];

  if (!ctx.from || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    await ctx.reply(messages.invalid, { reply_markup: mainMenu(lang) });
    return;
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const { data, error } = await getTelegramServiceClient().rpc("consume_telegram_identity_recovery", {
    p_token_hash: tokenHash,
    p_telegram_id: String(ctx.from.id),
    p_telegram_username: ctx.from.username ?? null,
  });
  if (error) {
    console.error("[telegram-link] token consume failed", { code: error.code ?? "unknown" });
    await ctx.reply(messages.failed, { reply_markup: mainMenu(lang) });
    return;
  }

  const binding = data as { ok?: boolean; reason?: string } | null;
  if (!binding?.ok) {
    const message = binding?.reason === "telegram_already_linked" ? messages.conflict
      : ["profile_not_approved", "profile_unavailable", "profile_missing_email", "profile_banned"].includes(String(binding?.reason)) ? messages.unavailable
      : messages.invalid;
    await ctx.reply(message, { reply_markup: mainMenu(lang) });
    return;
  }

  await ctx.reply(messages.success, { reply_markup: mainMenu(lang) });
}

async function recoverTelegramIdentity(
  ctx: import("grammy").Context,
  lang: TelegramLang,
  rawToken: string,
): Promise<void> {
  const replyCopy = {
    EN: {
      invalid: "This recovery link is invalid, expired, or already used. Ask the club owner for a new link.",
      conflict: "This Telegram account is already linked to another VOYAGE profile. Contact the club owner.",
      blocked: "This profile is blocked. The club owner must lift the restriction before access can be restored.",
      unavailable: "This profile is not eligible for Telegram recovery. Contact VOYAGE support.",
      passwordFailed: "The Telegram account was linked, but password rotation failed. Send /password in this chat to retry, or contact support.",
      success: "Telegram access has been restored. Use the credentials below to sign in to the VOYAGE website, then change your password.",
      failed: "We could not complete recovery. Contact VOYAGE support and ask for a new recovery link.",
    },
    RU: {
      invalid: "Ссылка восстановления недействительна, истекла или уже использована. Попросите владельца клуба выдать новую ссылку.",
      conflict: "Этот Telegram уже привязан к другому профилю VOYAGE. Обратитесь к владельцу клуба.",
      blocked: "Профиль заблокирован. Сначала владелец клуба должен снять ограничение.",
      unavailable: "Этот профиль нельзя восстановить через Telegram. Обратитесь в поддержку VOYAGE.",
      passwordFailed: "Telegram привязан, но сменить пароль не удалось. Отправьте /password в этот чат для повторной попытки или обратитесь в поддержку.",
      success: "Доступ к Telegram восстановлен. Используйте данные ниже для входа на сайт VOYAGE, затем смените пароль.",
      failed: "Не удалось завершить восстановление. Обратитесь в поддержку VOYAGE за новой ссылкой.",
    },
    ES: {
      invalid: "El enlace de recuperación no es válido, ha caducado o ya se utilizó. Pide otro enlace al propietario del club.",
      conflict: "Esta cuenta de Telegram ya está vinculada a otro perfil de VOYAGE. Contacta con el propietario.",
      blocked: "El perfil está bloqueado. El propietario debe levantar la restricción antes de restaurar el acceso.",
      unavailable: "Este perfil no puede recuperarse mediante Telegram. Contacta con soporte.",
      passwordFailed: "Telegram se vinculó, pero no se pudo cambiar la contraseña. Envía /password para volver a intentarlo.",
      success: "Se ha restaurado el acceso a Telegram. Usa estos datos para entrar en VOYAGE y cambia la contraseña después.",
      failed: "No se pudo completar la recuperación. Contacta con soporte para recibir un nuevo enlace.",
    },
    PT: {
      invalid: "O link de recuperação é inválido, expirou ou já foi usado. Peça um novo link ao proprietário do clube.",
      conflict: "Esta conta do Telegram já está vinculada a outro perfil VOYAGE. Entre em contato com o proprietário.",
      blocked: "O perfil está bloqueado. O proprietário precisa remover a restrição antes de restaurar o acesso.",
      unavailable: "Este perfil não pode ser recuperado pelo Telegram. Entre em contato com o suporte.",
      passwordFailed: "O Telegram foi vinculado, mas a senha não foi alterada. Envie /password para tentar novamente.",
      success: "O acesso ao Telegram foi restaurado. Use estes dados para entrar no VOYAGE e altere a senha depois.",
      failed: "Não foi possível concluir a recuperação. Entre em contato com o suporte para receber um novo link.",
    },
  }[lang];

  if (!ctx.from || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    await ctx.reply(replyCopy.invalid, { reply_markup: mainMenu(lang) });
    return;
  }

  const db = getTelegramServiceClient();
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  type IdentityRecoveryBinding = { ok?: boolean; reason?: string; profile_id?: string; email?: string; full_name?: string | null };
  let binding: IdentityRecoveryBinding | null = null;
  try {
    const { data, error } = await db.rpc("consume_telegram_identity_recovery", {
      p_token_hash: tokenHash,
      p_telegram_id: String(ctx.from.id),
      p_telegram_username: ctx.from.username ?? null,
    });
    if (error) {
      console.error("[identity-recovery] token claim failed", error.code ?? "unknown");
      await ctx.reply(replyCopy.failed, { reply_markup: mainMenu(lang) });
      return;
    }
    binding = data as IdentityRecoveryBinding | null;
  } catch (error) {
    console.error("[identity-recovery] token claim threw", error instanceof Error ? error.name : "unknown");
    await ctx.reply(replyCopy.failed, { reply_markup: mainMenu(lang) });
    return;
  }

  if (!binding?.ok) {
    const message = binding?.reason === "telegram_already_linked" ? replyCopy.conflict
      : binding?.reason === "profile_banned" ? replyCopy.blocked
      : binding?.reason === "profile_not_approved" || binding?.reason === "profile_unavailable" || binding?.reason === "profile_missing_email" ? replyCopy.unavailable
      : replyCopy.invalid;
    await ctx.reply(message, { reply_markup: mainMenu(lang) });
    return;
  }

  const profileId = binding.profile_id;
  const login = binding.email?.trim();
  if (!profileId || !login) {
    await ctx.reply(replyCopy.unavailable, { reply_markup: mainMenu(lang) });
    return;
  }

  const password = Array.from(
    { length: 22 },
    () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-"[
      randomInt(0, "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-".length)
    ],
  ).join("");
  const issueId = randomUUID();

  // Rotate the issue id first so any stale delivery cannot send old credentials to the old Telegram ID.
  const { error: issueError } = await db.from("profiles")
    .update({ credential_issue_id: issueId, temp_password: null })
    .eq("id", profileId)
    .eq("telegram_id", String(ctx.from.id));
  if (issueError) {
    console.error("[identity-recovery] credential issue update failed", issueError.code ?? "unknown");
    await ctx.reply(replyCopy.passwordFailed, { reply_markup: mainMenu(lang) });
    return;
  }

  const { error: passwordError } = await db.auth.admin.updateUserById(profileId, {
    email: login,
    password,
    email_confirm: true,
  });
  if (passwordError) {
    console.error("[identity-recovery] Auth password update failed", passwordError.code ?? "unknown");
    await ctx.reply(replyCopy.passwordFailed, { reply_markup: mainMenu(lang) });
    return;
  }

  const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  try {
    await ctx.reply(
      `${replyCopy.success}\n\n<b>Login:</b> <code>${escapeHtml(login)}</code>\n<b>Password:</b> <code>${escapeHtml(password)}</code>`,
      { parse_mode: "HTML", reply_markup: mainMenu(lang) },
    );
  } catch (error) {
    // Never log the plaintext password. The account has been rebound; an owner can issue a new link if delivery failed.
    console.error("[identity-recovery] credentials reply failed", error instanceof Error ? error.name : "unknown");
  }
}

function inviteLinkMessage(lang: TelegramLang, alreadyLinked: boolean): string {
  if (alreadyLinked) {
    return {
      EN: "A different invitation is already attached. Send /cancel, then open the new invitation link.",
      RU: "К анкете уже привязано другое приглашение. Отправьте /cancel, затем откройте новую ссылку-приглашение.",
      ES: "Ya hay otra invitación vinculada. Envía /cancel y luego abre el nuevo enlace de invitación.",
      PT: "Já existe outro convite vinculado. Envie /cancel e abra o novo link de convite.",
    }[lang];
  }
  return {
    EN: "This invitation link is invalid, expired, or already used. Ask the inviter for a new link.",
    RU: "Ссылка приглашения недействительна, истекла или уже использована. Попросите новую ссылку.",
    ES: "El enlace de invitación no es válido, ha caducado o ya se utilizó. Pide un nuevo enlace.",
    PT: "O link de convite é inválido, expirou ou já foi usado. Peça um novo link.",
  }[lang];
}

export function createVoyageTelegramBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") {
      await ctx.reply("Please use VOYAGE Concierge in a private chat.");
      return;
    }
    const lang = await contextLanguage(ctx);
    const telegramId = String(ctx.from.id);
    const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";
    if (payload.startsWith("link_")) {
      // Accept the early prefixed format during rollout as well as the contract's raw token.
      await connectTelegramIdentity(ctx, lang, payload.slice("link_".length));
      return;
    }
    if (/^[A-Za-z0-9_-]{43}$/.test(payload)) {
      await connectTelegramIdentity(ctx, lang, payload);
      return;
    }
    if (payload.startsWith("recover_")) {
      await recoverTelegramIdentity(ctx, lang, payload.slice("recover_".length));
      return;
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

    let referralCode: string | null = null;
    if (payload.startsWith("ref_")) {
      const candidate = payload.slice(4).trim().toUpperCase();
      if (!/^VYG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(candidate)) {
        await ctx.reply(inviteLinkMessage(lang, false), { reply_markup: mainMenu(lang) });
        return;
      }
      const { data: invite, error } = await getTelegramServiceClient()
        .from("club_invites")
        .select("code,status,expires_at")
        .eq("code", candidate)
        .maybeSingle();
      if (error) {
        console.error("[telegram-webhook] referral link lookup failed", error.code ?? "unknown");
        await ctx.reply(inviteLinkMessage(lang, false), { reply_markup: mainMenu(lang) });
        return;
      }
      if (!invite || invite.status !== "sealed" || Date.parse(String(invite.expires_at)) <= Date.now()) {
        if (invite?.status === "sealed" && Date.parse(String(invite.expires_at)) <= Date.now()) {
          await getTelegramServiceClient().from("club_invites").update({ status: "expired" }).eq("code", candidate).eq("status", "sealed");
        }
        await ctx.reply(inviteLinkMessage(lang, false), { reply_markup: mainMenu(lang) });
        return;
      }
      referralCode = candidate;
    }

    // The apply deep link starts onboarding immediately. A referral link does the same,
    // preserving the referral code in the persisted Telegram conversation until submission.
    if (payload === "apply" || referralCode) {
      const current = await getConversationState(telegramId);
      if (current) {
        if (referralCode && current.referral_code && current.referral_code !== referralCode) {
          await ctx.reply(inviteLinkMessage(lang, true), { reply_markup: mainMenu(lang) });
          return;
        }
        const updated = {
          ...current,
          telegram_username: ctx.from.username ?? current.telegram_username ?? null,
          referral_code: current.referral_code ?? referralCode,
        };
        await saveConversationState(updated);
        const copyText = copy(lang);
        const prompt = current.stage === "submitting"
          ? copyText.onboarding.saving
          : current.stage === "photos"
            ? copyText.onboarding.sendPhoto
            : copyText.prompts[current.stage];
        await ctx.reply(prompt ?? copyText.welcome, { reply_markup: mainMenu(lang) });
        return;
      }
      await beginRegistration(ctx, lang, referralCode);
      return;
    }

    await sendWelcome(ctx, lang);
  });

  bot.command("myid", async (ctx) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return;
    const lang = await contextLanguage(ctx);
    const labels = {
      EN: "Your Telegram ID",
      RU: "Ваш Telegram ID",
      ES: "Tu ID de Telegram",
      PT: "Seu ID do Telegram",
    } as const;
    await ctx.reply(`${labels[lang]}: <code>${ctx.from.id}</code>`, { parse_mode: "HTML" });
  });

  bot.command("password", async (ctx) => {
    if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return;
    const lang = await contextLanguage(ctx);
    const telegramId = String(ctx.from.id);
    const db = getTelegramServiceClient();
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,email,full_name,role,status,kyc_level,telegram_id,credential_issue_id,banned_until,ban_permanent")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    const messages = {
      EN: {
        unavailable: "Password reset is available only for an active, approved resident linked to this Telegram account.",
        failed: "I could not reset your password. Please contact VOYAGE support.",
        delivered: "Your new website password has been sent above.",
        fallback: "Telegram credential delivery had a temporary issue. Your updated website credentials are below. Sign in and change the password immediately.",
      },
      RU: {
        unavailable: "Сброс пароля доступен только активной одобренной резидентке, чей профиль привязан к этому Telegram.",
        failed: "Не удалось сбросить пароль. Обратитесь в поддержку VOYAGE.",
        delivered: "Новый пароль от сайта отправлен выше.",
        fallback: "При отправке доступов возникла ошибка. Ниже ваши обновлённые данные для входа на сайт. После входа сразу смените пароль.",
      },
      ES: {
        unavailable: "El restablecimiento solo está disponible para una residente activa y aprobada vinculada a esta cuenta de Telegram.",
        failed: "No se pudo restablecer la contraseña. Contacta con el soporte de VOYAGE.",
        delivered: "Tu nueva contraseña del sitio se ha enviado arriba.",
        fallback: "Hubo un problema temporal al enviar las credenciales. Aquí están tus datos actualizados. Cambia la contraseña después de iniciar sesión.",
      },
      PT: {
        unavailable: "A redefinição só está disponível para uma residente ativa e aprovada vinculada a esta conta do Telegram.",
        failed: "Não foi possível redefinir a senha. Entre em contato com o suporte VOYAGE.",
        delivered: "Sua nova senha do site foi enviada acima.",
        fallback: "Houve um problema temporário ao enviar as credenciais. Seus dados atualizados estão abaixo. Altere a senha após entrar.",
      },
    }[lang];

    const banUntil = profile?.banned_until === "infinity" ? Number.POSITIVE_INFINITY : profile?.banned_until ? Date.parse(String(profile.banned_until)) : NaN;
    const banned = profile?.ban_permanent === true || profile?.banned_until === "infinity" || (Number.isFinite(banUntil) && banUntil > Date.now());
    if (profileError || !profile || profile.role !== "resident" || profile.status !== "approved" || Number(profile.kyc_level ?? 0) < 0 || banned) {
      await ctx.reply(messages.unavailable, { reply_markup: mainMenu(lang) });
      return;
    }

    const { data: authResult, error: authLookupError } = await db.auth.admin.getUserById(profile.id);
    const login = profile.email ?? authResult?.user?.email ?? null;
    if (authLookupError || !authResult.user || !login) {
      await ctx.reply(messages.failed, { reply_markup: mainMenu(lang) });
      return;
    }

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
    const password = Array.from({ length: 20 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
    const deliveryId = randomUUID();
    // Reserve the credential generation first. If this DB write fails, do not rotate Auth.
    const { error: issueError } = await db.from("profiles")
      .update({ credential_issue_id: deliveryId, temp_password: null })
      .eq("id", profile.id);
    if (issueError) {
      console.error("[telegram-password] issue reference update failed", issueError.code ?? "unknown");
      await ctx.reply(messages.failed, { reply_markup: mainMenu(lang) });
      return;
    }

    const { error: passwordError } = await db.auth.admin.updateUserById(profile.id, {
      email: login,
      password,
      email_confirm: true,
    });
    if (passwordError) {
      console.error("[telegram-password] Auth password update failed", passwordError.code ?? "unknown");
      const { error: rollbackError } = await db.from("profiles")
        .update({ credential_issue_id: profile.credential_issue_id ?? null })
        .eq("id", profile.id)
        .eq("credential_issue_id", deliveryId);
      if (rollbackError) console.error("[telegram-password] delivery reference rollback failed", rollbackError.code ?? "unknown");
      await ctx.reply(messages.failed, { reply_markup: mainMenu(lang) });
      return;
    }

    try {
      const delivered = await sendApprovedCredentialsTelegram({
          deliveryId,
          profileId: profile.id,
          telegramId,
          login,
          password,
          fullName: profile.full_name,
        });
      if (delivered.sent) return;
      console.warn("[telegram-password] primary delivery failed; attempting direct reply", delivered.error);
    } catch (error) {
      console.error("[telegram-password] primary delivery threw", error instanceof Error ? error.name : "unknown");
    }

    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
    try {
      await ctx.reply(`${messages.fallback}\n\n<b>Login:</b> <code>${escapeHtml(login)}</code>\n<b>Password:</b> <code>${escapeHtml(password)}</code>`, {
        parse_mode: "HTML",
        reply_markup: mainMenu(lang),
      });
    } catch (error) {
      console.error("[telegram-password] fallback delivery failed", error instanceof Error ? error.name : "unknown");
    }
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

  // Re-check recipient identity and current contract version before accepting a signature.
  bot.callbackQuery(/^partner:sign:[A-Za-z0-9_-]{1,48}$/i, handlePartnerContractSignCallback);

  for (const lang of ["EN", "RU", "ES", "PT"] as const) {
    bot.callbackQuery(`lang:${lang}`, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!ctx.from) return;
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
