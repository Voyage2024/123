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

/* ── Общая доставка в рабочий чат ──────────────────────────────────────
 * Получатели — те же, что у уведомлений о новых регистрациях:
 * admin_settings.notifications_tg_id (личный id или id группы, «-100…»)
 * с включённым notify_new_applications, только у текущих owner/admin.
 * Бот — тот же TELEGRAM_BOT_TOKEN. Дубли отсекает claim_admin_telegram_notification
 * по (event_key, chat_id): одно событие — одно сообщение в каждый чат.
 * ──────────────────────────────────────────────────────────────────── */

type AdminButton = { text: string; url: string };
type AdminNotice = { text: string; buttons: AdminButton[] };

async function resolveAdminRecipients(db: ReturnType<typeof getTelegramServiceClient>): Promise<Map<string, TelegramLang>> {
  const recipients = new Map<string, TelegramLang>();
  const { data: settings, error: settingsError } = await db.from("admin_settings")
    .select("admin_id,notifications_tg_id,notify_new_applications,notification_language")
    .eq("notify_new_applications", true)
    .not("notifications_tg_id", "is", null);
  if (settingsError) throw settingsError;
  const configured = (settings ?? []).filter((row) => typeof row.notifications_tg_id === "string" && /^-?[0-9]{5,20}$/.test(row.notifications_tg_id));
  if (!configured.length) return recipients;
  const adminIds = Array.from(new Set(configured.map((row) => row.admin_id)));
  const { data: profiles, error: profilesError } = await db.from("profiles").select("id,role").in("id", adminIds);
  if (profilesError) throw profilesError;
  const allowed = new Set((profiles ?? []).filter((row) => row.role === "owner" || row.role === "admin").map((row) => row.id));
  for (const row of configured) {
    if (!allowed.has(row.admin_id)) continue;
    const chatId = String(row.notifications_tg_id);
    if (!recipients.has(chatId)) recipients.set(chatId, (["EN", "RU", "ES", "PT"].includes(String(row.notification_language)) ? row.notification_language : "EN") as TelegramLang);
  }
  return recipients;
}

/** Абсолютная ссылка на сайт; без NEXT_PUBLIC_SITE_URL кнопок не будет (Telegram требует полный https-адрес). */
function siteUrl(path: string): string | null {
  const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").trim();
  if (!siteBase) return null;
  try {
    return new URL(path, siteBase).toString();
  } catch {
    return null;
  }
}

async function deliverAdminNotice(eventKey: string, build: (lang: TelegramLang) => AdminNotice, logTag: string): Promise<void> {
  try {
    const db = getTelegramServiceClient();
    const recipients = await resolveAdminRecipients(db);
    if (!recipients.size) {
      console.info(`[${logTag}] no recipients configured`, { eventKey });
      return;
    }
    // Dynamic import avoids a circular import: onboarding handlers are installed by bot.ts.
    const { getVoyageTelegramBot } = await import("@/lib/server/telegram/runtime");
    const bot = getVoyageTelegramBot();
    for (const [chatId, lang] of recipients) {
      const claimResult = await db.rpc("claim_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: chatId });
      if (claimResult.error) {
        console.error(`[${logTag}] delivery claim failed`, { code: claimResult.error.code, eventKey });
        continue;
      }
      if (claimResult.data !== true) continue;
      const notice = build(lang);
      try {
        let keyboard: InlineKeyboard | undefined;
        for (const button of notice.buttons) {
          keyboard = (keyboard ? keyboard.row() : new InlineKeyboard()).url(button.text, button.url);
        }
        await bot.api.sendMessage(chatId, notice.text, {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          ...(keyboard ? { reply_markup: keyboard } : {}),
        });
        const { error: finishError } = await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: chatId, p_status: "sent", p_error: null });
        if (finishError) console.error(`[${logTag}] sent status update failed`, { code: finishError.code, eventKey });
      } catch (error) {
        const code = error && typeof error === "object" && "error_code" in error ? String((error as { error_code: unknown }).error_code) : error instanceof Error ? error.name : "send_failed";
        await db.rpc("finish_admin_telegram_notification", { p_event_key: eventKey, p_recipient_chat_id: chatId, p_status: "failed", p_error: code });
        console.error(`[${logTag}] Telegram delivery failed`, { eventKey, recipient: chatId, code });
      }
    }
  } catch (error) {
    console.error(`[${logTag}] notification pipeline failed`, error instanceof Error ? error.name : "unknown");
  }
}

/** Notify each opted-in current owner/admin once per event. Errors never block signup/KYC. */
export async function notifyAdminsOfNewRegistration(input: RegistrationNotice): Promise<void> {
  const resolvedSource = sourceLabel(input.source, null);
  const destination = siteUrl(input.profileId ? `/admin/database/${input.profileId}` : "/admin/requests");
  await deliverAdminNotice(input.eventKey, (lang) => {
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
    return {
      text: lines.join("\n"),
      buttons: destination ? [{ text: input.profileId ? t.openDossier : t.openApplications, url: destination }] : [],
    };
  }, "admin-telegram-notify");
}

/* ── KYC и консьерж ───────────────────────────────────────────────── */

export type ReviewPerson = {
  profileId: string;
  fullName: string | null;
  email?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  location?: string | null;
  citizenship?: string | null;
  kycLevel?: number | null;
  segment?: string | null;
};

type ReviewKind = "kyc1" | "kyc2" | "kyc3" | "concierge";

const REVIEW_COPY: Record<TelegramLang, {
  header: Record<ReviewKind, string>;
  lead: Record<ReviewKind, string>;
  person: string; name: string; email: string; telegram: string; location: string; citizenship: string;
  kyc: string; segment: string; details: string; file: string; request: string; category: string; stage: string;
  desired: string; openCard: string; openConcierge: string; noName: string;
  categories: Record<string, string>; stages: Record<string, string>;
}> = {
  RU: {
    header: { kyc1: "[KYC 1: Паспорт]", kyc2: "[KYC 2: Видео]", kyc3: "[KYC 3: Встреча с консьержем]", concierge: "[КОНСЬЕРЖ-ЗАПРОС]" },
    lead: {
      kyc1: "Резидентка загрузила паспорт. Нужна проверка.",
      kyc2: "Резидентка загрузила верификационное видео. Нужна проверка.",
      kyc3: "Заявка на личную встречу с консьержем.",
      concierge: "Новое обращение к консьержу.",
    },
    person: "Резидентка", name: "Имя", email: "Email", telegram: "Telegram", location: "Город", citizenship: "Гражданство",
    kyc: "Текущий KYC", segment: "Сегмент", details: "Детали", file: "Файл", request: "Тема", category: "Категория", stage: "Этап",
    desired: "Желаемая дата", openCard: "Открыть анкету", openConcierge: "Открыть консьерж", noName: "Без имени",
    categories: { travel: "Билеты и перелёты", accommodation: "Проживание", transport: "Трансфер", event: "Мероприятие", documents: "Документы", general: "Общий вопрос" },
    stages: { before_tour: "До тура", during_tour: "Во время тура", after_tour: "После тура" },
  },
  EN: {
    header: { kyc1: "[KYC 1: Passport]", kyc2: "[KYC 2: Video]", kyc3: "[KYC 3: Concierge meeting]", concierge: "[CONCIERGE REQUEST]" },
    lead: {
      kyc1: "A resident uploaded her passport. Review needed.",
      kyc2: "A resident uploaded her verification video. Review needed.",
      kyc3: "Request for a personal meeting with the concierge.",
      concierge: "New concierge request.",
    },
    person: "Resident", name: "Name", email: "Email", telegram: "Telegram", location: "City", citizenship: "Citizenship",
    kyc: "Current KYC", segment: "Segment", details: "Details", file: "File", request: "Subject", category: "Category", stage: "Stage",
    desired: "Desired date", openCard: "Open profile", openConcierge: "Open concierge", noName: "No name",
    categories: { travel: "Tickets & flights", accommodation: "Accommodation", transport: "Transfer", event: "Event", documents: "Documents", general: "General" },
    stages: { before_tour: "Before tour", during_tour: "During tour", after_tour: "After tour" },
  },
  ES: {
    header: { kyc1: "[KYC 1: Pasaporte]", kyc2: "[KYC 2: Vídeo]", kyc3: "[KYC 3: Cita con el conserje]", concierge: "[SOLICITUD AL CONSERJE]" },
    lead: {
      kyc1: "Una residente subió su pasaporte. Hay que revisarlo.",
      kyc2: "Una residente subió su vídeo de verificación. Hay que revisarlo.",
      kyc3: "Solicitud de reunión personal con el conserje.",
      concierge: "Nueva solicitud al conserje.",
    },
    person: "Residente", name: "Nombre", email: "Correo", telegram: "Telegram", location: "Ciudad", citizenship: "Nacionalidad",
    kyc: "KYC actual", segment: "Segmento", details: "Detalles", file: "Archivo", request: "Asunto", category: "Categoría", stage: "Etapa",
    desired: "Fecha deseada", openCard: "Abrir ficha", openConcierge: "Abrir conserje", noName: "Sin nombre",
    categories: { travel: "Billetes y vuelos", accommodation: "Alojamiento", transport: "Traslado", event: "Evento", documents: "Documentos", general: "General" },
    stages: { before_tour: "Antes del tour", during_tour: "Durante el tour", after_tour: "Después del tour" },
  },
  PT: {
    header: { kyc1: "[KYC 1: Passaporte]", kyc2: "[KYC 2: Vídeo]", kyc3: "[KYC 3: Encontro com o concierge]", concierge: "[PEDIDO AO CONCIERGE]" },
    lead: {
      kyc1: "Uma residente enviou o passaporte. Precisa de revisão.",
      kyc2: "Uma residente enviou o vídeo de verificação. Precisa de revisão.",
      kyc3: "Pedido de encontro pessoal com o concierge.",
      concierge: "Novo pedido ao concierge.",
    },
    person: "Residente", name: "Nome", email: "E-mail", telegram: "Telegram", location: "Cidade", citizenship: "Cidadania",
    kyc: "KYC atual", segment: "Segmento", details: "Detalhes", file: "Arquivo", request: "Assunto", category: "Categoria", stage: "Etapa",
    desired: "Data desejada", openCard: "Abrir ficha", openConcierge: "Abrir concierge", noName: "Sem nome",
    categories: { travel: "Passagens e voos", accommodation: "Hospedagem", transport: "Traslado", event: "Evento", documents: "Documentos", general: "Geral" },
    stages: { before_tour: "Antes do tour", during_tour: "Durante o tour", after_tour: "Depois do tour" },
  },
};

const ICON: Record<ReviewKind, string> = { kyc1: "🪪", kyc2: "🎥", kyc3: "🤝", concierge: "🛎" };

function clip(value: string, max: number): string {
  const clean = value.replace(/\r\n/g, "\n").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function personLines(t: (typeof REVIEW_COPY)[TelegramLang], p: ReviewPerson): string[] {
  const lines = [`👤 <b>${escapeHtml(p.fullName?.trim() || t.noName)}</b>`];
  if (p.email) lines.push(`${escapeHtml(t.email)}: ${escapeHtml(p.email)}`);
  const tgUser = p.telegramUsername ? `@${String(p.telegramUsername).replace(/^@/, "")}` : null;
  if (tgUser || p.telegramId) {
    lines.push(`${escapeHtml(t.telegram)}: ${[tgUser ? escapeHtml(tgUser) : null, p.telegramId ? `<code>${escapeHtml(p.telegramId)}</code>` : null].filter(Boolean).join(" · ")}`);
  }
  if (p.location) lines.push(`${escapeHtml(t.location)}: ${escapeHtml(p.location)}`);
  if (p.citizenship) lines.push(`${escapeHtml(t.citizenship)}: ${escapeHtml(p.citizenship)}`);
  const meta = [
    typeof p.kycLevel === "number" ? `${escapeHtml(t.kyc)}: ${p.kycLevel}/3` : null,
    p.segment ? `${escapeHtml(t.segment)}: ${escapeHtml(String(p.segment).toUpperCase())}` : null,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));
  return lines;
}

function formatDate(iso: string | null | undefined, lang: TelegramLang): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const locale = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-PT" }[lang];
  return date.toLocaleString(locale, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

/** KYC 1 (паспорт) или KYC 2 (видео): файл загружен и ждёт проверки. */
export async function notifyAdminsOfKycSubmission(input: {
  submissionId: string;
  level: 1 | 2;
  person: ReviewPerson;
  mimeType?: string | null;
  sizeBytes?: number | null;
}): Promise<void> {
  const kind: ReviewKind = input.level === 1 ? "kyc1" : "kyc2";
  const card = siteUrl(`/admin/database/${input.person.profileId}`);
  await deliverAdminNotice(`kyc:${input.submissionId}`, (lang) => {
    const t = REVIEW_COPY[lang];
    const size = typeof input.sizeBytes === "number" && input.sizeBytes > 0 ? `${(input.sizeBytes / 1024 / 1024).toFixed(1)} MB` : null;
    const file = [input.mimeType, size].filter(Boolean).join(" · ");
    const lines = [
      `📌 <b>${escapeHtml(t.header[kind])}</b> ${ICON[kind]}`,
      "",
      ...personLines(t, input.person),
      "",
      `💬 ${escapeHtml(t.lead[kind])}`,
    ];
    if (file) lines.push(`${escapeHtml(t.file)}: ${escapeHtml(file)}`);
    return { text: lines.join("\n"), buttons: card ? [{ text: `🔗 ${t.openCard}`, url: card }] : [] };
  }, "admin-kyc-notify");
}

/**
 * Новое обращение к консьержу. Заявка «[KYC 3] …» приходит с заголовком KYC 3
 * и двумя кнопками: анкета резидентки и раздел консьержа.
 */
export async function notifyAdminsOfConciergeRequest(input: {
  requestId: string;
  title: string;
  category: string;
  tripStage?: string | null;
  desiredAt?: string | null;
  message: string;
  isKyc3: boolean;
  person: ReviewPerson;
}): Promise<void> {
  const kind: ReviewKind = input.isKyc3 ? "kyc3" : "concierge";
  const card = siteUrl(`/admin/database/${input.person.profileId}`);
  const concierge = siteUrl("/admin/concierge");
  await deliverAdminNotice(`concierge:${input.requestId}`, (lang) => {
    const t = REVIEW_COPY[lang];
    const title = input.isKyc3 ? input.title.replace(/^\s*\[KYC 3\]\s*/i, "") : input.title;
    const lines = [
      `📌 <b>${escapeHtml(t.header[kind])}</b> ${ICON[kind]}`,
      "",
      ...personLines(t, input.person),
      "",
      `💬 ${escapeHtml(t.lead[kind])}`,
      `${escapeHtml(t.request)}: <b>${escapeHtml(clip(title, 120))}</b>`,
    ];
    if (!input.isKyc3) {
      lines.push(`${escapeHtml(t.category)}: ${escapeHtml(t.categories[input.category] ?? input.category)}`);
      if (input.tripStage) lines.push(`${escapeHtml(t.stage)}: ${escapeHtml(t.stages[input.tripStage] ?? input.tripStage)}`);
    }
    const desired = formatDate(input.desiredAt, lang);
    if (desired) lines.push(`${escapeHtml(t.desired)}: ${escapeHtml(desired)}`);
    lines.push("", `<blockquote>${escapeHtml(clip(input.message, 900))}</blockquote>`);
    const buttons: AdminButton[] = [];
    if (input.isKyc3 && card) buttons.push({ text: `🔗 ${t.openCard}`, url: card });
    if (concierge) buttons.push({ text: `🛎 ${t.openConcierge}`, url: concierge });
    if (!input.isKyc3 && card) buttons.push({ text: `👤 ${t.openCard}`, url: card });
    return { text: lines.join("\n"), buttons };
  }, "admin-concierge-notify");
}

export function normalizeRegistrationSource(source?: string | null, utmSource?: string | null): RegistrationSource {
  return sourceLabel(source ?? "landing", utmSource);
}
