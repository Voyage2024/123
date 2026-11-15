import "server-only";

import { InlineKeyboard, type Context } from "grammy";
import { copy, mainMenu } from "@/lib/server/telegram/copy";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { getPreferredTelegramLanguage } from "@/lib/server/telegram/preferences";
import { beginRegistration, getConversationState, saveConversationState } from "@/lib/server/telegram/onboarding";
import { isPartnerStage } from "@/lib/server/telegram/partner-registration";
import { isOperatorStage } from "@/lib/server/telegram/operator-registration";
import { isScoutRegStage } from "@/lib/server/telegram/scout-registration";
import { languageFromTelegram, type TelegramLang } from "@/lib/server/telegram/types";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Бот — скаут-ссылки менеджера: /start mod_VYM-XXXX-XXXX
 *
 *   нет профиля  → короткое пояснение «вас пригласил менеджер N» и обычная
 *                  анкета (код живёт в telegram_conversations.referral_code);
 *                  закрепление — в finalizeRegistration (attachScoutAfterRegistration).
 *   есть профиль → кнопки «Да, закрепить» / «Нет»; решение принимает БД
 *                  (voyage_scout_attach_by_code, режим 'existing'):
 *                  свежий аккаунт без туров — сразу, иначе заявка owner.
 *
 * Ссылка не обходит фейс-контроль: анкета остаётся pending до решения клуба.
 * Профиль ищем по telegram_id из апдейта Telegram — чужой профиль так не закрепить.
 * ──────────────────────────────────────────────────────────────────── */

export const SCOUT_INVITE_RE = /^VYM-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export const SCOUT_CALLBACK_RE = /^scout:(yes:VYM-[A-Z0-9]{4}-[A-Z0-9]{4}|no)$/;

export const isScoutCode = (code: string | null | undefined): code is string => typeof code === "string" && SCOUT_INVITE_RE.test(code);

/** mod_<код> → код; null — не скаут-ссылка. */
export function parseScoutPayload(payload: string): string | null {
  const m = /^mod_(VYM-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/i.exec(payload.trim());
  return m ? m[1].toUpperCase() : null;
}

type Preview = { ok: true; managerName: string; isScout: boolean } | { ok: false; reason: string };
type AttachResult = "attached" | "already_yours" | "other_scout" | "claim_pending" | "claim_exists" | "not_a_model" | "invalid" | "expired" | "exhausted" | "manager_inactive" | "failed";

const TEXT: Record<TelegramLang, {
  intro: (m: string) => string;
  confirm: (m: string) => string;
  yes: string;
  no: string;
  declined: string;
  bad: Record<"invalid" | "expired" | "exhausted" | "manager_inactive" | "failed", string>;
  result: Record<"attached" | "already_yours" | "other_scout" | "claim_pending" | "claim_exists" | "not_a_model", (m: string) => string>;
  resume: string;
  otherCode: string;
  /** Ссылку выпустил скаут (роль scout): он не ведёт туры, но видит прогресс модели. */
  introScout: (m: string) => string;
  confirmScout: (m: string) => string;
  attachedScout: (m: string) => string;
}> = {
  RU: {
    intro: (m) => `Вас пригласил менеджер VOYAGE — ${m}.\n\nЗаполните короткую анкету. После одобрения клубом ${m} станет вашим менеджером и сможет лично звать вас в свои туры.`,
    confirm: (m) => `Менеджер ${m} приглашает вас в свою команду моделей.\n\nПосле закрепления он сможет лично приглашать вас в свои туры. Менять менеджера потом может только администрация клуба (owner).\n\nЗакрепиться за ${m}?`,
    yes: "Да, закрепить", no: "Нет, спасибо", declined: "Хорошо, ничего не меняем.",
    bad: {
      invalid: "Ссылка недействительна. Попросите у менеджера новую.",
      expired: "Срок действия ссылки истёк. Попросите у менеджера новую.",
      exhausted: "Лимит этой ссылки исчерпан. Попросите у менеджера новую.",
      manager_inactive: "Этот менеджер сейчас не принимает моделей.",
      failed: "Не получилось проверить ссылку. Попробуйте позже.",
    },
    result: {
      attached: (m) => `Готово: вы закреплены за менеджером ${m}. Его личные приглашения в туры придут сюда и в кабинет.`,
      already_yours: (m) => `Вы уже закреплены за менеджером ${m}.`,
      other_scout: () => "Вы уже закреплены за другим менеджером. Сменить менеджера может только администрация клуба.",
      claim_pending: (m) => `Заявка на закрепление за ${m} отправлена администрации клуба. Мы сообщим о решении.`,
      claim_exists: () => "Заявка на закрепление уже на рассмотрении у администрации клуба.",
      not_a_model: () => "Скаут-ссылки — только для профилей моделей.",
    },
    resume: "Продолжаем анкету — ссылка менеджера сохранена.",
    otherCode: "Анкета уже начата по другому приглашению. Завершите её или нажмите «Отмена» и откройте ссылку снова.",
    introScout: (m) => `Вас пригласил скаут VOYAGE — ${m}.\n\nЗаполните короткую анкету. После одобрения клубом ${m} будет видеть ваш путь в клубе (этапы проверки и туры, без документов и личных данных) и подскажет, что сделать, чтобы попасть в тур.`,
    confirmScout: (m) => `Скаут ${m} приглашает вас в свою команду моделей.\n\nСкаут не ведёт туры сам: он видит только этапы вашей проверки и туры (без документов, заработка и личных данных) и помогает пройти путь до тура. Сменить скаута потом может только администрация клуба (owner).\n\nЗакрепиться за ${m}?`,
    attachedScout: (m) => `Готово: вы в команде скаута ${m}. Подсказки по следующим шагам придут сюда.`,
  },
  EN: {
    intro: (m) => `You were invited by a VOYAGE manager — ${m}.\n\nFill in a short application. Once the club approves it, ${m} becomes your manager and can invite you to their tours directly.`,
    confirm: (m) => `Manager ${m} invites you to join their model roster.\n\nOnce attached, they can invite you to their tours directly. Only the club administration (owner) can change your manager later.\n\nAttach to ${m}?`,
    yes: "Yes, attach", no: "No, thanks", declined: "Okay, nothing changes.",
    bad: {
      invalid: "This link is not valid. Ask the manager for a new one.",
      expired: "This link has expired. Ask the manager for a new one.",
      exhausted: "This link has reached its limit. Ask the manager for a new one.",
      manager_inactive: "This manager isn’t taking new models right now.",
      failed: "Couldn’t check the link. Please try again later.",
    },
    result: {
      attached: (m) => `Done: you are attached to ${m}. Their personal tour invites will arrive here and in your cabinet.`,
      already_yours: (m) => `You are already attached to ${m}.`,
      other_scout: () => "You are already attached to another manager. Only the club administration can change that.",
      claim_pending: (m) => `Your request to attach to ${m} was sent to the club administration. We’ll let you know.`,
      claim_exists: () => "An attachment request is already under review.",
      not_a_model: () => "Scout links are for model profiles only.",
    },
    resume: "Let’s continue your application — the manager’s link is saved.",
    otherCode: "Your application was started with another invite. Finish it or press Cancel and open the link again.",
    introScout: (m) => `You were invited by a VOYAGE scout — ${m}.\n\nFill in a short application. Once the club approves it, ${m} will see your progress in the club (review steps and tours, never your documents or private data) and will tell you what to do next to get into a tour.`,
    confirmScout: (m) => `Scout ${m} invites you to join their model roster.\n\nA scout doesn’t run tours: they only see your review steps and tours (no documents, earnings or private data) and help you get to a tour. Only the club administration (owner) can change your scout later.\n\nAttach to ${m}?`,
    attachedScout: (m) => `Done: you are in scout ${m}’s roster. Tips on your next steps will arrive here.`,
  },
  ES: {
    intro: (m) => `Te invitó un gerente de VOYAGE: ${m}.\n\nCompleta una breve solicitud. Cuando el club la apruebe, ${m} será tu gerente y podrá invitarte directamente a sus tours.`,
    confirm: (m) => `El gerente ${m} te invita a su equipo de modelos.\n\nUna vez vinculada, podrá invitarte directamente a sus tours. Solo la administración del club (owner) puede cambiar tu gerente después.\n\n¿Vincularte con ${m}?`,
    yes: "Sí, vincular", no: "No, gracias", declined: "De acuerdo, no cambiamos nada.",
    bad: {
      invalid: "El enlace no es válido. Pide uno nuevo al gerente.",
      expired: "El enlace ha caducado. Pide uno nuevo al gerente.",
      exhausted: "El enlace alcanzó su límite. Pide uno nuevo al gerente.",
      manager_inactive: "Este gerente no acepta modelos ahora.",
      failed: "No pudimos comprobar el enlace. Inténtalo más tarde.",
    },
    result: {
      attached: (m) => `Listo: estás vinculada con ${m}. Sus invitaciones a tours llegarán aquí y a tu cabina.`,
      already_yours: (m) => `Ya estás vinculada con ${m}.`,
      other_scout: () => "Ya estás vinculada con otro gerente. Solo la administración del club puede cambiarlo.",
      claim_pending: (m) => `Tu solicitud para vincularte con ${m} se envió a la administración del club.`,
      claim_exists: () => "Ya hay una solicitud de vínculo en revisión.",
      not_a_model: () => "Los enlaces de scout son solo para perfiles de modelo.",
    },
    resume: "Seguimos con tu solicitud: el enlace del gerente quedó guardado.",
    otherCode: "Tu solicitud empezó con otra invitación. Termínala o pulsa Cancelar y abre el enlace de nuevo.",
    introScout: (m) => `Te invitó un scout de VOYAGE — ${m}.\n\nCompleta una solicitud corta. Tras la aprobación del club, ${m} verá tu progreso (etapas de verificación y tours, sin documentos ni datos privados) y te dirá qué hacer para entrar en un tour.`,
    confirmScout: (m) => `${m} (scout) te invita a su equipo de modelos.\n\nUn scout no organiza tours: solo ve tus etapas de verificación y tours (sin documentos, ingresos ni datos privados). Solo el owner puede cambiar tu scout después.\n\n¿Vincularte con ${m}?`,
    attachedScout: (m) => `Listo: estás en el equipo de ${m}. Aquí recibirás consejos sobre los siguientes pasos.`,
  },
  PT: {
    intro: (m) => `Você foi convidada por um gerente da VOYAGE: ${m}.\n\nPreencha uma breve inscrição. Quando o clube aprovar, ${m} será seu gerente e poderá convidá-la diretamente para os tours dele.`,
    confirm: (m) => `O gerente ${m} convida você para a equipe de modelos dele.\n\nDepois do vínculo, ele poderá convidá-la diretamente para os tours. Só a administração do clube (owner) pode trocar seu gerente depois.\n\nVincular-se a ${m}?`,
    yes: "Sim, vincular", no: "Não, obrigada", declined: "Certo, nada muda.",
    bad: {
      invalid: "O link não é válido. Peça um novo ao gerente.",
      expired: "O link expirou. Peça um novo ao gerente.",
      exhausted: "O link atingiu o limite. Peça um novo ao gerente.",
      manager_inactive: "Este gerente não está aceitando modelos agora.",
      failed: "Não conseguimos verificar o link. Tente mais tarde.",
    },
    result: {
      attached: (m) => `Pronto: você está vinculada a ${m}. Os convites dele para tours chegarão aqui e no seu painel.`,
      already_yours: (m) => `Você já está vinculada a ${m}.`,
      other_scout: () => "Você já está vinculada a outro gerente. Só a administração do clube pode mudar isso.",
      claim_pending: (m) => `Seu pedido de vínculo com ${m} foi enviado à administração do clube.`,
      claim_exists: () => "Já há um pedido de vínculo em análise.",
      not_a_model: () => "Links de scout são apenas para perfis de modelo.",
    },
    resume: "Vamos continuar sua inscrição — o link do gerente foi salvo.",
    otherCode: "Sua inscrição começou com outro convite. Termine-a ou toque em Cancelar e abra o link de novo.",
    introScout: (m) => `Você foi convidada por um scout VOYAGE — ${m}.\n\nPreencha uma solicitação curta. Após a aprovação do clube, ${m} verá seu progresso (etapas de verificação e tours, sem documentos nem dados privados) e dirá o que fazer para entrar num tour.`,
    confirmScout: (m) => `${m} (scout) convida você para a equipe de modelos.\n\nUm scout não organiza tours: só vê suas etapas de verificação e tours (sem documentos, ganhos ou dados privados). Só o owner pode trocar seu scout depois.\n\nVincular-se a ${m}?`,
    attachedScout: (m) => `Pronto: você está na equipe de ${m}. As dicas dos próximos passos chegarão aqui.`,
  },
};

async function preview(code: string): Promise<Preview> {
  const { data, error } = await getTelegramServiceClient().rpc("voyage_scout_invite_preview", { p_code: code });
  if (error || !data) {
    console.error("[telegram-webhook] scout invite preview failed", error?.code ?? "unknown");
    return { ok: false, reason: "failed" };
  }
  const r = data as { ok?: boolean; reason?: string; manager_name?: string; manager_id?: string };
  if (!r.ok) return { ok: false, reason: String(r.reason ?? "invalid") };
  // Кто выпустил ссылку: скаут (роль scout) или менеджер — от этого зависит текст для модели.
  let isScout = false;
  if (r.manager_id) {
    const { data: issuer } = await getTelegramServiceClient().from("profiles").select("role").eq("id", r.manager_id).maybeSingle();
    isScout = String(issuer?.role ?? "") === "scout";
  }
  return { ok: true, managerName: String(r.manager_name ?? "VOYAGE"), isScout };
}

async function attach(code: string, profileId: string, mode: "new" | "existing"): Promise<{ result: AttachResult; managerName: string }> {
  const { data, error } = await getTelegramServiceClient().rpc("voyage_scout_attach_by_code", { p_code: code, p_profile: profileId, p_mode: mode });
  if (error || !data) {
    console.error("[telegram-webhook] scout attach failed", error?.code ?? "unknown");
    return { result: "failed", managerName: "" };
  }
  const r = data as { result?: string; manager_name?: string };
  return { result: (r.result ?? "failed") as AttachResult, managerName: String(r.manager_name ?? "") };
}

function resultText(lang: TelegramLang, r: { result: AttachResult; managerName: string }, isScout = false): string {
  const t = TEXT[lang];
  if (r.result === "attached" && isScout) return t.attachedScout(r.managerName || "VOYAGE");
  if (r.result in t.result) return t.result[r.result as keyof typeof t.result](r.managerName || "VOYAGE");
  return t.bad[(r.result in t.bad ? r.result : "failed") as keyof typeof t.bad];
}

/** /start mod_VYM-… */
export async function handleScoutStart(ctx: Context, lang: TelegramLang, code: string): Promise<void> {
  if (!ctx.from) return;
  const t = TEXT[lang];
  const p = await preview(code);
  if (!p.ok) {
    await ctx.reply(t.bad[(p.reason in t.bad ? p.reason : "invalid") as keyof typeof t.bad], { reply_markup: mainMenu(lang) });
    return;
  }
  const telegramId = String(ctx.from.id);
  const { data: profile } = await getTelegramServiceClient().from("profiles").select("id,role").eq("telegram_id", telegramId).maybeSingle();

  if (profile) {
    if (String(profile.role) !== "resident") {
      await ctx.reply(t.result.not_a_model(""), { reply_markup: mainMenu(lang) });
      return;
    }
    const kb = new InlineKeyboard().text(t.yes, `scout:yes:${code}`).row().text(t.no, "scout:no");
    await ctx.reply(p.isScout ? t.confirmScout(p.managerName) : t.confirm(p.managerName), { reply_markup: kb });
    return;
  }

  // Нет профиля: анкета. Начатую анкету не теряем — дописываем код, если его не было.
  const current = await getConversationState(telegramId);
  if (current && (isPartnerStage(current.stage) || isOperatorStage(current.stage) || isScoutRegStage(current.stage))) {
    await ctx.reply(t.otherCode, { reply_markup: mainMenu(lang) });
    return;
  }
  if (current) {
    if (current.referral_code && current.referral_code !== code) {
      await ctx.reply(t.otherCode, { reply_markup: mainMenu(lang) });
      return;
    }
    await saveConversationState({ ...current, referral_code: code, telegram_username: ctx.from.username ?? current.telegram_username ?? null });
    const c = copy(current.telegram_language);
    const prompt = current.stage === "photos" ? c.onboarding.sendPhoto : c.prompts[current.stage as keyof typeof c.prompts];
    await ctx.reply(`${t.resume}\n\n${prompt ?? c.welcome}`, { reply_markup: mainMenu(lang) });
    return;
  }
  await ctx.reply(p.isScout ? t.introScout(p.managerName) : t.intro(p.managerName));
  await beginRegistration(ctx, lang, code);
}

/** Кнопки «Да, закрепить» / «Нет» */
export async function handleScoutCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data ?? "";
  if (!ctx.from || !SCOUT_CALLBACK_RE.test(data)) {
    await ctx.answerCallbackQuery();
    return;
  }
  const lang = await getPreferredTelegramLanguage(String(ctx.from.id), ctx.from.language_code).catch(() => languageFromTelegram(ctx.from?.language_code));
  const t = TEXT[lang];
  await ctx.answerCallbackQuery();
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => undefined);
  if (data === "scout:no") {
    await ctx.reply(t.declined, { reply_markup: mainMenu(lang) });
    return;
  }
  const code = data.slice("scout:yes:".length);
  const { data: profile } = await getTelegramServiceClient().from("profiles").select("id").eq("telegram_id", String(ctx.from.id)).maybeSingle();
  if (!profile) {
    await ctx.reply(t.bad.failed, { reply_markup: mainMenu(lang) });
    return;
  }
  const issuer = await preview(code);
  const r = await attach(code, String(profile.id), "existing");
  await ctx.reply(resultText(lang, r, issuer.ok && issuer.isScout), { reply_markup: mainMenu(lang) });
}

/**
 * Вызывается из finalizeRegistration сразу после создания профиля.
 * Не фатально: если ссылка за время анкеты истекла — профиль остаётся,
 * модель просто не закреплена (owner может закрепить вручную).
 */
export async function attachScoutAfterRegistration(ctx: Context, lang: TelegramLang, code: string, profileId: string): Promise<void> {
  const issuer = await preview(code);
  const r = await attach(code, profileId, "new");
  if (r.result === "attached") await ctx.reply(resultText(lang, r, issuer.ok && issuer.isScout)).catch(() => undefined);
  else console.warn("[telegram-webhook] scout attach after registration", r.result);
}
