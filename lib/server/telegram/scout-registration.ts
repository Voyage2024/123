import "server-only";

import { randomInt, randomUUID } from "node:crypto";
import { InlineKeyboard, type Context } from "grammy";
import { mainMenu } from "@/lib/server/telegram/copy";
import { sendApprovedCredentialsTelegram } from "@/lib/server/telegram/credentials";
import { deleteConversationState, getConversationState, saveConversationState } from "@/lib/server/telegram/onboarding";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { siteLoginKeyboard } from "@/lib/server/telegram/site-login";
import type { RegistrationAnswers, TelegramConversationState, TelegramLang } from "@/lib/server/telegram/types";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Регистрация скаута в боте
 *
 *   /scout [VYS-…], /start scout, /start sc_VYS-XXXX-XXXX (ссылка owner
 *   или менеджера).
 *
 * Анкета: 1) имя или псевдоним  2) телефон / WhatsApp  3) пара слов о себе
 * (можно пропустить).
 *
 * Ссылка owner → кабинет открывается сразу, логин и пароль приходят сюда.
 * Ссылка менеджера или заявка без ссылки → owner решает кнопками
 * «Одобрить / Отклонить» в рабочем чате (admin — нет).
 * Аккаунт: sc-<ник>@<домен>, роль scout, кабинет /scout.
 * ──────────────────────────────────────────────────────────────────── */

export const SCOUT_RECRUIT_RE = /^VYS-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const SCOUT_REG_CALLBACK_RE = /^screg:[a-z]+(:[a-z0-9]+)?$/i;
export const SCOUT_ADMIN_CALLBACK_RE = /^sadm:(ok|no):[0-9a-f-]{36}$/i;

const STEPS = ["scout_name", "scout_phone", "scout_about"] as const;
type ScoutStep = (typeof STEPS)[number];
const LIMITS = { scout_name: 60, scout_phone: 120, scout_about: 1000 } as const;

type Copy = {
  intro: string;
  introInvite: (issuer: string, auto: boolean) => string;
  prompts: Record<ScoutStep, string>;
  skip: string;
  phoneBad: string;
  tooShort: string;
  tooLong: (max: number) => string;
  saving: string;
  done: string;
  doneAuto: string;
  doneAutoNoDelivery: string;
  alreadyPending: string;
  alreadyLinked: string;
  alreadyScout: string;
  inviteInvalid: string;
  failed: string;
  rejected: string;
  textOnly: string;
};

const COPY: Record<TelegramLang, Copy> = {
  RU: {
    intro: "💎 Регистрация скаута VOYAGE.\nСкаут приводит моделей по личной ссылке и получает бонус с каждого их тура — у любого менеджера, без срока. Три коротких шага, затем заявку рассмотрит owner.\n/cancel — отменить.",
    introInvite: (m, auto) => auto
      ? `💎 Приглашение от «${m}» принято.\nТри коротких шага — и кабинет скаута откроется сразу.\n/cancel — отменить.`
      : `💎 Приглашение от «${m}» принято.\nТри коротких шага — и заявка уйдёт owner на одобрение.\n/cancel — отменить.`,
    prompts: {
      scout_name: "1/3 — Имя или рабочий псевдоним (так вас увидят модели в приглашении):",
      scout_phone: "2/3 — Телефон / WhatsApp для связи с owner (с кодом страны, например +971 50 123 4567):",
      scout_about: "3/3 — Пара слов о себе: откуда модели, соцсети, опыт (можно пропустить):",
    },
    skip: "Пропустить",
    phoneBad: "Не похоже на номер. Пришлите телефон с кодом страны, например +971 50 123 4567.",
    tooShort: "Слишком коротко — нужно хотя бы 2 символа.",
    tooLong: (m) => `Слишком длинно — сократите до ${m} символов.`,
    saving: "Отправляю заявку…",
    done: "✅ Заявка скаута отправлена owner. Как только её одобрят, бот пришлёт сюда логин и пароль от кабинета.",
    doneAuto: "✅ Кабинет скаута открыт — логин и пароль выше. В кабинете: ссылки для моделей, их прогресс и ваши бонусы.",
    doneAutoNoDelivery: "✅ Кабинет скаута открыт, но доступ не дошёл. Отправьте /password — бот пришлёт новый пароль.",
    alreadyPending: "Ваша заявка скаута уже на рассмотрении. Мы напишем сюда, как только будет решение.",
    alreadyLinked: "Этот Telegram уже привязан к профилю VOYAGE. Если нужен доступ скаута — напишите в поддержку.",
    alreadyScout: "Ваш кабинет скаута уже открыт. Забыли пароль — отправьте /password.",
    inviteInvalid: "Ссылка скаута недействительна, истекла или исчерпана. Попросите новую или отправьте /scout, чтобы подать заявку.",
    failed: "Не удалось сохранить заявку. Попробуйте позже или напишите в поддержку.",
    rejected: "К сожалению, заявка скаута VOYAGE отклонена.",
    textOnly: "Сейчас идёт анкета скаута — ответьте текстом. /cancel — отменить.",
  },
  EN: {
    intro: "💎 VOYAGE scout registration.\nA scout brings models with a personal link and earns a bonus from each of their tours, with any manager and with no time limit. Three short steps, then the owner reviews your application.\n/cancel to stop.",
    introInvite: (m, auto) => auto
      ? `💎 Invitation from “${m}” accepted.\nThree short steps and your scout desk opens right away.\n/cancel to stop.`
      : `💎 Invitation from “${m}” accepted.\nThree short steps and your application goes to the owner.\n/cancel to stop.`,
    prompts: {
      scout_name: "1/3 — Your name or work alias (models will see it in your invite):",
      scout_phone: "2/3 — Phone / WhatsApp for the owner to reach you (with country code, e.g. +971 50 123 4567):",
      scout_about: "3/3 — A few words about you: where your models come from, socials, experience (optional):",
    },
    skip: "Skip",
    phoneBad: "That doesn’t look like a phone number. Send it with the country code, e.g. +971 50 123 4567.",
    tooShort: "Too short — at least 2 characters, please.",
    tooLong: (m) => `Too long — please keep it under ${m} characters.`,
    saving: "Sending your application…",
    done: "✅ Scout application sent to the owner. Once approved, the bot will send your login and password here.",
    doneAuto: "✅ Your scout desk is open — login and password above. Inside: links for models, their progress and your bonuses.",
    doneAutoNoDelivery: "✅ Your scout desk is open, but the access message failed. Send /password to get a new password.",
    alreadyPending: "Your scout application is already under review. We’ll message you here once there is a decision.",
    alreadyLinked: "This Telegram account is already linked to a VOYAGE profile. Contact support if you need scout access.",
    alreadyScout: "Your scout desk is already open. Forgot the password? Send /password.",
    inviteInvalid: "This scout link is invalid, expired or used up. Ask for a new one or send /scout to apply.",
    failed: "Could not save the application. Please try again later or contact support.",
    rejected: "Unfortunately, your VOYAGE scout application was declined.",
    textOnly: "You are filling in the scout form — please reply with text. /cancel to stop.",
  },
  ES: {
    intro: "💎 Registro de scout VOYAGE.\nUn scout trae modelos con su enlace personal y gana un bono por cada tour de ellas, con cualquier gerente y sin plazo. Tres pasos cortos; luego el owner revisa la solicitud.\n/cancel para cancelar.",
    introInvite: (m, auto) => auto
      ? `💎 Invitación de «${m}» aceptada.\nTres pasos cortos y tu panel de scout se abre al instante.\n/cancel para cancelar.`
      : `💎 Invitación de «${m}» aceptada.\nTres pasos cortos y la solicitud irá al owner.\n/cancel para cancelar.`,
    prompts: {
      scout_name: "1/3 — Tu nombre o alias de trabajo (las modelos lo verán en la invitación):",
      scout_phone: "2/3 — Teléfono / WhatsApp con prefijo de país (p. ej. +971 50 123 4567):",
      scout_about: "3/3 — Unas palabras sobre ti: de dónde son tus modelos, redes, experiencia (opcional):",
    },
    skip: "Omitir",
    phoneBad: "No parece un número. Envíalo con prefijo de país, p. ej. +971 50 123 4567.",
    tooShort: "Demasiado corto: al menos 2 caracteres.",
    tooLong: (m) => `Demasiado largo: redúcelo a ${m} caracteres.`,
    saving: "Enviando la solicitud…",
    done: "✅ Solicitud de scout enviada al owner. Tras la aprobación, el bot te enviará aquí el acceso.",
    doneAuto: "✅ Tu panel de scout está abierto: usuario y contraseña arriba.",
    doneAutoNoDelivery: "✅ Tu panel está abierto, pero el acceso no llegó. Envía /password para obtener una contraseña nueva.",
    alreadyPending: "Tu solicitud de scout ya está en revisión.",
    alreadyLinked: "Esta cuenta de Telegram ya está vinculada a un perfil de VOYAGE.",
    alreadyScout: "Tu panel de scout ya está abierto. ¿Olvidaste la contraseña? Envía /password.",
    inviteInvalid: "El enlace de scout no es válido o caducó. Pide uno nuevo o envía /scout para solicitarlo.",
    failed: "No se pudo guardar la solicitud. Inténtalo más tarde.",
    rejected: "Lamentablemente, tu solicitud de scout de VOYAGE fue rechazada.",
    textOnly: "Estás completando el formulario de scout: responde con texto. /cancel para cancelar.",
  },
  PT: {
    intro: "💎 Cadastro de scout VOYAGE.\nO scout traz modelos com seu link pessoal e ganha um bônus por cada tour delas, com qualquer gerente e sem prazo. Três passos curtos; depois o owner analisa a solicitação.\n/cancel para cancelar.",
    introInvite: (m, auto) => auto
      ? `💎 Convite de «${m}» aceito.\nTrês passos curtos e seu painel de scout abre na hora.\n/cancel para cancelar.`
      : `💎 Convite de «${m}» aceito.\nTrês passos curtos e a solicitação vai para o owner.\n/cancel para cancelar.`,
    prompts: {
      scout_name: "1/3 — Seu nome ou apelido de trabalho (as modelos verão no convite):",
      scout_phone: "2/3 — Telefone / WhatsApp com código do país (ex.: +971 50 123 4567):",
      scout_about: "3/3 — Algumas palavras sobre você: de onde vêm suas modelos, redes, experiência (opcional):",
    },
    skip: "Pular",
    phoneBad: "Não parece um número. Envie com o código do país, ex.: +971 50 123 4567.",
    tooShort: "Muito curto: pelo menos 2 caracteres.",
    tooLong: (m) => `Muito longo: reduza para ${m} caracteres.`,
    saving: "Enviando a solicitação…",
    done: "✅ Solicitação de scout enviada ao owner. Após a aprovação, o bot enviará aqui o acesso.",
    doneAuto: "✅ Seu painel de scout está aberto: login e senha acima.",
    doneAutoNoDelivery: "✅ Seu painel está aberto, mas o acesso não chegou. Envie /password para receber uma nova senha.",
    alreadyPending: "Sua solicitação de scout já está em análise.",
    alreadyLinked: "Esta conta do Telegram já está vinculada a um perfil VOYAGE.",
    alreadyScout: "Seu painel de scout já está aberto. Esqueceu a senha? Envie /password.",
    inviteInvalid: "O link de scout é inválido ou expirou. Peça um novo ou envie /scout para se candidatar.",
    failed: "Não foi possível salvar a solicitação. Tente mais tarde.",
    rejected: "Infelizmente, sua solicitação de scout VOYAGE foi recusada.",
    textOnly: "Você está preenchendo o formulário de scout — responda com texto. /cancel para cancelar.",
  },
};

export function isScoutRegStage(stage: string | null | undefined): boolean {
  return typeof stage === "string" && stage.startsWith("scout_");
}

/** Deep link: scout | sc_<VYS-код>; null — не ссылка скаута. */
export function parseScoutRecruitPayload(payload: string): { code: string | null } | null {
  const raw = payload.trim();
  if (/^scout$/i.test(raw)) return { code: null };
  const match = /^sc_(VYS-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/i.exec(raw);
  return match ? { code: match[1].toUpperCase() } : null;
}

function langOf(value: unknown): TelegramLang {
  return value === "EN" || value === "ES" || value === "PT" ? value : "RU";
}
function escapeHtml(value: unknown): string {
  return String(value ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] ?? c));
}
function clean(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/[ \t]+/g, " ").trim();
}
function stateExpiry(): string {
  return new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
}
function normalizePhone(raw: string): string | null {
  const v = raw.replace(/[^0-9+]/g, "");
  let d = v.replace(/[^0-9]/g, "");
  if (!v.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (d.length === 11 && d.startsWith("8")) d = `7${d.slice(1)}`;
  }
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

async function save(state: TelegramConversationState, patch: Partial<TelegramConversationState>): Promise<TelegramConversationState> {
  const next = { ...state, ...patch, answers: { ...state.answers, ...(patch.answers ?? {}) }, expires_at: stateExpiry() };
  await saveConversationState(next);
  return next;
}

export async function sendScoutPrompt(ctx: Context, state: TelegramConversationState): Promise<void> {
  const t = COPY[state.telegram_language];
  const step = state.stage as string;
  if (step === "scout_submitting") {
    await ctx.reply(t.saving);
    return;
  }
  if (step === "scout_about") {
    await ctx.reply(t.prompts.scout_about, { reply_markup: new InlineKeyboard().text(t.skip, "screg:about:skip") });
    return;
  }
  const known = (STEPS as readonly string[]).includes(step) ? (step as ScoutStep) : "scout_name";
  await ctx.reply(t.prompts[known]);
}

type RecruitPreview = { ok: true; issuer: string; auto: boolean } | { ok: false };

async function previewInvite(code: string): Promise<RecruitPreview> {
  const { data, error } = await getTelegramServiceClient().rpc("voyage_scout_recruit_preview", { p_code: code });
  if (error) {
    console.error("[scout-registration] invite preview failed", error.code ?? "unknown");
    return { ok: false };
  }
  const r = (data ?? {}) as { ok?: boolean; issuer_name?: string; auto_approve?: boolean };
  return r.ok ? { ok: true, issuer: r.issuer_name || "VOYAGE", auto: r.auto_approve === true } : { ok: false };
}

/** Старт анкеты. inviteCode — VYS-код из ссылки или команды. */
export async function beginScoutRegistration(ctx: Context, lang: TelegramLang, inviteCode: string | null): Promise<void> {
  const from = ctx.from;
  if (!from || !ctx.chat || ctx.chat.type !== "private") return;
  const t = COPY[lang];
  const telegramId = String(from.id);
  const db = getTelegramServiceClient();

  const { data: linked, error: linkedError } = await db.from("profiles").select("id,role").eq("telegram_id", telegramId).maybeSingle();
  if (linkedError) {
    console.error("[scout-registration] linked profile lookup failed", linkedError.code ?? "unknown");
    await ctx.reply(t.failed, { reply_markup: mainMenu(lang) });
    return;
  }
  if (linked) {
    await ctx.reply(linked.role === "scout" ? t.alreadyScout : t.alreadyLinked, { reply_markup: mainMenu(lang) });
    return;
  }
  const { data: pending } = await db.from("scout_applications").select("id").eq("telegram_id", telegramId).in("status", ["pending", "provisioning"]).maybeSingle();
  if (pending) {
    await ctx.reply(t.alreadyPending, { reply_markup: mainMenu(lang) });
    return;
  }

  const answers: RegistrationAnswers = {};
  const code = inviteCode?.trim().toUpperCase() || null;
  let preview: RecruitPreview | null = null;
  if (code) {
    preview = await previewInvite(code);
    if (!preview.ok) {
      await ctx.reply(t.inviteInvalid, { reply_markup: mainMenu(lang) });
      return;
    }
    answers.scout_invite = code;
    answers.scout_invite_issuer = preview.issuer;
  }

  const state: TelegramConversationState = {
    telegram_id: telegramId,
    telegram_username: from.username ?? null,
    telegram_language: lang,
    stage: "scout_name",
    answers,
    photo_urls: [],
    referral_code: code,
    expires_at: stateExpiry(),
  };
  await saveConversationState(state);
  await ctx.reply(preview?.ok ? t.introInvite(preview.issuer, preview.auto) : t.intro);
  await ctx.reply(t.prompts.scout_name);
}

/** Повтор /scout или /start scout посреди анкеты — показываем текущий вопрос. */
export async function resumeOrBeginScout(ctx: Context, lang: TelegramLang, code: string | null): Promise<void> {
  if (!ctx.from) return;
  const current = await getConversationState(String(ctx.from.id));
  if (current && isScoutRegStage(current.stage) && (!code || code === current.referral_code)) {
    await sendScoutPrompt(ctx, current);
    return;
  }
  await beginScoutRegistration(ctx, lang, code);
}

/** Текстовый ответ в анкете скаута. false — сообщение не относится к анкете. */
export async function handleScoutRegistrationText(ctx: Context, textInput: string): Promise<boolean> {
  if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return false;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isScoutRegStage(state.stage)) return false;
  const t = COPY[state.telegram_language];
  const value = clean(textInput);
  if (value.startsWith("/")) {
    await sendScoutPrompt(ctx, state);
    return true;
  }
  switch (state.stage) {
    case "scout_submitting":
      await ctx.reply(t.saving);
      return true;
    case "scout_name": {
      if (value.length < 2) return void (await ctx.reply(t.tooShort)), true;
      if (value.length > LIMITS.scout_name) return void (await ctx.reply(t.tooLong(LIMITS.scout_name))), true;
      const next = await save(state, { stage: "scout_phone", answers: { scout_name: value } });
      await sendScoutPrompt(ctx, next);
      return true;
    }
    case "scout_phone": {
      const phone = normalizePhone(value);
      if (!phone) return void (await ctx.reply(t.phoneBad)), true;
      const next = await save(state, { stage: "scout_about", answers: { scout_phone: value.length <= LIMITS.scout_phone ? value : phone } });
      await sendScoutPrompt(ctx, next);
      return true;
    }
    case "scout_about": {
      if (value.length > LIMITS.scout_about) return void (await ctx.reply(t.tooLong(LIMITS.scout_about))), true;
      await finalize(ctx, { ...state, answers: { ...state.answers, scout_about: value } });
      return true;
    }
    default:
      await sendScoutPrompt(ctx, state);
      return true;
  }
}

export async function handleScoutRegistrationPhoto(ctx: Context): Promise<boolean> {
  if (!ctx.from) return false;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isScoutRegStage(state.stage)) return false;
  await ctx.reply(COPY[state.telegram_language].textOnly);
  return true;
}

export async function handleScoutRegistrationCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  await ctx.answerCallbackQuery().catch(() => {});
  if (!ctx.from) return;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isScoutRegStage(state.stage)) return;
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch {
    // уже изменено
  }
  if (data === "screg:about:skip" && state.stage === "scout_about") await finalize(ctx, state);
}

async function finalize(ctx: Context, state: TelegramConversationState): Promise<void> {
  const lang = state.telegram_language;
  const t = COPY[lang];
  const a = state.answers;
  if (!a.scout_name || !a.scout_phone) {
    const next = await save(state, { stage: !a.scout_name ? "scout_name" : "scout_phone" });
    await sendScoutPrompt(ctx, next);
    return;
  }
  await save(state, { stage: "scout_submitting" });
  await ctx.reply(t.saving);

  const db = getTelegramServiceClient();
  const { data, error } = await db.rpc("voyage_submit_scout_application", {
    p_telegram_id: state.telegram_id,
    p_telegram_username: state.telegram_username,
    p_language: lang,
    p_display_name: a.scout_name,
    p_phone: a.scout_phone,
    p_about: a.scout_about ?? null,
    p_invite_code: a.scout_invite ?? null,
  });
  if (error) {
    console.error("[scout-registration] submit failed", error.code ?? "unknown");
    await save(state, { stage: "scout_about" });
    await ctx.reply(t.failed, { reply_markup: mainMenu(lang) });
    return;
  }
  const r = (data ?? {}) as { ok?: boolean; reason?: string; application_id?: string; auto_approve?: boolean; actor_id?: string | null };
  if (!r.ok || !r.application_id) {
    if (r.reason === "invite_invalid") {
      // ссылку успели отозвать: продолжаем как обычную заявку на модерацию
      const next = await save(state, { stage: "scout_about", answers: { scout_invite: undefined, scout_invite_issuer: undefined }, referral_code: null });
      await ctx.reply(t.inviteInvalid);
      await sendScoutPrompt(ctx, next);
      return;
    }
    await deleteConversationState(state.telegram_id);
    await ctx.reply(r.reason === "already_pending" ? t.alreadyPending : r.reason === "telegram_linked" ? t.alreadyLinked : t.failed, { reply_markup: mainMenu(lang) });
    return;
  }
  await deleteConversationState(state.telegram_id);

  if (r.auto_approve && r.actor_id) {
    const result = await provisionScoutAccount(r.application_id, r.actor_id);
    if (result.ok) {
      await ctx.reply(result.delivered ? t.doneAuto : t.doneAutoNoDelivery, { reply_markup: siteLoginKeyboard(lang) });
      return;
    }
    // не получилось открыть сразу — заявка вернулась в pending, решит owner
  }
  await ctx.reply(t.done, { reply_markup: mainMenu(lang) });
  await notifyScoutApplication(r.application_id);
}

/* ══════════════════════════════════════════════════════════════════
 * Открытие кабинета и отказ — общие для бота и кабинета owner
 * ══════════════════════════════════════════════════════════════════ */

type ApplicationRow = {
  id: string;
  telegram_id: string;
  telegram_username: string | null;
  language: string;
  display_name: string;
  phone: string;
  about: string | null;
  invite_code: string | null;
  referred_by: string | null;
  auto_approve: boolean;
  status: string;
};

export type ScoutProvisionResult =
  | { ok: true; profileId: string; login: string; delivered: boolean }
  | { ok: false; error: "not_pending" | "forbidden" | "auth_failed" | "provision_failed" };

const LOGIN_DOMAIN = (process.env.VOYAGE_STAFF_LOGIN_DOMAIN || "voyage-models.com").trim().toLowerCase();

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Логин-ник: sc-<username|псевдоним>. Вход на /login по нику без домена. */
function loginBase(app: ApplicationRow): string {
  const slug = (app.telegram_username || app.display_name)
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `sc-${slug || "scout"}`;
}

function newPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
  return Array.from({ length: 20 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
}

/** Создаёт Auth-пользователя скаута и отправляет доступ. actorId — owner. */
export async function provisionScoutAccount(applicationId: string, actorId: string): Promise<ScoutProvisionResult> {
  const db = getTelegramServiceClient();
  const { data, error } = await db.rpc("voyage_claim_scout_application", { p_id: applicationId, p_actor: actorId });
  if (error) {
    console.error("[scout-registration] claim failed", error.code ?? "unknown");
    return { ok: false, error: /forbidden/.test(error.message ?? "") ? "forbidden" : "not_pending" };
  }
  const app = ((Array.isArray(data) ? data[0] : data) ?? null) as ApplicationRow | null;
  if (!app?.id) return { ok: false, error: "not_pending" };

  const release = async (note: string) => {
    const { error: releaseError } = await db.rpc("voyage_release_scout_application", { p_id: app.id, p_note: note });
    if (releaseError) console.error("[scout-registration] release failed", releaseError.code ?? "unknown");
  };

  const password = newPassword();
  const deliveryId = randomUUID();
  const base = loginBase(app);
  let createdId: string | null = null;
  let login = "";
  for (let attempt = 0; attempt < 4 && !createdId; attempt += 1) {
    login = `${attempt === 0 ? base : `${base}-${randomInt(100, 999)}`}@${LOGIN_DOMAIN}`;
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: login,
      password,
      email_confirm: true,
      user_metadata: { name: app.display_name, full_name: app.display_name, telegram_id: app.telegram_id, created_by: "scout_telegram_registration" },
    });
    if (created?.user) {
      createdId = created.user.id;
      break;
    }
    const duplicate = /already|registered|exists|duplicate/i.test(createError?.message ?? "") || createError?.code === "email_exists";
    if (!duplicate) {
      console.error("[scout-registration] auth user creation failed", createError?.code ?? "unknown");
      break;
    }
  }
  if (!createdId) {
    await release("auth_failed");
    return { ok: false, error: "auth_failed" };
  }

  const { error: provisionError } = await db.rpc("voyage_provision_scout", {
    p_application: app.id,
    p_profile: createdId,
    p_delivery_id: deliveryId,
    p_login: login,
    p_actor: actorId,
  });
  if (provisionError) {
    console.error("[scout-registration] provision failed", provisionError.code ?? "unknown");
    await db.auth.admin.deleteUser(createdId);
    await release("provision_failed");
    return { ok: false, error: "provision_failed" };
  }

  let delivered = false;
  try {
    const result = await sendApprovedCredentialsTelegram({
      deliveryId,
      profileId: createdId,
      telegramId: app.telegram_id,
      login,
      password,
      fullName: app.display_name,
      audience: "scout",
    });
    delivered = result.sent;
    if (!result.sent) console.warn("[scout-registration] credentials delivery failed", result.error);
  } catch (sendError) {
    console.error("[scout-registration] credentials delivery threw", sendError instanceof Error ? sendError.name : "unknown");
  }
  return { ok: true, profileId: createdId, login, delivered };
}

export async function rejectScoutApplication(applicationId: string, actorId: string, note?: string | null): Promise<boolean> {
  const db = getTelegramServiceClient();
  const { data, error } = await db.rpc("voyage_reject_scout_application", { p_id: applicationId, p_actor: actorId, p_note: note ?? null });
  const r = (data ?? {}) as { ok?: boolean; telegram_id?: string; language?: string };
  if (error || !r.ok) {
    if (error) console.error("[scout-registration] reject failed", error.code ?? "unknown");
    return false;
  }
  try {
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    await getVoyageTelegramBot().api.sendMessage(String(r.telegram_id), COPY[langOf(r.language)].rejected);
  } catch (sendError) {
    console.error("[scout-registration] rejection message failed", sendError instanceof Error ? sendError.name : "unknown");
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════════
 * Уведомление owner (рабочий чат) с кнопками «Одобрить / Отклонить»
 * ══════════════════════════════════════════════════════════════════ */

const NOTICE: Record<TelegramLang, {
  title: string; name: string; username: string; phone: string; about: string; invite: (issuer: string) => string; noInvite: string;
  approve: string; reject: string; open: string; approved: (login: string) => string; approvedNoDelivery: string; rejected: string; stale: string; forbidden: string; failed: string;
}> = {
  RU: {
    title: "💎 Новая заявка скаута", name: "Имя", username: "Telegram", phone: "Телефон / WhatsApp", about: "О себе",
    invite: (i) => `По ссылке от: ${i}`, noInvite: "Без ссылки — заявка с сайта или бота",
    approve: "✅ Одобрить", reject: "✖️ Отклонить", open: "Открыть «Скауты»",
    approved: (l) => `✅ Одобрено: кабинет скаута открыт (логин ${l}), доступ отправлен в Telegram.`,
    approvedNoDelivery: "✅ Кабинет открыт, но доступ не дошёл в Telegram. Скаут может отправить боту /password.",
    rejected: "✖️ Заявка отклонена, скаут получил уведомление.", stale: "Заявка уже обработана.",
    forbidden: "Решать по заявкам скаутов может только owner.", failed: "Не удалось открыть кабинет. Попробуйте из кабинета owner.",
  },
  EN: {
    title: "💎 New scout application", name: "Name", username: "Telegram", phone: "Phone / WhatsApp", about: "About",
    invite: (i) => `Via link from: ${i}`, noInvite: "No link: direct application",
    approve: "✅ Approve", reject: "✖️ Decline", open: "Open “Scouts”",
    approved: (l) => `✅ Approved: scout desk open (login ${l}), access sent via Telegram.`,
    approvedNoDelivery: "✅ Desk open, but Telegram delivery failed. The scout can send /password to the bot.",
    rejected: "✖️ Declined, the scout has been notified.", stale: "This application has already been handled.",
    forbidden: "Only the owner can decide on scout applications.", failed: "Could not open the desk. Try from the owner console.",
  },
  ES: {
    title: "💎 Nueva solicitud de scout", name: "Nombre", username: "Telegram", phone: "Teléfono / WhatsApp", about: "Sobre sí",
    invite: (i) => `Por enlace de: ${i}`, noInvite: "Sin enlace: solicitud directa",
    approve: "✅ Aprobar", reject: "✖️ Rechazar", open: "Abrir «Scouts»",
    approved: (l) => `✅ Aprobado: panel abierto (usuario ${l}), acceso enviado por Telegram.`,
    approvedNoDelivery: "✅ Panel abierto, pero el envío por Telegram falló. El scout puede enviar /password.",
    rejected: "✖️ Rechazada, el scout fue avisado.", stale: "Esta solicitud ya fue procesada.",
    forbidden: "Solo el owner puede decidir sobre scouts.", failed: "No se pudo abrir el panel.",
  },
  PT: {
    title: "💎 Nova solicitação de scout", name: "Nome", username: "Telegram", phone: "Telefone / WhatsApp", about: "Sobre",
    invite: (i) => `Pelo link de: ${i}`, noInvite: "Sem link: solicitação direta",
    approve: "✅ Aprovar", reject: "✖️ Recusar", open: "Abrir «Scouts»",
    approved: (l) => `✅ Aprovado: painel aberto (login ${l}), acesso enviado pelo Telegram.`,
    approvedNoDelivery: "✅ Painel aberto, mas o envio pelo Telegram falhou. O scout pode enviar /password.",
    rejected: "✖️ Recusada, o scout foi avisado.", stale: "Esta solicitação já foi processada.",
    forbidden: "Só o owner pode decidir sobre scouts.", failed: "Não foi possível abrir o painel.",
  },
};

function scoutsUrl(): string {
  const fallback = "https://voyage-models.com/admin/tour-control/scouts";
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://voyage-models.com").trim();
  try {
    const url = new URL("/admin/tour-control/scouts", base.endsWith("/") ? base : `${base}/`);
    return url.protocol === "https:" && url.hostname !== "localhost" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

/** Получатели: рабочие чаты owner (admin_settings), иначе личный Telegram owner. Admin — нет. */
async function ownerRecipients(): Promise<Array<{ chatId: string; lang: TelegramLang }>> {
  const db = getTelegramServiceClient();
  const out = new Map<string, { chatId: string; lang: TelegramLang }>();
  const { data: owners } = await db.from("profiles").select("id,telegram_id,telegram_language").eq("role", "owner");
  const ownerIds = (owners ?? []).map((o) => o.id);
  if (!ownerIds.length) return [];
  const { data: settings } = await db.from("admin_settings")
    .select("admin_id,notifications_tg_id,notify_new_applications,notification_language")
    .in("admin_id", ownerIds)
    .eq("notify_new_applications", true)
    .not("notifications_tg_id", "is", null);
  for (const row of settings ?? []) {
    const chat = String(row.notifications_tg_id ?? "");
    if (/^-?[0-9]{5,20}$/.test(chat) && !out.has(chat)) out.set(chat, { chatId: chat, lang: langOf(row.notification_language) });
  }
  if (!(settings ?? []).length) {
    for (const owner of owners ?? []) {
      const chat = String(owner.telegram_id ?? "");
      if (/^[0-9]{4,20}$/.test(chat) && !out.has(chat)) out.set(chat, { chatId: chat, lang: langOf(owner.telegram_language) });
    }
  }
  return [...out.values()];
}

export async function notifyScoutApplication(applicationId: string): Promise<void> {
  try {
    const db = getTelegramServiceClient();
    const { data } = await db.from("scout_applications").select("*").eq("id", applicationId).maybeSingle();
    const app = data as ApplicationRow | null;
    if (!app || app.status !== "pending") return;
    const { data: issuerName } = app.referred_by
      ? await db.rpc("voyage_ops_display_name", { p_profile: app.referred_by })
      : { data: null };
    const recipients = await ownerRecipients();
    if (!recipients.length) return;
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    const bot = getVoyageTelegramBot();
    const eventKey = `scout_application:${applicationId}`;

    for (const r of recipients) {
      const claim = await db.rpc("claim_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: r.chatId });
      if (claim.error || claim.data !== true) continue;
      const t = NOTICE[r.lang];
      const lines = [
        `<b>${t.title}</b>`,
        `<i>${escapeHtml(app.referred_by ? t.invite(String(issuerName ?? "—")) : t.noInvite)}</i>`,
        "",
        `${t.name}: <b>${escapeHtml(app.display_name)}</b>`,
        `${t.username}: ${app.telegram_username ? `@${escapeHtml(app.telegram_username)}` : `<code>${escapeHtml(app.telegram_id)}</code>`}`,
        `${t.phone}: ${escapeHtml(app.phone)}`,
      ];
      if (app.about) lines.push(`${t.about}: ${escapeHtml(app.about)}`);
      const keyboard = new InlineKeyboard()
        .text(t.approve, `sadm:ok:${app.id}`)
        .text(t.reject, `sadm:no:${app.id}`)
        .row()
        .url(t.open, scoutsUrl());
      try {
        await bot.api.sendMessage(r.chatId, lines.join("\n"), { parse_mode: "HTML", reply_markup: keyboard, link_preview_options: { is_disabled: true } });
        await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: r.chatId, p_status: "sent", p_error: null });
      } catch (sendError) {
        const code = sendError && typeof sendError === "object" && "error_code" in sendError ? String((sendError as { error_code: unknown }).error_code) : "send_failed";
        await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: r.chatId, p_status: "failed", p_error: code });
      }
    }
  } catch (error) {
    console.error("[scout-registration] notification failed", error instanceof Error ? error.name : "unknown");
  }
}

/** «Одобрить / Отклонить» из рабочего чата. Кто нажал — перепроверяется по базе: только owner. */
export async function handleScoutAdminCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const match = /^sadm:(ok|no):([0-9a-f-]{36})$/i.exec(data);
  if (!match || !ctx.from) {
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }
  const db = getTelegramServiceClient();
  const telegramId = String(ctx.from.id);
  const [, action, applicationId] = match;

  const { data: byProfile } = await db.from("profiles")
    .select("id,role,telegram_language")
    .eq("telegram_id", telegramId)
    .eq("role", "owner")
    .maybeSingle();
  let actorId: string | null = byProfile?.id ?? null;
  let lang: TelegramLang = langOf(byProfile?.telegram_language);
  if (!actorId) {
    const { data: bySettings } = await db.from("admin_settings").select("admin_id,notification_language").eq("notifications_tg_id", telegramId);
    const ids = (bySettings ?? []).map((row) => row.admin_id);
    if (ids.length) {
      const { data: owners } = await db.from("profiles").select("id").in("id", ids).eq("role", "owner").limit(1);
      if (owners?.[0]) {
        actorId = owners[0].id;
        lang = langOf(bySettings?.find((row) => row.admin_id === actorId)?.notification_language);
      }
    }
  }
  const t = NOTICE[lang];
  if (!actorId) {
    await ctx.answerCallbackQuery({ text: t.forbidden, show_alert: true });
    return;
  }

  let message: string;
  if (action === "ok") {
    const result = await provisionScoutAccount(applicationId, actorId);
    message = result.ok
      ? (result.delivered ? t.approved(result.login.split("@")[0]) : t.approvedNoDelivery)
      : result.error === "forbidden" ? t.forbidden
      : result.error === "not_pending" ? t.stale
      : t.failed;
  } else {
    message = (await rejectScoutApplication(applicationId, actorId)) ? t.rejected : t.stale;
  }

  await ctx.answerCallbackQuery({ text: message.slice(0, 190) }).catch(() => {});
  if (message !== t.forbidden) {
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {
      // уже изменено
    }
  }
  await ctx.reply(message, { reply_markup: siteLoginKeyboard(lang) });
}
