import "server-only";

import { randomBytes } from "node:crypto";
import type { Context } from "grammy";
import { copy, mainMenu } from "./copy";
import { getTelegramServiceClient } from "./service-client";
import { notifyAdminsOfNewRegistration } from "./admin-notifications";
import { uploadTelegramPhoto } from "./storage";
import type { RegistrationAnswers, TelegramConversationState, TelegramLang } from "./types";
import { getPreferredTelegramLanguage, savePreferredTelegramLanguage } from "./preferences";

const MIN_PHOTOS = 2;
const MAX_PHOTOS = 3;
const STATE_TTL_HOURS = 72;
const STEP_ORDER = ["email", "full_name", "birth_date", "location", "measurements"] as const;
type StepKey = (typeof STEP_ORDER)[number];

function interpolation(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ""));
}

function validateEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateBirthDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "dateFormat";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "invalidDate";
  if (date.getTime() > Date.now()) return "futureDate";
  let age = new Date().getUTCFullYear() - year;
  const now = new Date();
  if (now.getUTCMonth() < month - 1 || (now.getUTCMonth() === month - 1 && now.getUTCDate() < day)) age--;
  if (year < 1900) return "invalidDate";
  if (age < 18) return "age";
  return null;
}

function validateStep(key: StepKey, raw: string): string | null {
  const value = raw.trim();
  if (key === "email") return validateEmail(value) ? null : "invalidEmail";
  if (key === "full_name") return value.length >= 2 && value.length <= 120 ? null : "nameShort";
  if (key === "birth_date") return validateBirthDate(value);
  if (key === "location") return value.length >= 2 && value.length <= 100 ? null : "nameShort";
  const numbers = value.match(/\d{2,3}/g) ?? [];
  return numbers.length >= 3 && value.length <= 100 ? null : "measurements";
}

function newUnusedPassword(): string {
  // Never disclose or persist this initial password. Approval issues a separate temporary password.
  return `${randomBytes(40).toString("base64url")}A9!`;
}

function stateExpiry(): string {
  return new Date(Date.now() + STATE_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

function referralFailureMessage(lang: TelegramLang): string {
  return {
    EN: "This invitation is no longer available. Ask the inviter for a new key, then open the new Telegram link.",
    RU: "Это приглашение больше недоступно. Попросите новое приглашение и откройте новую ссылку Telegram.",
    ES: "Esta invitación ya no está disponible. Pide una nueva clave y abre el nuevo enlace de Telegram.",
    PT: "Este convite não está mais disponível. Peça uma nova chave e abra o novo link do Telegram.",
  }[lang];
}

export async function getConversationState(telegramId: string): Promise<TelegramConversationState | null> {
  const db = getTelegramServiceClient();
  const { data, error } = await db.from("telegram_conversations").select("*").eq("telegram_id", telegramId).maybeSingle();
  if (error) {
    console.error("[telegram-webhook] conversation lookup failed", error.code ?? "unknown");
    throw new Error("Could not load the Telegram conversation state.");
  }
  if (!data) return null;
  if (data.expires_at && Date.parse(String(data.expires_at)) < Date.now()) {
    await deleteConversationState(telegramId);
    return null;
  }
  return data as TelegramConversationState;
}

export async function saveConversationState(state: TelegramConversationState): Promise<void> {
  const { error } = await getTelegramServiceClient().from("telegram_conversations").upsert({
    telegram_id: state.telegram_id,
    telegram_username: state.telegram_username,
    telegram_language: state.telegram_language,
    stage: state.stage,
    answers: state.answers,
    photo_urls: state.photo_urls,
    referral_code: state.referral_code ?? null,
    updated_at: new Date().toISOString(),
    expires_at: stateExpiry(),
  }, { onConflict: "telegram_id" });
  if (error) {
    console.error("[telegram-webhook] conversation save failed", error.code ?? "unknown");
    throw new Error("Could not save the Telegram conversation state.");
  }
}

export async function deleteConversationState(telegramId: string): Promise<void> {
  const { error } = await getTelegramServiceClient().from("telegram_conversations").delete().eq("telegram_id", telegramId);
  if (error) console.error("[telegram-webhook] conversation cleanup failed", error.code ?? "unknown");
}

async function lookupLinkedProfile(telegramId: string) {
  const { data, error } = await getTelegramServiceClient()
    .from("profiles")
    .select("id,status,kyc_level,banned_until,ban_permanent,full_name")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (error) throw new Error("Could not look up the linked VOYAGE profile.");
  return data;
}

function isBanned(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  const until = profile.banned_until ? Date.parse(profile.banned_until) : NaN;
  return Number.isFinite(until) && until > Date.now();
}

export async function sendWelcome(ctx: Context, lang: TelegramLang): Promise<void> {
  await ctx.reply(copy(lang).welcome, { reply_markup: mainMenu(lang) });
}

export async function beginRegistration(ctx: Context, lang: TelegramLang, referralCode: string | null = null): Promise<void> {
  const telegramUser = ctx.from;
  if (!telegramUser || !ctx.chat || ctx.chat.type !== "private") {
    await ctx.reply(copy(lang).onboarding.missingTg);
    return;
  }
  const telegramId = String(telegramUser.id);
  const linked = await lookupLinkedProfile(telegramId);
  const t = copy(lang);
  if (linked) {
    if (isBanned(linked)) await ctx.reply(t.alreadyBanned, { reply_markup: mainMenu(lang) });
    else if (linked.status === "approved" && Number(linked.kyc_level ?? 0) >= 1) await ctx.reply(t.alreadyApproved, { reply_markup: mainMenu(lang) });
    else if (linked.status === "rejected") await ctx.reply(t.alreadyRejected, { reply_markup: mainMenu(lang) });
    else await ctx.reply(t.alreadyPending, { reply_markup: mainMenu(lang) });
    return;
  }

  const state: TelegramConversationState = {
    telegram_id: telegramId,
    telegram_username: telegramUser.username ?? null,
    telegram_language: lang,
    stage: "email",
    answers: {},
    photo_urls: [],
    referral_code: referralCode,
    expires_at: stateExpiry(),
  };
  await saveConversationState(state);
  await ctx.reply(t.prompts.email);
}

async function finalizeRegistration(ctx: Context, state: TelegramConversationState): Promise<void> {
  const telegramId = state.telegram_id;
  const t = copy(state.telegram_language);
  if (state.photo_urls.length < MIN_PHOTOS) {
    await ctx.reply(interpolation(t.onboarding.tooFewPhotos, { count: state.photo_urls.length }));
    return;
  }
  const email = state.answers.email?.trim().toLowerCase();
  const fullName = state.answers.full_name?.trim();
  const birthDate = state.answers.birth_date;
  const location = state.answers.location?.trim();
  const measurements = state.answers.measurements?.trim();
  if (!email || !fullName || !birthDate || !location || !measurements) {
    await deleteConversationState(telegramId);
    await ctx.reply(t.onboarding.failedGeneric, { reply_markup: mainMenu(state.telegram_language) });
    return;
  }

  const db = getTelegramServiceClient();
  await saveConversationState({ ...state, stage: "submitting" });
  await ctx.reply(t.onboarding.saving);

  const { data: duplicate, error: duplicateError } = await db.from("profiles").select("id").eq("telegram_id", telegramId).maybeSingle();
  if (duplicateError) {
    await saveConversationState({ ...state, stage: "photos" });
    await ctx.reply(t.onboarding.failedGeneric, { reply_markup: mainMenu(state.telegram_language) });
    return;
  }
  if (duplicate) {
    await deleteConversationState(telegramId);
    await ctx.reply(t.onboarding.failedDuplicate, { reply_markup: mainMenu(state.telegram_language) });
    return;
  }

  const { data: authResult, error: authError } = await db.auth.admin.createUser({
    email,
    password: newUnusedPassword(),
    email_confirm: true,
    user_metadata: { name: fullName, full_name: fullName, telegram_id: telegramId },
  });
  if (authError || !authResult.user) {
    await saveConversationState({ ...state, stage: "photos" });
    const duplicateEmail = /already|registered|exists/i.test(authError?.message ?? "") || authError?.code === "email_exists";
    await ctx.reply(duplicateEmail ? t.onboarding.failedEmail : t.onboarding.failedGeneric, { reply_markup: mainMenu(state.telegram_language) });
    return;
  }

  const profile = {
    id: authResult.user.id,
    user_id: authResult.user.id,
    email,
    full_name: fullName,
    birth_date: birthDate,
    location,
    measurements,
    telegram_id: telegramId,
    telegram_username: state.telegram_username,
    telegram_language: state.telegram_language,
    photo_urls: state.photo_urls,
    status: "pending",
    role: "resident",
    segment: "working",
    level: 1,
    kyc_level: 0,
    reliability: 100,
    tour_points: 0,
    influence_index: 0,
    circle: "voyager",
    usdt_wallet: null,
    registration_source: state.referral_code ? "referral" : "telegram_bot",
    source_metadata: {
      telegram_id: telegramId,
      telegram_username: state.telegram_username,
      ...(state.referral_code ? { referral_code: state.referral_code, referral_channel: "telegram" } : {}),
    },
    temp_password: null,
    is_npc: false,
  };

  const { error: profileError } = await db.from("profiles").upsert(profile, { onConflict: "id" });
  if (profileError) {
    await db.auth.admin.deleteUser(authResult.user.id);
    await saveConversationState({ ...state, stage: "photos" });
    console.error("[telegram-webhook] profile creation failed", profileError.code ?? "unknown");
    await ctx.reply(t.onboarding.failedGeneric, { reply_markup: mainMenu(state.telegram_language) });
    return;
  }

  if (state.referral_code) {
    const { error: referralError } = await db.rpc("club_redeem_invite_from_telegram", {
      p_code: state.referral_code,
      p_guest_profile_id: authResult.user.id,
      p_telegram_id: telegramId,
    });
    if (referralError) {
      // Handle an ambiguous network timeout after a committed RPC: verify whether this
      // exact profile consumed this invite before rolling back Auth/profile creation.
      const { data: redemption } = await db.from("club_invites")
        .select("id,guest_id,status")
        .eq("code", state.referral_code)
        .maybeSingle();
      const committedDespiteError = redemption?.guest_id === authResult.user.id && redemption.status === "pending";
      if (!committedDespiteError) {
        await db.from("profiles").delete().eq("id", authResult.user.id);
        await db.auth.admin.deleteUser(authResult.user.id);
        await saveConversationState({ ...state, stage: "photos" });
        console.error("[telegram-webhook] referral redemption failed", referralError.code ?? "unknown");
        await ctx.reply(referralFailureMessage(state.telegram_language), { reply_markup: mainMenu(state.telegram_language) });
        return;
      }
      console.warn("[telegram-webhook] referral RPC returned an error after the invite was redeemed; continuing", { code: referralError.code ?? "unknown" });
    }
  }

  await deleteConversationState(telegramId);
  await notifyAdminsOfNewRegistration({
    eventKey: `telegram_registration:${authResult.user.id}`,
    source: state.referral_code ? "referral" : "telegram_bot",
    profileId: authResult.user.id,
    fullName,
    email,
    telegramId,
  });
  await ctx.reply(t.onboarding.done, { reply_markup: mainMenu(state.telegram_language) });
}

function normalizeDone(value: string): boolean {
  return ["done", "готово", "listo", "pronto", "готов", "hecho"].includes(value.trim().toLowerCase());
}

export async function handleRegistrationText(ctx: Context, textInput: string): Promise<boolean> {
  const telegramUser = ctx.from;
  if (!telegramUser || !ctx.chat || ctx.chat.type !== "private") return false;
  const telegramId = String(telegramUser.id);
  const state = await getConversationState(telegramId);
  if (!state) return false;

  const t = copy(state.telegram_language);
  const raw = textInput.trim();
  if (state.stage === "submitting") {
    await ctx.reply(t.onboarding.saving);
    return true;
  }
  if (state.stage === "photos") {
    if (!normalizeDone(raw)) {
      await ctx.reply(t.onboarding.sendPhoto);
      return true;
    }
    if (state.photo_urls.length < MIN_PHOTOS) {
      await ctx.reply(interpolation(t.onboarding.tooFewPhotos, { count: state.photo_urls.length }));
      return true;
    }
    await finalizeRegistration(ctx, state);
    return true;
  }

  const stage = state.stage as StepKey;
  const validationKey = validateStep(stage, raw);
  if (validationKey) {
    await ctx.reply(t.onboarding[validationKey] ?? t.onboarding.nameShort);
    return true;
  }

  const answers: RegistrationAnswers = { ...state.answers, [stage]: raw };
  const index = STEP_ORDER.indexOf(stage);
  const nextStep = STEP_ORDER[index + 1];
  const nextState: TelegramConversationState = { ...state, answers, stage: nextStep ?? "photos" };
  await saveConversationState(nextState);
  if (nextStep) await ctx.reply(t.prompts[nextStep]);
  else await ctx.reply(t.onboarding.portfolio);
  return true;
}

export async function handleRegistrationPhoto(ctx: Context, fileId: string): Promise<boolean> {
  const telegramUser = ctx.from;
  if (!telegramUser || !ctx.chat || ctx.chat.type !== "private") return false;
  const telegramId = String(telegramUser.id);
  const state = await getConversationState(telegramId);
  if (!state || state.stage !== "photos") return false;
  const t = copy(state.telegram_language);
  if (state.photo_urls.length >= MAX_PHOTOS) {
    await ctx.reply(t.onboarding.sendPhoto);
    return true;
  }

  await ctx.reply(interpolation(t.onboarding.uploading, { n: state.photo_urls.length + 1 }));
  try {
    const path = await uploadTelegramPhoto(ctx.api, fileId, telegramId);
    const photoUrls = [...state.photo_urls, path];
    const updated: TelegramConversationState = { ...state, photo_urls: photoUrls };
    if (photoUrls.length >= MAX_PHOTOS) {
      await saveConversationState(updated);
      await finalizeRegistration(ctx, updated);
    } else {
      await saveConversationState(updated);
      await ctx.reply(interpolation(t.onboarding.uploaded, { count: photoUrls.length }));
    }
  } catch (error) {
    console.error("[telegram-webhook] portfolio upload failed", error instanceof Error ? error.name : "unknown");
    await ctx.reply(t.onboarding.uploadFailed);
  }
  return true;
}

export async function cancelRegistration(ctx: Context): Promise<void> {
  const telegramId = ctx.from ? String(ctx.from.id) : null;
  const lang = telegramId
    ? await getPreferredTelegramLanguage(telegramId, ctx.from?.language_code)
    : "RU";
  if (telegramId) await deleteConversationState(telegramId);
  await ctx.reply(copy(lang).onboarding.cancel, { reply_markup: mainMenu(lang) });
}

export async function updateConversationLanguage(telegramId: string, lang: TelegramLang, username?: string | null): Promise<void> {
  await savePreferredTelegramLanguage(telegramId, lang, username);
}
