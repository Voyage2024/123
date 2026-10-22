import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { InlineKeyboard, type Context } from "grammy";
import { mainMenu } from "@/lib/server/telegram/copy";
import { sendApprovedCredentialsTelegram } from "@/lib/server/telegram/credentials";
import { deleteConversationState, getConversationState, saveConversationState } from "@/lib/server/telegram/onboarding";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import type { RegistrationAnswers, RegistrationStage, TelegramConversationState, TelegramLang } from "@/lib/server/telegram/types";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Партнёрская регистрация в боте
 *
 *   /start partner                     заявка без кода → модерация владельца
 *   /start partner_VYP-XXXX-XXXX       инвайт владельца → кабинет сразу
 *   /start ref_VYP-XXXX-XXXX           то же (если код вставили в ref-ссылку)
 *   /partner [VYP-XXXX-XXXX]           то же командой
 *
 * Анкета: 1) имя / агентство  2) направления и страны
 *         3) контакт и формат работы  4) email для входа на сайт.
 * Состояние живёт в telegram_conversations (stage partner_*), код инвайта —
 * в referral_code. Аккаунт создаёт только сервер: Auth-пользователь →
 * RPC voyage_provision_partner (роль manager) → логин и пароль в чат.
 * ──────────────────────────────────────────────────────────────────── */

export const PARTNER_INVITE_RE = /^VYP-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const STEPS = ["partner_name", "partner_regions", "partner_contact", "partner_email"] as const;
type PartnerStep = (typeof STEPS)[number];

const LIMITS: Record<PartnerStep, number> = {
  partner_name: 120,
  partner_regions: 500,
  partner_contact: 1000,
  partner_email: 320,
};

type PartnerCopy = {
  intro: string;
  introInvite: string;
  prompts: Record<PartnerStep, string>;
  tooShort: string;
  tooLong: string;
  invalidEmail: string;
  saving: string;
  pendingDone: string;
  invitedDone: string;
  alreadyPending: string;
  alreadyLinked: string;
  alreadyPartner: string;
  inviteInvalid: string;
  emailTaken: string;
  failed: string;
  provisionFailed: string;
  rejected: string;
  textOnly: string;
};

const COPY: Record<TelegramLang, PartnerCopy> = {
  RU: {
    intro: "🤝 Партнёрская регистрация VOYAGE.\nЧетыре коротких вопроса — и заявка уйдёт владельцу клуба на проверку. После одобрения бот пришлёт сюда логин и пароль от кабинета партнёра.\n/cancel — отменить.",
    introInvite: "🤝 Инвайт владельца принят.\nЧетыре коротких вопроса — и кабинет партнёра откроется сразу, логин и пароль придут в этот чат.\n/cancel — отменить.",
    prompts: {
      partner_name: "1/4 — Как вас представить? Имя или название агентства / проекта:",
      partner_regions: "2/4 — Основные направления и страны, с которыми вы работаете (например: ОАЭ, Турция, Европа):",
      partner_contact: "3/4 — Рабочий контакт для связи (Telegram, WhatsApp, телефон) и пара слов о формате работы:",
      partner_email: "4/4 — Email для входа в кабинет на сайте VOYAGE:",
    },
    tooShort: "Слишком коротко — нужно хотя бы 2 символа.",
    tooLong: "Слишком длинно — сократите до {{max}} символов.",
    invalidEmail: "Укажите корректный email, к которому у вас есть доступ.",
    saving: "Сохраняю анкету партнёра…",
    pendingDone: "✅ Заявка партнёра отправлена владельцу клуба. Как только её одобрят, бот пришлёт сюда логин и пароль от кабинета.",
    invitedDone: "✅ Кабинет партнёра создан. Логин и пароль — в сообщении выше.",
    alreadyPending: "Ваша партнёрская заявка уже на проверке у владельца клуба. Мы напишем сюда, как только будет решение.",
    alreadyLinked: "Этот Telegram уже привязан к профилю VOYAGE. Если нужен партнёрский доступ — напишите в поддержку.",
    alreadyPartner: "Ваш партнёрский кабинет VOYAGE уже открыт. Забыли пароль — отправьте /password.",
    inviteInvalid: "Партнёрский инвайт недействителен, истёк или уже использован. Попросите у владельца новый или отправьте заявку без кода: /partner",
    emailTaken: "Этот email уже зарегистрирован в VOYAGE. Укажите другой email:",
    failed: "Не удалось сохранить заявку. Попробуйте позже или напишите в поддержку.",
    provisionFailed: "Заявка сохранена, но кабинет не удалось открыть автоматически. Владелец клуба уже получил уведомление и откроет доступ вручную.",
    rejected: "К сожалению, партнёрская заявка VOYAGE отклонена. Если это ошибка — напишите в поддержку.",
    textOnly: "Сейчас идёт партнёрская анкета — ответьте текстом. /cancel — отменить.",
  },
  EN: {
    intro: "🤝 VOYAGE partner registration.\nFour short questions and your application goes to the club owner for review. Once approved, the bot will send your partner workspace login and password here.\n/cancel to stop.",
    introInvite: "🤝 Owner invitation accepted.\nFour short questions and your partner workspace opens right away; the login and password will arrive in this chat.\n/cancel to stop.",
    prompts: {
      partner_name: "1/4 — How should we introduce you? Your name or agency / project name:",
      partner_regions: "2/4 — Main destinations and countries you work with (for example: UAE, Turkey, Europe):",
      partner_contact: "3/4 — Work contact (Telegram, WhatsApp, phone) and a few words about how you work:",
      partner_email: "4/4 — Email you will use to sign in to the VOYAGE website:",
    },
    tooShort: "Too short — at least 2 characters, please.",
    tooLong: "Too long — please keep it under {{max}} characters.",
    invalidEmail: "Enter a valid email address you can access.",
    saving: "Saving your partner application…",
    pendingDone: "✅ Your partner application has been sent to the club owner. Once it is approved, the bot will send your workspace login and password here.",
    invitedDone: "✅ Your partner workspace is ready. The login and password are in the message above.",
    alreadyPending: "Your partner application is already with the club owner. We will message you here as soon as there is a decision.",
    alreadyLinked: "This Telegram account is already linked to a VOYAGE profile. Contact support if you need partner access.",
    alreadyPartner: "Your VOYAGE partner workspace is already open. Forgot the password? Send /password.",
    inviteInvalid: "This partner invitation is invalid, expired, or already used. Ask the owner for a new one or apply without a code: /partner",
    emailTaken: "This email is already registered with VOYAGE. Please enter another email:",
    failed: "Could not save the application. Please try again later or contact support.",
    provisionFailed: "Your application is saved, but the workspace could not be opened automatically. The club owner has been notified and will grant access manually.",
    rejected: "Unfortunately, your VOYAGE partner application was declined. If you think this is a mistake, contact support.",
    textOnly: "You are filling in the partner form — please reply with text. /cancel to stop.",
  },
  ES: {
    intro: "🤝 Registro de socios VOYAGE.\nCuatro preguntas cortas y tu solicitud irá al propietario del club para su revisión. Tras la aprobación, el bot te enviará aquí el usuario y la contraseña de tu panel de socio.\n/cancel para cancelar.",
    introInvite: "🤝 Invitación del propietario aceptada.\nCuatro preguntas cortas y tu panel de socio se abrirá de inmediato; el usuario y la contraseña llegarán a este chat.\n/cancel para cancelar.",
    prompts: {
      partner_name: "1/4 — ¿Cómo te presentamos? Tu nombre o el de tu agencia / proyecto:",
      partner_regions: "2/4 — Destinos y países principales con los que trabajas (por ejemplo: EAU, Turquía, Europa):",
      partner_contact: "3/4 — Contacto de trabajo (Telegram, WhatsApp, teléfono) y unas palabras sobre tu formato de trabajo:",
      partner_email: "4/4 — Email para entrar en tu panel en la web de VOYAGE:",
    },
    tooShort: "Demasiado corto: al menos 2 caracteres.",
    tooLong: "Demasiado largo: redúcelo a {{max}} caracteres.",
    invalidEmail: "Introduce un email válido al que tengas acceso.",
    saving: "Guardando tu solicitud de socio…",
    pendingDone: "✅ Tu solicitud de socio se envió al propietario del club. En cuanto se apruebe, el bot te enviará aquí el usuario y la contraseña.",
    invitedDone: "✅ Tu panel de socio está listo. El usuario y la contraseña están en el mensaje de arriba.",
    alreadyPending: "Tu solicitud de socio ya está en revisión con el propietario del club. Te escribiremos aquí cuando haya una decisión.",
    alreadyLinked: "Esta cuenta de Telegram ya está vinculada a un perfil de VOYAGE. Contacta con soporte si necesitas acceso de socio.",
    alreadyPartner: "Tu panel de socio de VOYAGE ya está abierto. ¿Olvidaste la contraseña? Envía /password.",
    inviteInvalid: "La invitación de socio no es válida, ha caducado o ya se usó. Pide una nueva al propietario o envía la solicitud sin código: /partner",
    emailTaken: "Este email ya está registrado en VOYAGE. Introduce otro email:",
    failed: "No se pudo guardar la solicitud. Inténtalo más tarde o contacta con soporte.",
    provisionFailed: "La solicitud está guardada, pero el panel no se pudo abrir automáticamente. El propietario del club ya está avisado y dará acceso manualmente.",
    rejected: "Lamentablemente, tu solicitud de socio de VOYAGE fue rechazada. Si crees que es un error, contacta con soporte.",
    textOnly: "Estás completando el formulario de socio: responde con texto. /cancel para cancelar.",
  },
  PT: {
    intro: "🤝 Cadastro de parceiros VOYAGE.\nQuatro perguntas curtas e sua solicitação vai para o proprietário do clube. Após a aprovação, o bot enviará aqui o login e a senha do seu painel de parceiro.\n/cancel para cancelar.",
    introInvite: "🤝 Convite do proprietário aceito.\nQuatro perguntas curtas e seu painel de parceiro abre na hora; o login e a senha chegarão neste chat.\n/cancel para cancelar.",
    prompts: {
      partner_name: "1/4 — Como devemos apresentá-lo? Seu nome ou o nome da agência / projeto:",
      partner_regions: "2/4 — Principais destinos e países com que você trabalha (por exemplo: EAU, Turquia, Europa):",
      partner_contact: "3/4 — Contato de trabalho (Telegram, WhatsApp, telefone) e algumas palavras sobre seu formato de trabalho:",
      partner_email: "4/4 — Email para entrar no painel no site VOYAGE:",
    },
    tooShort: "Muito curto — pelo menos 2 caracteres.",
    tooLong: "Muito longo — reduza para {{max}} caracteres.",
    invalidEmail: "Informe um email válido ao qual você tenha acesso.",
    saving: "Salvando sua solicitação de parceiro…",
    pendingDone: "✅ Sua solicitação de parceiro foi enviada ao proprietário do clube. Assim que for aprovada, o bot enviará aqui o login e a senha.",
    invitedDone: "✅ Seu painel de parceiro está pronto. O login e a senha estão na mensagem acima.",
    alreadyPending: "Sua solicitação de parceiro já está em análise com o proprietário do clube. Avisaremos aqui assim que houver uma decisão.",
    alreadyLinked: "Esta conta do Telegram já está vinculada a um perfil VOYAGE. Fale com o suporte se precisar de acesso de parceiro.",
    alreadyPartner: "Seu painel de parceiro VOYAGE já está aberto. Esqueceu a senha? Envie /password.",
    inviteInvalid: "O convite de parceiro é inválido, expirou ou já foi usado. Peça um novo ao proprietário ou envie a solicitação sem código: /partner",
    emailTaken: "Este email já está registrado no VOYAGE. Informe outro email:",
    failed: "Não foi possível salvar a solicitação. Tente mais tarde ou fale com o suporte.",
    provisionFailed: "A solicitação foi salva, mas o painel não pôde ser aberto automaticamente. O proprietário do clube já foi avisado e liberará o acesso manualmente.",
    rejected: "Infelizmente, sua solicitação de parceiro VOYAGE foi recusada. Se achar que é um erro, fale com o suporte.",
    textOnly: "Você está preenchendo o formulário de parceiro — responda com texto. /cancel para cancelar.",
  },
};

export function partnerCopy(lang: TelegramLang): PartnerCopy {
  return COPY[lang];
}

export function isPartnerStage(stage: RegistrationStage | string | null | undefined): boolean {
  return typeof stage === "string" && stage.startsWith("partner_");
}

/** Текущий вопрос анкеты — для повторного /start или /partner посреди диалога. */
export function partnerPromptFor(state: TelegramConversationState): string {
  const t = COPY[state.telegram_language];
  if (state.stage === "partner_submitting") return t.saving;
  return t.prompts[(STEPS as readonly string[]).includes(state.stage) ? (state.stage as PartnerStep) : "partner_name"];
}

/** Разбор deep link: partner | partner_<код> | ref_VYP-…; null — это не партнёрская ссылка. */
export function parsePartnerPayload(payload: string): { code: string | null } | null {
  const raw = payload.trim();
  if (/^partner$/i.test(raw)) return { code: null };
  const match = /^(?:partner_|ref_)(VYP-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/i.exec(raw);
  if (match) return { code: match[1].toUpperCase() };
  return null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

function cleanAnswer(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim();
}

function stateExpiry(): string {
  return new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
}

function newPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
  return Array.from({ length: 20 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
}

/* ══════════════════════════════════════════════════════════════════
 * Диалог в боте
 * ══════════════════════════════════════════════════════════════════ */

/** Старт партнёрской анкеты. inviteCode — VYP-код владельца или null (модерация). */
export async function beginPartnerRegistration(ctx: Context, lang: TelegramLang, inviteCode: string | null): Promise<void> {
  const from = ctx.from;
  if (!from || !ctx.chat || ctx.chat.type !== "private") return;
  const t = COPY[lang];
  const telegramId = String(from.id);
  const db = getTelegramServiceClient();

  const { data: linked, error: linkedError } = await db.from("profiles")
    .select("id,role")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (linkedError) {
    console.error("[partner-registration] linked profile lookup failed", linkedError.code ?? "unknown");
    await ctx.reply(t.failed, { reply_markup: mainMenu(lang) });
    return;
  }
  if (linked) {
    await ctx.reply(linked.role === "manager" ? t.alreadyPartner : t.alreadyLinked, { reply_markup: mainMenu(lang) });
    return;
  }

  const { data: pending } = await db.from("partner_applications")
    .select("id")
    .eq("telegram_id", telegramId)
    .in("status", ["pending", "provisioning"])
    .maybeSingle();
  if (pending) {
    await ctx.reply(t.alreadyPending, { reply_markup: mainMenu(lang) });
    return;
  }

  const code = inviteCode?.trim().toUpperCase() || null;
  if (code) {
    const { data: check, error } = await db.rpc("voyage_check_partner_invite", { p_code: code });
    if (error || check !== "ok") {
      if (error) console.error("[partner-registration] invite check failed", error.code ?? "unknown");
      await ctx.reply(t.inviteInvalid, { reply_markup: mainMenu(lang) });
      return;
    }
  }

  const state: TelegramConversationState = {
    telegram_id: telegramId,
    telegram_username: from.username ?? null,
    telegram_language: lang,
    stage: "partner_name",
    answers: {},
    photo_urls: [],
    referral_code: code,
    expires_at: stateExpiry(),
  };
  await saveConversationState(state);
  await ctx.reply(code ? t.introInvite : t.intro);
  await ctx.reply(t.prompts.partner_name);
}

/** Текстовый ответ в партнёрской анкете. false — сообщение не относится к анкете. */
export async function handlePartnerRegistrationText(ctx: Context, textInput: string): Promise<boolean> {
  if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return false;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isPartnerStage(state.stage)) return false;

  const t = COPY[state.telegram_language];
  if (state.stage === "partner_submitting") {
    await ctx.reply(t.saving);
    return true;
  }

  const step = state.stage as PartnerStep;
  const value = cleanAnswer(textInput);
  if (value.startsWith("/")) {
    await ctx.reply(t.prompts[step]);
    return true;
  }
  if (step === "partner_email") {
    const email = value.toLowerCase();
    if (email.length > LIMITS.partner_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await ctx.reply(t.invalidEmail);
      return true;
    }
    const answers: RegistrationAnswers = { ...state.answers, partner_email: email };
    await finalizePartnerRegistration(ctx, { ...state, answers });
    return true;
  }
  if (value.length < 2) {
    await ctx.reply(t.tooShort);
    return true;
  }
  if (value.length > LIMITS[step]) {
    await ctx.reply(t.tooLong.replace("{{max}}", String(LIMITS[step])));
    return true;
  }

  const answers: RegistrationAnswers = { ...state.answers, [step]: value };
  const next = STEPS[STEPS.indexOf(step) + 1] ?? "partner_email";
  await saveConversationState({ ...state, answers, stage: next });
  await ctx.reply(t.prompts[next]);
  return true;
}

/** Фото посреди партнёрской анкеты — просим ответить текстом. */
export async function handlePartnerRegistrationPhoto(ctx: Context): Promise<boolean> {
  if (!ctx.from) return false;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isPartnerStage(state.stage)) return false;
  await ctx.reply(COPY[state.telegram_language].textOnly);
  return true;
}

async function finalizePartnerRegistration(ctx: Context, state: TelegramConversationState): Promise<void> {
  const lang = state.telegram_language;
  const t = COPY[lang];
  const a = state.answers;
  if (!a.partner_name || !a.partner_regions || !a.partner_contact || !a.partner_email) {
    await saveConversationState({ ...state, stage: "partner_name" });
    await ctx.reply(t.prompts.partner_name);
    return;
  }

  await saveConversationState({ ...state, stage: "partner_submitting" });
  await ctx.reply(t.saving);

  const db = getTelegramServiceClient();
  const { data, error } = await db.rpc("voyage_submit_partner_application", {
    p_telegram_id: state.telegram_id,
    p_telegram_username: state.telegram_username,
    p_language: lang,
    p_display_name: a.partner_name,
    p_regions: a.partner_regions,
    p_contact: a.partner_contact,
    p_email: a.partner_email,
    p_invite_code: state.referral_code ?? null,
  });
  if (error) {
    console.error("[partner-registration] submit failed", error.code ?? "unknown");
    await saveConversationState({ ...state, stage: "partner_email" });
    await ctx.reply(t.failed, { reply_markup: mainMenu(lang) });
    return;
  }

  const result = (data ?? {}) as { ok?: boolean; reason?: string; application_id?: string; invited?: boolean };
  if (!result.ok) {
    if (result.reason === "email_taken") {
      await saveConversationState({ ...state, stage: "partner_email" });
      await ctx.reply(t.emailTaken);
      return;
    }
    await deleteConversationState(state.telegram_id);
    const message = result.reason === "already_pending" ? t.alreadyPending
      : result.reason === "telegram_linked" ? t.alreadyLinked
      : result.reason === "invite_invalid" ? t.inviteInvalid
      : t.failed;
    await ctx.reply(message, { reply_markup: mainMenu(lang) });
    return;
  }

  await deleteConversationState(state.telegram_id);
  const applicationId = String(result.application_id);

  if (!result.invited) {
    await ctx.reply(t.pendingDone, { reply_markup: mainMenu(lang) });
    await notifyAdminsOfPartnerApplication(applicationId, "pending");
    return;
  }

  const provisioned = await provisionPartnerAccount(applicationId, null, { alreadyClaimed: true });
  if (provisioned.ok) {
    if (provisioned.delivered) await ctx.reply(t.invitedDone);
    await notifyAdminsOfPartnerApplication(applicationId, "invited");
  } else {
    await ctx.reply(t.provisionFailed, { reply_markup: mainMenu(lang) });
    await notifyAdminsOfPartnerApplication(applicationId, "invited_failed");
  }
}

/* ══════════════════════════════════════════════════════════════════
 * Открытие кабинета и отказ — общие для бота и админки
 * ══════════════════════════════════════════════════════════════════ */

type ApplicationRow = {
  id: string;
  telegram_id: string;
  telegram_username: string | null;
  language: string;
  display_name: string;
  regions: string;
  contact: string;
  email: string;
  invite_code: string | null;
  status: string;
  profile_id: string | null;
};

export type PartnerProvisionResult =
  | { ok: true; profileId: string; delivered: boolean }
  | { ok: false; error: "not_pending" | "email_exists" | "auth_failed" | "provision_failed" };

function langOf(value: unknown): TelegramLang {
  return value === "EN" || value === "ES" || value === "PT" ? value : "RU";
}

/**
 * Создаёт Auth-пользователя, делает профиль партнёром (manager) и отправляет
 * логин и пароль в Telegram заявителя. actorId — кто одобрил (null — инвайт).
 */
export async function provisionPartnerAccount(
  applicationId: string,
  actorId: string | null,
  options: { alreadyClaimed?: boolean } = {},
): Promise<PartnerProvisionResult> {
  const db = getTelegramServiceClient();
  let app: ApplicationRow | null = null;

  if (options.alreadyClaimed) {
    const { data } = await db.from("partner_applications").select("*").eq("id", applicationId).eq("status", "provisioning").maybeSingle();
    app = (data as ApplicationRow | null) ?? null;
  } else {
    const { data, error } = await db.rpc("voyage_claim_partner_application", { p_id: applicationId, p_actor: actorId });
    if (error) console.error("[partner-registration] claim failed", error.code ?? "unknown");
    const row = (Array.isArray(data) ? data[0] : data) as ApplicationRow | null;
    app = row?.id ? row : null;
  }
  if (!app) return { ok: false, error: "not_pending" };

  const release = async (note: string) => {
    const { error } = await db.rpc("voyage_release_partner_application", { p_id: app!.id, p_note: note });
    if (error) console.error("[partner-registration] release failed", error.code ?? "unknown");
  };

  const password = newPassword();
  const deliveryId = randomUUID();
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: app.email,
    password,
    email_confirm: true,
    user_metadata: { name: app.display_name, full_name: app.display_name, telegram_id: app.telegram_id, created_by: "partner_telegram_registration" },
  });
  if (createError || !created.user) {
    const duplicate = /already|registered|exists|duplicate/i.test(createError?.message ?? "") || createError?.code === "email_exists";
    console.error("[partner-registration] auth user creation failed", createError?.code ?? "unknown");
    await release(duplicate ? "email_exists" : "auth_failed");
    return { ok: false, error: duplicate ? "email_exists" : "auth_failed" };
  }

  const { error: provisionError } = await db.rpc("voyage_provision_partner", {
    p_application: app.id,
    p_profile: created.user.id,
    p_delivery_id: deliveryId,
    p_actor: actorId,
  });
  if (provisionError) {
    console.error("[partner-registration] provision failed", provisionError.code ?? "unknown");
    await db.auth.admin.deleteUser(created.user.id);
    await release("provision_failed");
    return { ok: false, error: "provision_failed" };
  }

  let delivered = false;
  try {
    const result = await sendApprovedCredentialsTelegram({
      deliveryId,
      profileId: created.user.id,
      telegramId: app.telegram_id,
      login: app.email,
      password,
      fullName: app.display_name,
      audience: "partner",
    });
    delivered = result.sent;
    if (!result.sent) console.warn("[partner-registration] credentials delivery failed", result.error);
  } catch (error) {
    console.error("[partner-registration] credentials delivery threw", error instanceof Error ? error.name : "unknown");
  }
  return { ok: true, profileId: created.user.id, delivered };
}

/** Отказ: заявка → rejected, заявителю — короткое сообщение на его языке. */
export async function rejectPartnerApplication(applicationId: string, actorId: string | null, note?: string | null): Promise<boolean> {
  const db = getTelegramServiceClient();
  const { data, error } = await db.from("partner_applications")
    .update({
      status: "rejected",
      decided_by: actorId,
      decided_at: new Date().toISOString(),
      decision_note: note?.trim().slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select("telegram_id,language")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[partner-registration] reject failed", error.code ?? "unknown");
    return false;
  }
  try {
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    await getVoyageTelegramBot().api.sendMessage(String(data.telegram_id), COPY[langOf(data.language)].rejected);
  } catch (sendError) {
    console.error("[partner-registration] rejection message failed", sendError instanceof Error ? sendError.name : "unknown");
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════════
 * Уведомление владельцу и кнопки «Одобрить / Отклонить»
 * ══════════════════════════════════════════════════════════════════ */

type NoticeMode = "pending" | "invited" | "invited_failed";

const ADMIN_COPY: Record<TelegramLang, {
  title: string; mode: Record<NoticeMode, string>; name: string; regions: string; contact: string; email: string;
  telegram: string; invite: string; approve: string; reject: string; open: string;
  approved: string; approvedNoDelivery: string; rejected: string; stale: string; forbidden: string; emailExists: string; failed: string;
}> = {
  RU: {
    title: "🤝 Новый партнёр VOYAGE",
    mode: { pending: "Ждёт вашего решения", invited: "Зарегистрирован по инвайту — кабинет открыт", invited_failed: "Инвайт принят, но кабинет не открылся — одобрите вручную" },
    name: "Имя / агентство", regions: "Направления", contact: "Контакт и формат", email: "Email", telegram: "Telegram", invite: "Инвайт",
    approve: "✅ Одобрить", reject: "✖️ Отклонить", open: "Открыть в админке",
    approved: "✅ Одобрено: кабинет открыт, доступы отправлены партнёру.", approvedNoDelivery: "✅ Кабинет открыт, но доступы не дошли в Telegram. Выдайте ссылку восстановления в «Ролях».",
    rejected: "✖️ Заявка отклонена, партнёр получил уведомление.", stale: "Заявка уже обработана.", forbidden: "Решать по заявкам партнёров могут только owner и admin.",
    emailExists: "Этот email уже занят другим аккаунтом — кабинет не создан.", failed: "Не удалось открыть кабинет. Попробуйте ещё раз из админки.",
  },
  EN: {
    title: "🤝 New VOYAGE partner",
    mode: { pending: "Waiting for your decision", invited: "Registered with an invitation — workspace open", invited_failed: "Invitation accepted but the workspace did not open — approve manually" },
    name: "Name / agency", regions: "Destinations", contact: "Contact & format", email: "Email", telegram: "Telegram", invite: "Invitation",
    approve: "✅ Approve", reject: "✖️ Decline", open: "Open in admin",
    approved: "✅ Approved: workspace open, credentials sent to the partner.", approvedNoDelivery: "✅ Workspace open, but Telegram delivery failed. Issue a recovery link in Roles.",
    rejected: "✖️ Application declined, the partner has been notified.", stale: "This application has already been handled.", forbidden: "Only owner and admin can decide on partner applications.",
    emailExists: "This email belongs to another account — workspace not created.", failed: "Could not open the workspace. Try again from the admin panel.",
  },
  ES: {
    title: "🤝 Nuevo socio de VOYAGE",
    mode: { pending: "Espera tu decisión", invited: "Registrado con invitación — panel abierto", invited_failed: "Invitación aceptada, pero el panel no se abrió — apruébalo manualmente" },
    name: "Nombre / agencia", regions: "Destinos", contact: "Contacto y formato", email: "Email", telegram: "Telegram", invite: "Invitación",
    approve: "✅ Aprobar", reject: "✖️ Rechazar", open: "Abrir en el panel",
    approved: "✅ Aprobado: panel abierto, credenciales enviadas al socio.", approvedNoDelivery: "✅ Panel abierto, pero el envío por Telegram falló. Emite un enlace de recuperación en Roles.",
    rejected: "✖️ Solicitud rechazada, el socio ha sido avisado.", stale: "Esta solicitud ya fue procesada.", forbidden: "Solo owner y admin pueden decidir sobre socios.",
    emailExists: "Este email pertenece a otra cuenta — no se creó el panel.", failed: "No se pudo abrir el panel. Inténtalo de nuevo desde el panel de administración.",
  },
  PT: {
    title: "🤝 Novo parceiro VOYAGE",
    mode: { pending: "Aguardando sua decisão", invited: "Cadastrado com convite — painel aberto", invited_failed: "Convite aceito, mas o painel não abriu — aprove manualmente" },
    name: "Nome / agência", regions: "Destinos", contact: "Contato e formato", email: "Email", telegram: "Telegram", invite: "Convite",
    approve: "✅ Aprovar", reject: "✖️ Recusar", open: "Abrir no admin",
    approved: "✅ Aprovado: painel aberto, credenciais enviadas ao parceiro.", approvedNoDelivery: "✅ Painel aberto, mas o envio pelo Telegram falhou. Gere um link de recuperação em Funções.",
    rejected: "✖️ Solicitação recusada, o parceiro foi avisado.", stale: "Esta solicitação já foi processada.", forbidden: "Somente owner e admin podem decidir sobre parceiros.",
    emailExists: "Este email pertence a outra conta — painel não criado.", failed: "Não foi possível abrir o painel. Tente novamente pelo admin.",
  },
};

/** Получатели: owner/admin с включёнными уведомлениями, иначе owner с привязанным Telegram. */
async function adminRecipients(): Promise<Map<string, TelegramLang>> {
  const db = getTelegramServiceClient();
  const recipients = new Map<string, TelegramLang>();
  const { data: settings } = await db.from("admin_settings")
    .select("admin_id,notifications_tg_id,notify_new_applications,notification_language")
    .eq("notify_new_applications", true)
    .not("notifications_tg_id", "is", null);
  const configured = (settings ?? []).filter((row) => /^-?[0-9]{5,20}$/.test(String(row.notifications_tg_id ?? "")));
  if (configured.length) {
    const { data: staff } = await db.from("profiles").select("id,role").in("id", configured.map((row) => row.admin_id));
    const allowed = new Set((staff ?? []).filter((row) => row.role === "owner" || row.role === "admin").map((row) => row.id));
    for (const row of configured) {
      if (allowed.has(row.admin_id) && !recipients.has(String(row.notifications_tg_id))) {
        recipients.set(String(row.notifications_tg_id), langOf(row.notification_language));
      }
    }
  }
  if (!recipients.size) {
    const { data: owners } = await db.from("profiles").select("telegram_id,telegram_language").eq("role", "owner").not("telegram_id", "is", null);
    for (const owner of owners ?? []) recipients.set(String(owner.telegram_id), langOf(owner.telegram_language));
  }
  return recipients;
}

function adminUrl(): string | null {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://voyage-models.com").trim();
  try {
    const url = new URL("/admin/invites#partners", base.endsWith("/") ? base : `${base}/`);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function notifyAdminsOfPartnerApplication(applicationId: string, mode: NoticeMode): Promise<void> {
  try {
    const db = getTelegramServiceClient();
    const { data: app } = await db.from("partner_applications").select("*").eq("id", applicationId).maybeSingle();
    if (!app) return;
    const recipients = await adminRecipients();
    if (!recipients.size) {
      console.info("[partner-registration] no admin recipients configured");
      return;
    }
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    const bot = getVoyageTelegramBot();
    const eventKey = `partner_application:${applicationId}:${mode}`;
    const url = adminUrl();

    for (const [chatId, lang] of recipients) {
      const claim = await db.rpc("claim_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: chatId });
      if (claim.error || claim.data !== true) continue;
      const t = ADMIN_COPY[lang];
      const username = app.telegram_username ? `@${app.telegram_username} · ` : "";
      const lines = [
        `<b>${t.title}</b>`,
        `<i>${escapeHtml(t.mode[mode])}</i>`,
        "",
        `${t.name}: <b>${escapeHtml(app.display_name)}</b>`,
        `${t.regions}: ${escapeHtml(app.regions)}`,
        `${t.contact}: ${escapeHtml(app.contact)}`,
        `${t.email}: ${escapeHtml(app.email)}`,
        `${t.telegram}: ${escapeHtml(username)}<code>${escapeHtml(app.telegram_id)}</code>`,
      ];
      if (app.invite_code) lines.push(`${t.invite}: <code>${escapeHtml(app.invite_code)}</code>`);

      const keyboard = new InlineKeyboard();
      if (mode !== "invited") {
        keyboard.text(t.approve, `padm:ok:${app.id}`).text(t.reject, `padm:no:${app.id}`);
        if (url) keyboard.row();
      }
      if (url) keyboard.url(t.open, url);
      try {
        await bot.api.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML", reply_markup: keyboard, link_preview_options: { is_disabled: true } });
        await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: chatId, p_status: "sent", p_error: null });
      } catch (error) {
        const code = error && typeof error === "object" && "error_code" in error ? String((error as { error_code: unknown }).error_code) : "send_failed";
        await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: chatId, p_status: "failed", p_error: code });
      }
    }
  } catch (error) {
    console.error("[partner-registration] admin notification failed", error instanceof Error ? error.name : "unknown");
  }
}

/** Нажатие «Одобрить / Отклонить» в уведомлении. Права перепроверяются по базе. */
export async function handlePartnerAdminCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const match = /^padm:(ok|no):([0-9a-f-]{36})$/i.exec(data);
  if (!match || !ctx.from) {
    await ctx.answerCallbackQuery();
    return;
  }
  const db = getTelegramServiceClient();
  const telegramId = String(ctx.from.id);

  // Кто нажал: owner/admin, чей Telegram привязан к профилю или указан для уведомлений.
  const { data: byProfile } = await db.from("profiles")
    .select("id,role,telegram_language")
    .eq("telegram_id", telegramId)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  let actorId: string | null = byProfile?.id ?? null;
  let lang: TelegramLang = langOf(byProfile?.telegram_language);
  if (!actorId) {
    const { data: bySettings } = await db.from("admin_settings")
      .select("admin_id,notification_language")
      .eq("notifications_tg_id", telegramId);
    const ids = (bySettings ?? []).map((row) => row.admin_id);
    if (ids.length) {
      const { data: staff } = await db.from("profiles").select("id,role").in("id", ids).in("role", ["owner", "admin"]).limit(1);
      if (staff?.[0]) {
        actorId = staff[0].id;
        lang = langOf(bySettings?.find((row) => row.admin_id === actorId)?.notification_language);
      }
    }
  }
  const t = ADMIN_COPY[lang];
  if (!actorId) {
    await ctx.answerCallbackQuery({ text: t.forbidden, show_alert: true });
    return;
  }

  const [, action, applicationId] = match;
  let message: string;
  if (action === "ok") {
    const result = await provisionPartnerAccount(applicationId, actorId);
    message = result.ok
      ? (result.delivered ? t.approved : t.approvedNoDelivery)
      : result.error === "not_pending" ? t.stale
      : result.error === "email_exists" ? t.emailExists
      : t.failed;
  } else {
    message = (await rejectPartnerApplication(applicationId, actorId)) ? t.rejected : t.stale;
  }

  await ctx.answerCallbackQuery({ text: message.slice(0, 190) });
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch {
    // сообщение могло быть уже изменено другим админом
  }
  await ctx.reply(message);
}
