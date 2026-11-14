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
 * VOYAGE · Регистрация оператора в боте (ОС туров, Этап 1)
 *
 *   Кнопка «🎧 Регистрация оператора» (menu:operator), /operator [VYO-…],
 *   /start operator, /start op_VYO-XXXX-XXXX (инвайт-ссылка менеджера).
 *
 * Анкета: 1) псевдоним  2) @username (из Telegram + подтверждение)
 *         3) телефон / WhatsApp  4) часовой пояс  5) менеджер (обязательно:
 *         по инвайт-ссылке подставляется сам, иначе @username или код)
 *         6) опыт (можно пропустить).
 *
 * Заявка → operator_applications (pending, manager_id). Уведомление —
 * менеджеру в личку с кнопками и копия owner. Одобрить может этот
 * менеджер или owner (кнопкой или в кабинете /partner/team). Admin — нет.
 * После одобрения: Auth-пользователь op-<ник>@<домен>, роль operator,
 * логин и пароль в чат (protect_content + кнопка удаления + автоудаление).
 * ──────────────────────────────────────────────────────────────────── */

export const OPERATOR_INVITE_RE = /^VYO-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const STEPS = [
  "operator_name",
  "operator_username",
  "operator_phone",
  "operator_timezone",
  "operator_manager",
  "operator_experience",
] as const;
type OperatorStep = (typeof STEPS)[number];

const TZ_BUTTONS = ["Europe/Moscow", "Asia/Dubai", "Australia/Sydney", "Asia/Bangkok", "Europe/Istanbul", "Asia/Bali"] as const;

type Copy = {
  intro: string;
  introInvite: (manager: string) => string;
  prompts: Record<OperatorStep, string>;
  usernameConfirm: (u: string) => string;
  usernameYes: string;
  usernameOther: string;
  usernameNone: string;
  usernameBad: string;
  phoneBad: string;
  tzOther: string;
  tzBad: string;
  tzSaved: (tz: string) => string;
  managerConfirm: (name: string) => string;
  managerYes: string;
  managerOther: string;
  managerNotFound: string;
  managerInvite: string;
  skip: string;
  tooShort: string;
  tooLong: (max: number) => string;
  saving: string;
  done: (manager: string) => string;
  alreadyPending: string;
  alreadyLinked: string;
  alreadyOperator: string;
  inviteInvalid: string;
  failed: string;
  rejected: string;
  textOnly: string;
};

const COPY: Record<TelegramLang, Copy> = {
  RU: {
    intro: "🎧 Регистрация оператора VOYAGE.\nШесть коротких шагов — и заявка уйдёт вашему менеджеру. После одобрения бот пришлёт сюда логин и пароль от кабинета оператора.\n/cancel — отменить.",
    introInvite: (m) => `🎧 Приглашение от менеджера «${m}» принято.\nШесть коротких шагов — и заявка уйдёт ему на одобрение.\n/cancel — отменить.`,
    prompts: {
      operator_name: "1/6 — Имя или рабочий псевдоним (так вас увидят в системе и в журнале действий):",
      operator_username: "2/6 — Рабочий Telegram @username:",
      operator_phone: "3/6 — Контактный телефон / WhatsApp для связи с гостями и моделями (с кодом страны, например +971 50 123 4567):",
      operator_timezone: "4/6 — Ваш часовой пояс (нужен для двойного времени на таймлайне). Выберите кнопкой или напишите, например Europe/Moscow:",
      operator_manager: "5/6 — Ваш менеджер: пришлите его Telegram @username или инвайт-код вида VYO-XXXX-XXXX:",
      operator_experience: "6/6 — Опыт работы или короткий комментарий (можно пропустить):",
    },
    usernameConfirm: (u) => `2/6 — Рабочий Telegram: @${u}. Верно?`,
    usernameYes: "✅ Да, верно",
    usernameOther: "✏️ Другой",
    usernameNone: "2/6 — У вашего Telegram нет @username. Пришлите рабочий @username (или задайте его в настройках Telegram и пришлите сюда):",
    usernameBad: "Нужен @username: 4–32 символа, латиница, цифры и _.",
    phoneBad: "Не похоже на номер. Пришлите телефон с кодом страны, например +971 50 123 4567.",
    tzOther: "🌍 Другой",
    tzBad: "Не знаю такой часовой пояс. Пример: Europe/Moscow, Asia/Dubai, Australia/Sydney.",
    tzSaved: (tz) => `Часовой пояс: ${tz}`,
    managerConfirm: (n) => `5/6 — Ваш менеджер: «${n}». Всё верно?`,
    managerYes: "✅ Да, это мой менеджер",
    managerOther: "✏️ Другой менеджер",
    managerNotFound: "Менеджер не найден. Проверьте @username или попросите у менеджера инвайт-ссылку.",
    managerInvite: "Инвайт-код недействителен, истёк или исчерпан. Попросите у менеджера новую ссылку.",
    skip: "Пропустить",
    tooShort: "Слишком коротко — нужно хотя бы 2 символа.",
    tooLong: (m) => `Слишком длинно — сократите до ${m} символов.`,
    saving: "Отправляю заявку…",
    done: (m) => `✅ Заявка отправлена менеджеру «${m}». Как только её одобрят, бот пришлёт сюда логин и пароль от кабинета оператора.`,
    alreadyPending: "Ваша заявка оператора уже на рассмотрении. Мы напишем сюда, как только будет решение.",
    alreadyLinked: "Этот Telegram уже привязан к профилю VOYAGE. Если нужен доступ оператора — напишите в поддержку.",
    alreadyOperator: "Ваш кабинет оператора уже открыт. Забыли пароль — отправьте /password.",
    inviteInvalid: "Инвайт-ссылка оператора недействительна или истекла. Попросите у менеджера новую или отправьте /operator.",
    failed: "Не удалось сохранить заявку. Попробуйте позже или напишите в поддержку.",
    rejected: "К сожалению, заявка оператора VOYAGE отклонена. Если это ошибка — свяжитесь с вашим менеджером.",
    textOnly: "Сейчас идёт анкета оператора — ответьте текстом. /cancel — отменить.",
  },
  EN: {
    intro: "🎧 VOYAGE operator registration.\nSix short steps and your application goes to your manager. Once approved, the bot will send your operator desk login and password here.\n/cancel to stop.",
    introInvite: (m) => `🎧 Invitation from manager “${m}” accepted.\nSix short steps and your application goes to them for approval.\n/cancel to stop.`,
    prompts: {
      operator_name: "1/6 — Your name or work alias (shown in the system and in the activity log):",
      operator_username: "2/6 — Work Telegram @username:",
      operator_phone: "3/6 — Contact phone / WhatsApp for guests and models (with country code, e.g. +971 50 123 4567):",
      operator_timezone: "4/6 — Your time zone (used for dual time on the timeline). Tap a button or type one, e.g. Europe/Moscow:",
      operator_manager: "5/6 — Your manager: send their Telegram @username or an invite code like VYO-XXXX-XXXX:",
      operator_experience: "6/6 — Experience or a short comment (optional):",
    },
    usernameConfirm: (u) => `2/6 — Work Telegram: @${u}. Correct?`,
    usernameYes: "✅ Yes, correct",
    usernameOther: "✏️ Another one",
    usernameNone: "2/6 — Your Telegram has no @username. Send your work @username (or set one in Telegram settings and send it here):",
    usernameBad: "A @username is 4–32 characters: Latin letters, digits and _.",
    phoneBad: "That doesn’t look like a phone number. Send it with the country code, e.g. +971 50 123 4567.",
    tzOther: "🌍 Other",
    tzBad: "Unknown time zone. Example: Europe/Moscow, Asia/Dubai, Australia/Sydney.",
    tzSaved: (tz) => `Time zone: ${tz}`,
    managerConfirm: (n) => `5/6 — Your manager: “${n}”. Correct?`,
    managerYes: "✅ Yes, that’s my manager",
    managerOther: "✏️ Another manager",
    managerNotFound: "Manager not found. Check the @username or ask your manager for an invite link.",
    managerInvite: "The invite code is invalid, expired or used up. Ask your manager for a new link.",
    skip: "Skip",
    tooShort: "Too short — at least 2 characters, please.",
    tooLong: (m) => `Too long — please keep it under ${m} characters.`,
    saving: "Sending your application…",
    done: (m) => `✅ Application sent to manager “${m}”. Once approved, the bot will send your operator desk login and password here.`,
    alreadyPending: "Your operator application is already under review. We’ll message you here once there is a decision.",
    alreadyLinked: "This Telegram account is already linked to a VOYAGE profile. Contact support if you need operator access.",
    alreadyOperator: "Your operator desk is already open. Forgot the password? Send /password.",
    inviteInvalid: "This operator invite link is invalid or expired. Ask your manager for a new one or send /operator.",
    failed: "Could not save the application. Please try again later or contact support.",
    rejected: "Unfortunately, your VOYAGE operator application was declined. If this is a mistake, contact your manager.",
    textOnly: "You are filling in the operator form — please reply with text. /cancel to stop.",
  },
  ES: {
    intro: "🎧 Registro de operador VOYAGE.\nSeis pasos cortos y tu solicitud irá a tu gerente. Tras la aprobación, el bot te enviará aquí el usuario y la contraseña.\n/cancel para cancelar.",
    introInvite: (m) => `🎧 Invitación del gerente «${m}» aceptada.\nSeis pasos cortos y tu solicitud irá a su aprobación.\n/cancel para cancelar.`,
    prompts: {
      operator_name: "1/6 — Tu nombre o alias de trabajo (así te verán en el sistema y en el registro):",
      operator_username: "2/6 — Telegram de trabajo @usuario:",
      operator_phone: "3/6 — Teléfono / WhatsApp de contacto con prefijo de país (p. ej. +971 50 123 4567):",
      operator_timezone: "4/6 — Tu zona horaria (para la doble hora en el cronograma). Elige un botón o escribe, p. ej. Europe/Moscow:",
      operator_manager: "5/6 — Tu gerente: envía su @usuario de Telegram o un código de invitación VYO-XXXX-XXXX:",
      operator_experience: "6/6 — Experiencia o un comentario breve (opcional):",
    },
    usernameConfirm: (u) => `2/6 — Telegram de trabajo: @${u}. ¿Correcto?`,
    usernameYes: "✅ Sí, correcto",
    usernameOther: "✏️ Otro",
    usernameNone: "2/6 — Tu Telegram no tiene @usuario. Envía tu @usuario de trabajo:",
    usernameBad: "Un @usuario tiene 4–32 caracteres: letras latinas, dígitos y _.",
    phoneBad: "No parece un número. Envíalo con prefijo de país, p. ej. +971 50 123 4567.",
    tzOther: "🌍 Otra",
    tzBad: "Zona horaria desconocida. Ejemplo: Europe/Moscow, Asia/Dubai.",
    tzSaved: (tz) => `Zona horaria: ${tz}`,
    managerConfirm: (n) => `5/6 — Tu gerente: «${n}». ¿Correcto?`,
    managerYes: "✅ Sí, es mi gerente",
    managerOther: "✏️ Otro gerente",
    managerNotFound: "Gerente no encontrado. Revisa el @usuario o pide un enlace de invitación.",
    managerInvite: "El código de invitación no es válido o caducó. Pide un enlace nuevo.",
    skip: "Omitir",
    tooShort: "Demasiado corto: al menos 2 caracteres.",
    tooLong: (m) => `Demasiado largo: redúcelo a ${m} caracteres.`,
    saving: "Enviando la solicitud…",
    done: (m) => `✅ Solicitud enviada al gerente «${m}». Tras la aprobación, el bot te enviará aquí el acceso.`,
    alreadyPending: "Tu solicitud de operador ya está en revisión.",
    alreadyLinked: "Esta cuenta de Telegram ya está vinculada a un perfil de VOYAGE.",
    alreadyOperator: "Tu panel de operador ya está abierto. ¿Olvidaste la contraseña? Envía /password.",
    inviteInvalid: "El enlace de invitación no es válido o caducó. Pide uno nuevo o envía /operator.",
    failed: "No se pudo guardar la solicitud. Inténtalo más tarde.",
    rejected: "Lamentablemente, tu solicitud de operador fue rechazada. Si es un error, contacta con tu gerente.",
    textOnly: "Estás completando el formulario de operador: responde con texto. /cancel para cancelar.",
  },
  PT: {
    intro: "🎧 Cadastro de operador VOYAGE.\nSeis passos curtos e sua solicitação vai para o seu gerente. Após a aprovação, o bot enviará aqui o login e a senha.\n/cancel para cancelar.",
    introInvite: (m) => `🎧 Convite do gerente «${m}» aceito.\nSeis passos curtos e sua solicitação vai para aprovação.\n/cancel para cancelar.`,
    prompts: {
      operator_name: "1/6 — Seu nome ou apelido de trabalho (como aparecerá no sistema e no registro):",
      operator_username: "2/6 — Telegram de trabalho @usuário:",
      operator_phone: "3/6 — Telefone / WhatsApp de contato com código do país (ex.: +971 50 123 4567):",
      operator_timezone: "4/6 — Seu fuso horário (para a hora dupla na linha do tempo). Toque num botão ou escreva, ex.: Europe/Moscow:",
      operator_manager: "5/6 — Seu gerente: envie o @usuário do Telegram dele ou um código de convite VYO-XXXX-XXXX:",
      operator_experience: "6/6 — Experiência ou um comentário curto (opcional):",
    },
    usernameConfirm: (u) => `2/6 — Telegram de trabalho: @${u}. Correto?`,
    usernameYes: "✅ Sim, correto",
    usernameOther: "✏️ Outro",
    usernameNone: "2/6 — Seu Telegram não tem @usuário. Envie seu @usuário de trabalho:",
    usernameBad: "Um @usuário tem 4–32 caracteres: letras latinas, dígitos e _.",
    phoneBad: "Não parece um número. Envie com o código do país, ex.: +971 50 123 4567.",
    tzOther: "🌍 Outro",
    tzBad: "Fuso horário desconhecido. Exemplo: Europe/Moscow, Asia/Dubai.",
    tzSaved: (tz) => `Fuso horário: ${tz}`,
    managerConfirm: (n) => `5/6 — Seu gerente: «${n}». Correto?`,
    managerYes: "✅ Sim, é meu gerente",
    managerOther: "✏️ Outro gerente",
    managerNotFound: "Gerente não encontrado. Confira o @usuário ou peça um link de convite.",
    managerInvite: "O código de convite é inválido ou expirou. Peça um novo link.",
    skip: "Pular",
    tooShort: "Muito curto — pelo menos 2 caracteres.",
    tooLong: (m) => `Muito longo — reduza para ${m} caracteres.`,
    saving: "Enviando a solicitação…",
    done: (m) => `✅ Solicitação enviada ao gerente «${m}». Após a aprovação, o bot enviará aqui o acesso.`,
    alreadyPending: "Sua solicitação de operador já está em análise.",
    alreadyLinked: "Esta conta do Telegram já está vinculada a um perfil VOYAGE.",
    alreadyOperator: "Seu painel de operador já está aberto. Esqueceu a senha? Envie /password.",
    inviteInvalid: "O link de convite é inválido ou expirou. Peça um novo ou envie /operator.",
    failed: "Não foi possível salvar a solicitação. Tente mais tarde.",
    rejected: "Infelizmente, sua solicitação de operador foi recusada. Se for um erro, fale com seu gerente.",
    textOnly: "Você está preenchendo o formulário de operador — responda com texto. /cancel para cancelar.",
  },
};

const LIMITS = { operator_name: 60, operator_phone: 120, operator_experience: 1000 } as const;

export function isOperatorStage(stage: string | null | undefined): boolean {
  return typeof stage === "string" && stage.startsWith("operator_");
}

/** Разбор deep link: operator | op_<код>; null — не операторская ссылка. */
export function parseOperatorPayload(payload: string): { code: string | null } | null {
  const raw = payload.trim();
  if (/^operator$/i.test(raw)) return { code: null };
  const match = /^op_(VYO-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/i.exec(raw);
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

function normalizeUsername(raw: string): string | null {
  const v = raw.trim().replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/)?@?/i, "");
  return /^[A-Za-z0-9_]{4,32}$/.test(v) ? v : null;
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

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return /^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+){0,2}$/.test(tz);
  } catch {
    return false;
  }
}

function tzKeyboard(lang: TelegramLang): InlineKeyboard {
  const kb = new InlineKeyboard();
  TZ_BUTTONS.forEach((tz, i) => {
    kb.text(tz.split("/")[1].replace(/_/g, " "), `opreg:tz:${i}`);
    if (i % 2 === 1) kb.row();
  });
  return kb.text(COPY[lang].tzOther, "opreg:tz:other");
}

/** Текущий вопрос — для повторного /start или /operator посреди анкеты. */
export async function sendOperatorPrompt(ctx: Context, state: TelegramConversationState): Promise<void> {
  const t = COPY[state.telegram_language];
  const step = state.stage as string;
  if (step === "operator_submitting") {
    await ctx.reply(t.saving);
    return;
  }
  if (step === "operator_username") {
    const u = state.answers.operator_username;
    if (u) {
      await ctx.reply(t.usernameConfirm(u), {
        reply_markup: new InlineKeyboard().text(t.usernameYes, "opreg:user:ok").text(t.usernameOther, "opreg:user:edit"),
      });
    } else {
      await ctx.reply(t.usernameNone);
    }
    return;
  }
  if (step === "operator_timezone") {
    await ctx.reply(t.prompts.operator_timezone, { reply_markup: tzKeyboard(state.telegram_language) });
    return;
  }
  if (step === "operator_manager" && state.answers.operator_manager_id && state.answers.operator_manager_name) {
    await ctx.reply(t.managerConfirm(state.answers.operator_manager_name), {
      reply_markup: new InlineKeyboard().text(t.managerYes, "opreg:mgr:ok").row().text(t.managerOther, "opreg:mgr:other"),
    });
    return;
  }
  if (step === "operator_experience") {
    await ctx.reply(t.prompts.operator_experience, { reply_markup: new InlineKeyboard().text(t.skip, "opreg:exp:skip") });
    return;
  }
  const known = (STEPS as readonly string[]).includes(step) ? (step as OperatorStep) : "operator_name";
  await ctx.reply(t.prompts[known]);
}

type ManagerLookup = { ok: true; managerId: string; name: string; inviteCode: string | null } | { ok: false; reason: string };

async function findManager(query: string): Promise<ManagerLookup> {
  const { data, error } = await getTelegramServiceClient().rpc("voyage_find_operator_manager", { p_query: query });
  if (error) {
    console.error("[operator-registration] manager lookup failed", error.code ?? "unknown");
    return { ok: false, reason: "failed" };
  }
  const r = (data ?? {}) as { ok?: boolean; reason?: string; manager_id?: string; display_name?: string; invite_code?: string | null };
  if (!r.ok || !r.manager_id) return { ok: false, reason: r.reason ?? "not_found" };
  return { ok: true, managerId: r.manager_id, name: r.display_name ?? "VOYAGE", inviteCode: r.invite_code ?? null };
}

async function save(state: TelegramConversationState, patch: Partial<TelegramConversationState>): Promise<TelegramConversationState> {
  const next = { ...state, ...patch, answers: { ...state.answers, ...(patch.answers ?? {}) }, expires_at: stateExpiry() };
  await saveConversationState(next);
  return next;
}

/** Старт анкеты. inviteCode — VYO-код менеджера из ссылки или команды. */
export async function beginOperatorRegistration(ctx: Context, lang: TelegramLang, inviteCode: string | null): Promise<void> {
  const from = ctx.from;
  if (!from || !ctx.chat || ctx.chat.type !== "private") return;
  const t = COPY[lang];
  const telegramId = String(from.id);
  const db = getTelegramServiceClient();

  const { data: linked, error: linkedError } = await db.from("profiles").select("id,role").eq("telegram_id", telegramId).maybeSingle();
  if (linkedError) {
    console.error("[operator-registration] linked profile lookup failed", linkedError.code ?? "unknown");
    await ctx.reply(t.failed, { reply_markup: mainMenu(lang) });
    return;
  }
  if (linked) {
    await ctx.reply(linked.role === "operator" ? t.alreadyOperator : t.alreadyLinked, { reply_markup: mainMenu(lang) });
    return;
  }
  const { data: pending } = await db.from("operator_applications").select("id").eq("telegram_id", telegramId).in("status", ["pending", "provisioning"]).maybeSingle();
  if (pending) {
    await ctx.reply(t.alreadyPending, { reply_markup: mainMenu(lang) });
    return;
  }

  const answers: RegistrationAnswers = {};
  const code = inviteCode?.trim().toUpperCase() || null;
  if (code) {
    const manager = await findManager(code);
    if (!manager.ok) {
      await ctx.reply(t.inviteInvalid, { reply_markup: mainMenu(lang) });
      return;
    }
    answers.operator_manager_id = manager.managerId;
    answers.operator_manager_name = manager.name;
    answers.operator_invite = manager.inviteCode ?? code;
  }
  if (from.username) answers.operator_username = from.username;

  const state: TelegramConversationState = {
    telegram_id: telegramId,
    telegram_username: from.username ?? null,
    telegram_language: lang,
    stage: "operator_name",
    answers,
    photo_urls: [],
    referral_code: code,
    expires_at: stateExpiry(),
  };
  await saveConversationState(state);
  await ctx.reply(code && answers.operator_manager_name ? t.introInvite(answers.operator_manager_name) : t.intro);
  await ctx.reply(t.prompts.operator_name);
}

/** Текстовый ответ в анкете оператора. false — сообщение не относится к анкете. */
export async function handleOperatorRegistrationText(ctx: Context, textInput: string): Promise<boolean> {
  if (!ctx.from || !ctx.chat || ctx.chat.type !== "private") return false;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isOperatorStage(state.stage)) return false;
  const t = COPY[state.telegram_language];
  const value = clean(textInput);
  if (value.startsWith("/")) {
    await sendOperatorPrompt(ctx, state);
    return true;
  }

  switch (state.stage) {
    case "operator_submitting":
      await ctx.reply(t.saving);
      return true;
    case "operator_name": {
      if (value.length < 2) return void (await ctx.reply(t.tooShort)), true;
      if (value.length > LIMITS.operator_name) return void (await ctx.reply(t.tooLong(LIMITS.operator_name))), true;
      const next = await save(state, { stage: "operator_username", answers: { operator_name: value } });
      await sendOperatorPrompt(ctx, next);
      return true;
    }
    case "operator_username": {
      const u = normalizeUsername(value);
      if (!u) return void (await ctx.reply(t.usernameBad)), true;
      const next = await save(state, { stage: "operator_phone", answers: { operator_username: u, operator_username_confirmed: "1" } });
      await sendOperatorPrompt(ctx, next);
      return true;
    }
    case "operator_phone": {
      const phone = normalizePhone(value);
      if (!phone) return void (await ctx.reply(t.phoneBad)), true;
      const display = value.length <= LIMITS.operator_phone ? value : phone;
      const next = await save(state, { stage: "operator_timezone", answers: { operator_phone: display } });
      await sendOperatorPrompt(ctx, next);
      return true;
    }
    case "operator_timezone": {
      const tz = value.replace(/\s+/g, "_");
      if (!isValidTimezone(tz)) return void (await ctx.reply(t.tzBad, { reply_markup: tzKeyboard(state.telegram_language) })), true;
      const next = await save(state, { stage: "operator_manager", answers: { operator_timezone: tz } });
      await ctx.reply(t.tzSaved(tz));
      await sendOperatorPrompt(ctx, next);
      return true;
    }
    case "operator_manager": {
      const manager = await findManager(value);
      if (!manager.ok) {
        await ctx.reply(manager.reason === "invite_invalid" ? t.managerInvite : t.managerNotFound);
        return true;
      }
      const next = await save(state, {
        answers: { operator_manager_id: manager.managerId, operator_manager_name: manager.name, operator_invite: manager.inviteCode ?? undefined },
        referral_code: manager.inviteCode ?? null,
      });
      await sendOperatorPrompt(ctx, next);
      return true;
    }
    case "operator_experience": {
      if (value.length > LIMITS.operator_experience) return void (await ctx.reply(t.tooLong(LIMITS.operator_experience))), true;
      await finalize(ctx, { ...state, answers: { ...state.answers, operator_experience: value } });
      return true;
    }
    default:
      await sendOperatorPrompt(ctx, state);
      return true;
  }
}

export async function handleOperatorRegistrationPhoto(ctx: Context): Promise<boolean> {
  if (!ctx.from) return false;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isOperatorStage(state.stage)) return false;
  await ctx.reply(COPY[state.telegram_language].textOnly);
  return true;
}

/** Кнопки внутри анкеты: opreg:user:ok|edit, opreg:tz:<n>|other, opreg:mgr:ok|other, opreg:exp:skip. */
export async function handleOperatorRegistrationCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  await ctx.answerCallbackQuery().catch(() => {});
  if (!ctx.from) return;
  const state = await getConversationState(String(ctx.from.id));
  if (!state || !isOperatorStage(state.stage)) return;
  const t = COPY[state.telegram_language];
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch {
    // сообщение могло быть уже изменено
  }

  if (data === "opreg:user:ok" && state.stage === "operator_username" && state.answers.operator_username) {
    const next = await save(state, { stage: "operator_phone", answers: { operator_username_confirmed: "1" } });
    await sendOperatorPrompt(ctx, next);
    return;
  }
  if (data === "opreg:user:edit" && state.stage === "operator_username") {
    await ctx.reply(t.prompts.operator_username);
    return;
  }
  const tz = /^opreg:tz:(\d)$/.exec(data);
  if (tz && state.stage === "operator_timezone") {
    const zone = TZ_BUTTONS[Number(tz[1])];
    if (!zone) return;
    const next = await save(state, { stage: "operator_manager", answers: { operator_timezone: zone } });
    await ctx.reply(t.tzSaved(zone));
    await sendOperatorPrompt(ctx, next);
    return;
  }
  if (data === "opreg:tz:other" && state.stage === "operator_timezone") {
    await ctx.reply(t.prompts.operator_timezone);
    return;
  }
  if (data === "opreg:mgr:ok" && state.stage === "operator_manager" && state.answers.operator_manager_id) {
    const next = await save(state, { stage: "operator_experience" });
    await sendOperatorPrompt(ctx, next);
    return;
  }
  if (data === "opreg:mgr:other" && state.stage === "operator_manager") {
    const next = await save(state, {
      answers: { operator_manager_id: undefined, operator_manager_name: undefined, operator_invite: undefined },
      referral_code: null,
    });
    await ctx.reply(COPY[next.telegram_language].prompts.operator_manager);
    return;
  }
  if (data === "opreg:exp:skip" && state.stage === "operator_experience") {
    await finalize(ctx, state);
  }
}

async function finalize(ctx: Context, state: TelegramConversationState): Promise<void> {
  const lang = state.telegram_language;
  const t = COPY[lang];
  const a = state.answers;
  if (!a.operator_name || !a.operator_phone || !a.operator_timezone || !a.operator_manager_id) {
    const missing: OperatorStep = !a.operator_name ? "operator_name" : !a.operator_phone ? "operator_phone" : !a.operator_timezone ? "operator_timezone" : "operator_manager";
    const next = await save(state, { stage: missing });
    await sendOperatorPrompt(ctx, next);
    return;
  }
  await save(state, { stage: "operator_submitting" });
  await ctx.reply(t.saving);

  const { data, error } = await getTelegramServiceClient().rpc("voyage_submit_operator_application", {
    p_telegram_id: state.telegram_id,
    p_telegram_username: a.operator_username ?? state.telegram_username,
    p_language: lang,
    p_display_name: a.operator_name,
    p_phone: a.operator_phone,
    p_timezone: a.operator_timezone,
    p_manager: a.operator_manager_id,
    p_invite_code: a.operator_invite ?? null,
    p_experience: a.operator_experience ?? null,
  });
  if (error) {
    console.error("[operator-registration] submit failed", error.code ?? "unknown");
    await save(state, { stage: "operator_experience" });
    await ctx.reply(t.failed, { reply_markup: mainMenu(lang) });
    return;
  }
  const result = (data ?? {}) as { ok?: boolean; reason?: string; application_id?: string };
  if (!result.ok || !result.application_id) {
    if (result.reason === "invite_invalid" || result.reason === "manager_unavailable") {
      const next = await save(state, { stage: "operator_manager", answers: { operator_manager_id: undefined, operator_manager_name: undefined, operator_invite: undefined }, referral_code: null });
      await ctx.reply(result.reason === "invite_invalid" ? t.managerInvite : t.managerNotFound);
      await sendOperatorPrompt(ctx, next);
      return;
    }
    await deleteConversationState(state.telegram_id);
    await ctx.reply(result.reason === "already_pending" ? t.alreadyPending : result.reason === "telegram_linked" ? t.alreadyLinked : t.failed, { reply_markup: mainMenu(lang) });
    return;
  }

  await deleteConversationState(state.telegram_id);
  await ctx.reply(t.done(a.operator_manager_name ?? "VOYAGE"), { reply_markup: mainMenu(lang) });
  await notifyOperatorApplication(result.application_id);
}

/* ══════════════════════════════════════════════════════════════════
 * Открытие кабинета и отказ — общие для бота и кабинетов
 * ══════════════════════════════════════════════════════════════════ */

type ApplicationRow = {
  id: string;
  telegram_id: string;
  telegram_username: string | null;
  language: string;
  display_name: string;
  phone: string;
  timezone: string;
  experience: string | null;
  manager_id: string;
  invite_code: string | null;
  status: string;
};

export type OperatorProvisionResult =
  | { ok: true; profileId: string; login: string; delivered: boolean }
  | { ok: false; error: "not_pending" | "forbidden" | "auth_failed" | "provision_failed" };

const LOGIN_DOMAIN = (process.env.VOYAGE_STAFF_LOGIN_DOMAIN || "voyage-models.com").trim().toLowerCase();

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Логин-ник: op-<username|псевдоним>. Вход на /login по нику без домена. */
function loginBase(app: ApplicationRow): string {
  const source = app.telegram_username || app.display_name;
  const slug = source
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `op-${slug || "operator"}`;
}

function newPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
  return Array.from({ length: 20 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
}

/** Создаёт Auth-пользователя оператора и отправляет доступ. actorId — менеджер заявки или owner. */
export async function provisionOperatorAccount(applicationId: string, actorId: string): Promise<OperatorProvisionResult> {
  const db = getTelegramServiceClient();
  const { data, error } = await db.rpc("voyage_claim_operator_application", { p_id: applicationId, p_actor: actorId });
  if (error) {
    console.error("[operator-registration] claim failed", error.code ?? "unknown");
    return { ok: false, error: /forbidden/.test(error.message ?? "") ? "forbidden" : "not_pending" };
  }
  const app = ((Array.isArray(data) ? data[0] : data) ?? null) as ApplicationRow | null;
  if (!app?.id) return { ok: false, error: "not_pending" };

  const release = async (note: string) => {
    const { error: releaseError } = await db.rpc("voyage_release_operator_application", { p_id: app.id, p_note: note });
    if (releaseError) console.error("[operator-registration] release failed", releaseError.code ?? "unknown");
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
      user_metadata: { name: app.display_name, full_name: app.display_name, telegram_id: app.telegram_id, created_by: "operator_telegram_registration" },
    });
    if (created?.user) {
      createdId = created.user.id;
      break;
    }
    const duplicate = /already|registered|exists|duplicate/i.test(createError?.message ?? "") || createError?.code === "email_exists";
    if (!duplicate) {
      console.error("[operator-registration] auth user creation failed", createError?.code ?? "unknown");
      break;
    }
  }
  if (!createdId) {
    await release("auth_failed");
    return { ok: false, error: "auth_failed" };
  }

  const { error: provisionError } = await db.rpc("voyage_provision_operator", {
    p_application: app.id,
    p_profile: createdId,
    p_delivery_id: deliveryId,
    p_login: login,
    p_actor: actorId,
  });
  if (provisionError) {
    console.error("[operator-registration] provision failed", provisionError.code ?? "unknown");
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
      audience: "operator",
    });
    delivered = result.sent;
    if (!result.sent) console.warn("[operator-registration] credentials delivery failed", result.error);
  } catch (sendError) {
    console.error("[operator-registration] credentials delivery threw", sendError instanceof Error ? sendError.name : "unknown");
  }
  return { ok: true, profileId: createdId, login, delivered };
}

export async function rejectOperatorApplication(applicationId: string, actorId: string, note?: string | null): Promise<boolean> {
  const db = getTelegramServiceClient();
  const { data, error } = await db.rpc("voyage_reject_operator_application", { p_id: applicationId, p_actor: actorId, p_note: note ?? null });
  const r = (data ?? {}) as { ok?: boolean; telegram_id?: string; language?: string };
  if (error || !r.ok) {
    if (error) console.error("[operator-registration] reject failed", error.code ?? "unknown");
    return false;
  }
  try {
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    await getVoyageTelegramBot().api.sendMessage(String(r.telegram_id), COPY[langOf(r.language)].rejected);
  } catch (sendError) {
    console.error("[operator-registration] rejection message failed", sendError instanceof Error ? sendError.name : "unknown");
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════════
 * Уведомление менеджеру (+ копия owner) и кнопки «Одобрить / Отклонить»
 * ══════════════════════════════════════════════════════════════════ */

const NOTICE: Record<TelegramLang, {
  title: string; forManager: string; forOwner: (manager: string) => string; name: string; username: string; phone: string; tz: string; exp: string; invite: string;
  approve: string; reject: string; open: string; approved: (login: string) => string; approvedNoDelivery: string; rejected: string; stale: string; forbidden: string; failed: string;
}> = {
  RU: {
    title: "🎧 Новая заявка оператора", forManager: "Оператор регистрируется в вашу команду.", forOwner: (m) => `Копия owner · менеджер: ${m}`,
    name: "Псевдоним", username: "Telegram", phone: "Телефон / WhatsApp", tz: "Часовой пояс", exp: "Опыт", invite: "Инвайт",
    approve: "✅ Одобрить", reject: "✖️ Отклонить", open: "Открыть «Мою команду»",
    approved: (l) => `✅ Одобрено: кабинет оператора открыт (логин ${l}), доступ отправлен в Telegram.`,
    approvedNoDelivery: "✅ Кабинет открыт, но доступ не дошёл в Telegram. Оператор может отправить боту /password.",
    rejected: "✖️ Заявка отклонена, оператор получил уведомление.", stale: "Заявка уже обработана.",
    forbidden: "Решать по этой заявке могут только её менеджер и owner.", failed: "Не удалось открыть кабинет. Попробуйте из кабинета.",
  },
  EN: {
    title: "🎧 New operator application", forManager: "An operator is registering into your team.", forOwner: (m) => `Owner copy · manager: ${m}`,
    name: "Alias", username: "Telegram", phone: "Phone / WhatsApp", tz: "Time zone", exp: "Experience", invite: "Invite",
    approve: "✅ Approve", reject: "✖️ Decline", open: "Open “My team”",
    approved: (l) => `✅ Approved: operator desk open (login ${l}), access sent via Telegram.`,
    approvedNoDelivery: "✅ Desk open, but Telegram delivery failed. The operator can send /password to the bot.",
    rejected: "✖️ Declined, the operator has been notified.", stale: "This application has already been handled.",
    forbidden: "Only this application’s manager and the owner can decide.", failed: "Could not open the desk. Try from the dashboard.",
  },
  ES: {
    title: "🎧 Nueva solicitud de operador", forManager: "Un operador se registra en tu equipo.", forOwner: (m) => `Copia owner · gerente: ${m}`,
    name: "Alias", username: "Telegram", phone: "Teléfono / WhatsApp", tz: "Zona horaria", exp: "Experiencia", invite: "Invitación",
    approve: "✅ Aprobar", reject: "✖️ Rechazar", open: "Abrir «Mi equipo»",
    approved: (l) => `✅ Aprobado: panel abierto (usuario ${l}), acceso enviado por Telegram.`,
    approvedNoDelivery: "✅ Panel abierto, pero el envío por Telegram falló. El operador puede enviar /password.",
    rejected: "✖️ Rechazada, el operador fue avisado.", stale: "Esta solicitud ya fue procesada.",
    forbidden: "Solo el gerente de la solicitud y el owner pueden decidir.", failed: "No se pudo abrir el panel.",
  },
  PT: {
    title: "🎧 Nova solicitação de operador", forManager: "Um operador está se cadastrando na sua equipe.", forOwner: (m) => `Cópia owner · gerente: ${m}`,
    name: "Apelido", username: "Telegram", phone: "Telefone / WhatsApp", tz: "Fuso horário", exp: "Experiência", invite: "Convite",
    approve: "✅ Aprovar", reject: "✖️ Recusar", open: "Abrir «Minha equipe»",
    approved: (l) => `✅ Aprovado: painel aberto (login ${l}), acesso enviado pelo Telegram.`,
    approvedNoDelivery: "✅ Painel aberto, mas o envio pelo Telegram falhou. O operador pode enviar /password.",
    rejected: "✖️ Recusada, o operador foi avisado.", stale: "Esta solicitação já foi processada.",
    forbidden: "Só o gerente da solicitação e o owner podem decidir.", failed: "Não foi possível abrir o painel.",
  },
};

function teamUrl(): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://voyage-models.com").trim();
  try {
    const url = new URL("/partner/team", base.endsWith("/") ? base : `${base}/`);
    return url.protocol === "https:" && url.hostname !== "localhost" ? url.toString() : "https://voyage-models.com/partner/team";
  } catch {
    return "https://voyage-models.com/partner/team";
  }
}

/** Получатели: менеджер заявки (его Telegram) + рабочие чаты owner (НЕ admin). */
async function recipientsFor(app: ApplicationRow): Promise<Array<{ chatId: string; lang: TelegramLang; asOwner: boolean }>> {
  const db = getTelegramServiceClient();
  const out = new Map<string, { chatId: string; lang: TelegramLang; asOwner: boolean }>();
  const { data: manager } = await db.from("profiles").select("id,role,telegram_id,telegram_language").eq("id", app.manager_id).maybeSingle();
  if (manager?.telegram_id && /^[0-9]{4,20}$/.test(String(manager.telegram_id))) {
    out.set(String(manager.telegram_id), { chatId: String(manager.telegram_id), lang: langOf(manager.telegram_language), asOwner: manager.role === "owner" });
  }
  const { data: owners } = await db.from("profiles").select("id,telegram_id,telegram_language").eq("role", "owner");
  const ownerIds = (owners ?? []).map((o) => o.id);
  if (ownerIds.length) {
    const { data: settings } = await db.from("admin_settings")
      .select("admin_id,notifications_tg_id,notify_new_applications,notification_language")
      .in("admin_id", ownerIds)
      .eq("notify_new_applications", true)
      .not("notifications_tg_id", "is", null);
    for (const row of settings ?? []) {
      const chat = String(row.notifications_tg_id ?? "");
      if (/^-?[0-9]{5,20}$/.test(chat) && !out.has(chat)) out.set(chat, { chatId: chat, lang: langOf(row.notification_language), asOwner: true });
    }
    if (!(settings ?? []).length) {
      for (const owner of owners ?? []) {
        const chat = String(owner.telegram_id ?? "");
        if (/^[0-9]{4,20}$/.test(chat) && !out.has(chat)) out.set(chat, { chatId: chat, lang: langOf(owner.telegram_language), asOwner: true });
      }
    }
  }
  return [...out.values()];
}

export async function notifyOperatorApplication(applicationId: string): Promise<void> {
  try {
    const db = getTelegramServiceClient();
    const { data } = await db.from("operator_applications").select("*").eq("id", applicationId).maybeSingle();
    const app = data as ApplicationRow | null;
    if (!app) return;
    const { data: managerName } = await db.rpc("voyage_ops_display_name", { p_profile: app.manager_id });
    const recipients = await recipientsFor(app);
    if (!recipients.length) return;
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    const bot = getVoyageTelegramBot();
    const eventKey = `operator_application:${applicationId}`;

    for (const r of recipients) {
      const claim = await db.rpc("claim_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: r.chatId });
      if (claim.error || claim.data !== true) continue;
      const t = NOTICE[r.lang];
      const lines = [
        `<b>${t.title}</b>`,
        `<i>${escapeHtml(r.asOwner ? t.forOwner(String(managerName ?? "—")) : t.forManager)}</i>`,
        "",
        `${t.name}: <b>${escapeHtml(app.display_name)}</b>`,
        `${t.username}: ${app.telegram_username ? `@${escapeHtml(app.telegram_username)}` : `<code>${escapeHtml(app.telegram_id)}</code>`}`,
        `${t.phone}: ${escapeHtml(app.phone)}`,
        `${t.tz}: ${escapeHtml(app.timezone)}`,
      ];
      if (app.experience) lines.push(`${t.exp}: ${escapeHtml(app.experience)}`);
      if (app.invite_code) lines.push(`${t.invite}: <code>${escapeHtml(app.invite_code)}</code>`);
      const keyboard = new InlineKeyboard()
        .text(t.approve, `oadm:ok:${app.id}`)
        .text(t.reject, `oadm:no:${app.id}`)
        .row()
        .url(t.open, teamUrl());
      try {
        await bot.api.sendMessage(r.chatId, lines.join("\n"), { parse_mode: "HTML", reply_markup: keyboard, link_preview_options: { is_disabled: true } });
        await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: r.chatId, p_status: "sent", p_error: null });
      } catch (sendError) {
        const code = sendError && typeof sendError === "object" && "error_code" in sendError ? String((sendError as { error_code: unknown }).error_code) : "send_failed";
        await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: r.chatId, p_status: "failed", p_error: code });
      }
    }
  } catch (error) {
    console.error("[operator-registration] notification failed", error instanceof Error ? error.name : "unknown");
  }
}

/** «Одобрить / Отклонить» из уведомления. Кто нажал — перепроверяется по базе. */
export async function handleOperatorAdminCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  const match = /^oadm:(ok|no):([0-9a-f-]{36})$/i.exec(data);
  if (!match || !ctx.from) {
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }
  const db = getTelegramServiceClient();
  const telegramId = String(ctx.from.id);
  const [, action, applicationId] = match;

  // Кто нажал: менеджер (по своему Telegram) или owner (по Telegram или рабочему чату).
  const { data: byProfile } = await db.from("profiles")
    .select("id,role,telegram_language")
    .eq("telegram_id", telegramId)
    .in("role", ["owner", "manager"])
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
    const result = await provisionOperatorAccount(applicationId, actorId);
    message = result.ok
      ? (result.delivered ? t.approved(result.login.split("@")[0]) : t.approvedNoDelivery)
      : result.error === "forbidden" ? t.forbidden
      : result.error === "not_pending" ? t.stale
      : t.failed;
  } else {
    const { data: ok } = await db.rpc("voyage_operator_app_actor_ok", { p_app: applicationId, p_actor: actorId });
    message = ok !== true ? t.forbidden : (await rejectOperatorApplication(applicationId, actorId)) ? t.rejected : t.stale;
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
