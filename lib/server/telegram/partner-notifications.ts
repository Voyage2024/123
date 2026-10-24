import "server-only";

import { Bot, InlineKeyboard, type Context } from "grammy";
import { getTelegramServiceClient } from "@/lib/server/telegram/service-client";
import { getPreferredTelegramLanguage } from "@/lib/server/telegram/preferences";
import type { TelegramLang } from "@/lib/server/telegram/types";
import { projectLabels, toProjectKey, type ProjectKey } from "@/lib/project-types";

type JsonRecord = Record<string, unknown>;
type NotificationRow = JsonRecord & {
  id: string;
  recipient_id: string;
  template: string;
  payload: JsonRecord | null;
  status: string;
  attempts: number | null;
};

type DrainOptions = {
  /** Set for a scheduled/polling invocation so failed rows are retried. */
  includeFailed?: boolean;
  /** Prioritize the row whose INSERT invoked the Database Webhook. */
  notificationId?: string;
  limit?: number;
};

export type DrainSummary = {
  selected: number;
  sent: number;
  skipped: number;
  failed: number;
  busy: number;
};

const locallyProcessing = new Set<string>();
const MAX_ATTEMPTS = 3;
/** 'sending' — строку забрал этот обработчик (voyage_claim_partner_notification) */
const ACTIVE_STATUSES = ["queued", "sending", "failed"];
const DEFAULT_BATCH_SIZE = 25;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function valueText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const text = valueText(value);
    if (text) return text;
  }
  return "";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function siteBaseUrl(): URL {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").trim();
  if (!raw) throw new Error("NEXT_PUBLIC_SITE_URL or SITE_URL is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Site URL must use HTTPS");
  }
  return url;
}

function safeHttpsUrl(value: unknown): string | null {
  const raw = valueText(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const text = {
  EN: {
    contractRequest: "A contract is ready for your review.",
    contractReminder: "Reminder: your tour contract has not been signed yet.",
    docsReminder: "Please upload the documents required for your tour.",
    kycApproved: "Your VOYAGE verification is complete. Your resident cabinet is available.",
    accessLink: "Use this secure, one-time link to access VOYAGE. It expires soon and should not be shared.",
    sign: "Sign contract",
    openVoyage: "Open in Voyage",
    uploadDocs: "Upload documents",
    openCabinet: "Open cabinet",
    login: "Sign in",
    contract: "Contract",
    city: "City",
    project: "Project",
    departure: "Departure",
    flight: "Flight paid by",
    hotel: "Hotel paid by",
    fee: "Fee",
    split: "Fee split",
    cancellation: "Free cancellation window",
    hours: "hours",
    payer: { manager: "manager", participant: "participant", split: "shared" },
    outdated: "The contract terms have changed. Please review the latest version below before signing.",
    missingContract: "I could not verify the current contract version. Please open the tour room in Voyage.",
    signed: "The current contract version has been signed.",
    alreadySigned: "This contract version has already been signed.",
    notAllowed: "This signature link is not valid for this account.",
    signFailed: "The signature could not be saved. Please try again later.",
  },
  RU: {
    contractRequest: "Договор готов к ознакомлению и подписанию.",
    contractReminder: "Напоминание: договор тура ещё не подписан.",
    docsReminder: "Пожалуйста, загрузите документы, необходимые для тура.",
    kycApproved: "Верификация VOYAGE завершена. Ваш личный кабинет резидента доступен.",
    accessLink: "Используйте эту одноразовую защищённую ссылку для входа в VOYAGE. Она скоро истечёт. Не передавайте её другим.",
    sign: "Подписать",
    openVoyage: "Открыть в Voyage",
    uploadDocs: "Загрузить документы",
    openCabinet: "Открыть кабинет",
    login: "Войти",
    contract: "Договор",
    city: "Город",
    project: "Проект",
    departure: "Вылет",
    flight: "Перелёт оплачивает",
    hotel: "Отель оплачивает",
    fee: "Стоимость",
    split: "Распределение стоимости",
    cancellation: "Бесплатная отмена в течение",
    hours: "ч",
    payer: { manager: "менеджер", participant: "участница", split: "совместно" },
    outdated: "Условия договора изменились. Перед подписанием ознакомьтесь с актуальной версией ниже.",
    missingContract: "Не удалось проверить актуальную версию договора. Откройте комнату тура в Voyage.",
    signed: "Актуальная версия договора подписана.",
    alreadySigned: "Эта версия договора уже подписана.",
    notAllowed: "Эта ссылка на подписание не предназначена для данного аккаунта.",
    signFailed: "Не удалось сохранить подпись. Попробуйте позже.",
  },
  ES: {
    contractRequest: "El contrato está listo para revisar y firmar.",
    contractReminder: "Recordatorio: aún no has firmado el contrato del viaje.",
    docsReminder: "Sube los documentos necesarios para tu viaje.",
    kycApproved: "Tu verificación de VOYAGE está completa. Tu espacio de residente está disponible.",
    accessLink: "Usa este enlace seguro de un solo uso para acceder a VOYAGE. Caduca pronto y no debe compartirse.",
    sign: "Firmar contrato",
    openVoyage: "Abrir en Voyage",
    uploadDocs: "Subir documentos",
    openCabinet: "Abrir espacio",
    login: "Entrar",
    contract: "Contrato",
    city: "Ciudad",
    project: "Proyecto",
    departure: "Salida",
    flight: "Vuelo pagado por",
    hotel: "Hotel pagado por",
    fee: "Tarifa",
    split: "Reparto de la tarifa",
    cancellation: "Cancelación gratuita durante",
    hours: "h",
    payer: { manager: "manager", participant: "participante", split: "compartido" },
    outdated: "Las condiciones del contrato han cambiado. Revisa la versión más reciente antes de firmar.",
    missingContract: "No se pudo verificar la versión actual. Abre la sala del viaje en Voyage.",
    signed: "Se ha firmado la versión actual del contrato.",
    alreadySigned: "Esta versión del contrato ya está firmada.",
    notAllowed: "Este enlace de firma no corresponde a esta cuenta.",
    signFailed: "No se pudo guardar la firma. Inténtalo más tarde.",
  },
  PT: {
    contractRequest: "O contrato está pronto para análise e assinatura.",
    contractReminder: "Lembrete: você ainda não assinou o contrato da viagem.",
    docsReminder: "Envie os documentos necessários para a sua viagem.",
    kycApproved: "Sua verificação VOYAGE foi concluída. Sua área de residente está disponível.",
    accessLink: "Use este link seguro e de uso único para acessar o VOYAGE. Ele expira em breve e não deve ser compartilhado.",
    sign: "Assinar contrato",
    openVoyage: "Abrir no Voyage",
    uploadDocs: "Enviar documentos",
    openCabinet: "Abrir área",
    login: "Entrar",
    contract: "Contrato",
    city: "Cidade",
    project: "Projeto",
    departure: "Partida",
    flight: "Voo pago por",
    hotel: "Hotel pago por",
    fee: "Taxa",
    split: "Divisão da taxa",
    cancellation: "Cancelamento gratuito por",
    hours: "h",
    payer: { manager: "gestor", participant: "participante", split: "compartilhado" },
    outdated: "As condições do contrato mudaram. Confira a versão mais recente antes de assinar.",
    missingContract: "Não foi possível verificar a versão atual. Abra a sala da viagem no Voyage.",
    signed: "A versão atual do contrato foi assinada.",
    alreadySigned: "Esta versão do contrato já foi assinada.",
    notAllowed: "Este link de assinatura não é válido para esta conta.",
    signFailed: "Não foi possível salvar a assinatura. Tente novamente mais tarde.",
  },
} as const;

/* ── Оповещения кабинета: резидентка и менеджер (миграция 20261020091000) ── */

type ClubCopy = {
  tourPublished: string;
  partyPublished: string;
  approvedTour: string;
  approvedParty: string;
  approvedCasting: string;
  pointsTitle: (points: number) => string;
  castingResponse: string;
  responsesReady: (count: number, slots: number) => string;
  contractSigned: (name: string, version: string) => string;
  signatures: string;
  docsUploaded: (name: string) => string;
  reviewReceived: string;
  reviewWithComment: string;
  applyUntil: string;
  departure: string;
  projects: Record<ProjectKey, string>;
  categories: Record<"tour" | "event" | "stamp" | "combo" | "achievement" | "adjustment", string>;
  openMap: string;
  openParties: string;
  openApplications: string;
  openCastings: string;
  openPoints: string;
  openCasting: string;
  openRoom: string;
  openPulse: string;
  settingsHint: string;
};

const clubText: Record<TelegramLang, ClubCopy> = {
  RU: {
    tourPublished: "Новый тур на карте VOYAGE",
    partyPublished: "Новая закрытая тусовка VOYAGE",
    approvedTour: "Ваша заявка на тур одобрена",
    approvedParty: "Ваша заявка на тусовку одобрена",
    approvedCasting: "Вас выбрали в состав тура",
    pointsTitle: (n) => `+${n} к Influence Index`,
    castingResponse: "Новые отклики на кастинг",
    responsesReady: (c, s) => `Готовы в тур: ${c} · мест: ${s}`,
    contractSigned: (name, v) => `${name || "Участница"} подписала договор${v ? ` v${v}` : ""}`,
    signatures: "Подписей",
    docsUploaded: (name) => `${name || "Участница"} загрузила документы для тура`,
    reviewReceived: "Резидентка оценила тур",
    reviewWithComment: "Отзыв с комментарием — появится после модерации.",
    applyUntil: "Заявки до",
    departure: "Вылет",
    projects: projectLabels("RU"),
    categories: { tour: "Тур", event: "Тусовка", stamp: "Штамп", combo: "Комбо", achievement: "Достижение", adjustment: "Корректировка" },
    openMap: "Открыть карту",
    openParties: "Смотреть тусовки",
    openApplications: "Мои заявки",
    openCastings: "Открыть кастинги",
    openPoints: "История баллов",
    openCasting: "Открыть кастинг",
    openRoom: "Комната тура",
    openPulse: "Открыть Пульс",
    settingsHint: "Оповещения настраиваются в профиле → Настройки.",
  },
  EN: {
    tourPublished: "New tour on the VOYAGE map",
    partyPublished: "New private VOYAGE party",
    approvedTour: "Your tour application is approved",
    approvedParty: "Your party application is approved",
    approvedCasting: "You have been selected for the crew",
    pointsTitle: (n) => `+${n} to your Influence Index`,
    castingResponse: "New casting responses",
    responsesReady: (c, s) => `Ready for the tour: ${c} · slots: ${s}`,
    contractSigned: (name, v) => `${name || "A participant"} signed the contract${v ? ` v${v}` : ""}`,
    signatures: "Signatures",
    docsUploaded: (name) => `${name || "A participant"} uploaded tour documents`,
    reviewReceived: "A resident rated your tour",
    reviewWithComment: "The comment will appear after moderation.",
    applyUntil: "Applications until",
    departure: "Departure",
    projects: projectLabels("EN"),
    categories: { tour: "Tour", event: "Party", stamp: "Stamp", combo: "Combo", achievement: "Achievement", adjustment: "Adjustment" },
    openMap: "Open the map",
    openParties: "See parties",
    openApplications: "My applications",
    openCastings: "Open castings",
    openPoints: "Points history",
    openCasting: "Open casting",
    openRoom: "Tour room",
    openPulse: "Open Pulse",
    settingsHint: "Manage notifications in Profile → Settings.",
  },
  ES: {
    tourPublished: "Nuevo tour en el mapa VOYAGE",
    partyPublished: "Nueva fiesta privada VOYAGE",
    approvedTour: "Tu solicitud para el tour fue aprobada",
    approvedParty: "Tu solicitud para la fiesta fue aprobada",
    approvedCasting: "Te han elegido para el equipo",
    pointsTitle: (n) => `+${n} a tu Influence Index`,
    castingResponse: "Nuevas respuestas al casting",
    responsesReady: (c, s) => `Listas para el tour: ${c} · plazas: ${s}`,
    contractSigned: (name, v) => `${name || "Una participante"} firmó el contrato${v ? ` v${v}` : ""}`,
    signatures: "Firmas",
    docsUploaded: (name) => `${name || "Una participante"} subió los documentos del tour`,
    reviewReceived: "Una residente valoró tu tour",
    reviewWithComment: "El comentario aparecerá tras la moderación.",
    applyUntil: "Solicitudes hasta",
    departure: "Salida",
    projects: projectLabels("ES"),
    categories: { tour: "Tour", event: "Fiesta", stamp: "Sello", combo: "Combo", achievement: "Logro", adjustment: "Ajuste" },
    openMap: "Abrir el mapa",
    openParties: "Ver fiestas",
    openApplications: "Mis solicitudes",
    openCastings: "Abrir castings",
    openPoints: "Historial de puntos",
    openCasting: "Abrir casting",
    openRoom: "Sala del tour",
    openPulse: "Abrir Pulso",
    settingsHint: "Gestiona los avisos en Perfil → Ajustes.",
  },
  PT: {
    tourPublished: "Novo tour no mapa VOYAGE",
    partyPublished: "Nova festa privada VOYAGE",
    approvedTour: "Sua candidatura ao tour foi aprovada",
    approvedParty: "Sua candidatura à festa foi aprovada",
    approvedCasting: "Você foi escolhida para a equipe",
    pointsTitle: (n) => `+${n} no seu Influence Index`,
    castingResponse: "Novas respostas ao casting",
    responsesReady: (c, s) => `Prontas para o tour: ${c} · vagas: ${s}`,
    contractSigned: (name, v) => `${name || "Uma participante"} assinou o contrato${v ? ` v${v}` : ""}`,
    signatures: "Assinaturas",
    docsUploaded: (name) => `${name || "Uma participante"} enviou os documentos do tour`,
    reviewReceived: "Uma residente avaliou seu tour",
    reviewWithComment: "O comentário aparecerá após a moderação.",
    applyUntil: "Candidaturas até",
    departure: "Partida",
    projects: projectLabels("PT"),
    categories: { tour: "Tour", event: "Festa", stamp: "Carimbo", combo: "Combo", achievement: "Conquista", adjustment: "Ajuste" },
    openMap: "Abrir o mapa",
    openParties: "Ver festas",
    openApplications: "Minhas candidaturas",
    openCastings: "Abrir castings",
    openPoints: "Histórico de pontos",
    openCasting: "Abrir casting",
    openRoom: "Sala do tour",
    openPulse: "Abrir Pulso",
    settingsHint: "Gerencie os avisos em Perfil → Configurações.",
  },
};

const CLUB_TEMPLATES = new Set([
  "tour_published", "party_published", "application_approved", "points_awarded",
  "casting_response", "contract_signed", "docs_uploaded", "review_received",
]);

/** Название из jsonb { RU, EN, … } или строка */
function localizedText(value: unknown, lang: TelegramLang): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const r = value as JsonRecord;
    return pickText(r[lang], r.EN, r.RU, ...Object.values(r));
  }
  return valueText(value);
}

function projectLabel(value: unknown, copy: ClubCopy): string {
  const key = toProjectKey(valueText(value));
  return key ? copy.projects[key] : valueText(value);
}

function formatDate(value: unknown, lang: TelegramLang): string {
  const raw = valueText(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const locale = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-PT" }[lang];
  return date.toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: "UTC" });
}

function clubNotificationBody(template: string, payload: JsonRecord, lang: TelegramLang): string {
  const copy = clubText[lang];
  const title = pickText(localizedText(payload.title_i18n, lang), payload.title);
  const place = [pickText(payload.city), projectLabel(payload.project, copy)].filter(Boolean).join(" · ");
  const lines: string[] = [];

  switch (template) {
    case "tour_published": {
      lines.push(`<b>${escapeHtml(copy.tourPublished)}</b>`);
      if (title) lines.push(escapeHtml(title));
      const subtitle = localizedText(payload.subtitle_i18n, lang);
      if (subtitle) lines.push(`<i>${escapeHtml(subtitle)}</i>`);
      break;
    }
    case "party_published": {
      lines.push(`<b>${escapeHtml(copy.partyPublished)}</b>`);
      if (title) lines.push(escapeHtml(title));
      const until = formatDate(payload.closes_at, lang);
      if (until) lines.push(`${escapeHtml(copy.applyUntil)}: ${escapeHtml(until)}`);
      break;
    }
    case "application_approved": {
      const kind = valueText(payload.kind);
      const head = kind === "party" ? copy.approvedParty : kind === "casting" ? copy.approvedCasting : copy.approvedTour;
      lines.push(`<b>${escapeHtml(head)}</b>`);
      if (kind === "casting") {
        if (place) lines.push(escapeHtml(place));
        const start = formatDate(payload.starts_on, lang);
        if (start) lines.push(`${escapeHtml(copy.departure)}: ${escapeHtml(start)}`);
      } else if (title) {
        lines.push(escapeHtml(title));
      }
      break;
    }
    case "points_awarded": {
      const points = Number(valueText(payload.points)) || 0;
      lines.push(`<b>${escapeHtml(copy.pointsTitle(points))}</b>`);
      const items = Array.isArray(payload.items) ? payload.items.map(record) : [];
      for (const item of items.slice(0, 6)) {
        const category = valueText(item.category) as keyof ClubCopy["categories"];
        const label = pickText(item.label, copy.categories[category]);
        lines.push(`• ${escapeHtml(copy.categories[category] ?? "")}${label && label !== copy.categories[category] ? ` · ${escapeHtml(label)}` : ""}: +${escapeHtml(valueText(item.points))}`);
      }
      break;
    }
    case "casting_response": {
      lines.push(`<b>${escapeHtml(copy.castingResponse)}</b>`);
      if (place) lines.push(escapeHtml(place));
      const count = Number(valueText(payload.count)) || 1;
      const slots = Number(valueText(payload.slots)) || 0;
      lines.push(escapeHtml(copy.responsesReady(count, slots)));
      break;
    }
    case "contract_signed": {
      lines.push(`<b>${escapeHtml(copy.contractSigned(pickText(payload.name), pickText(payload.version)))}</b>`);
      if (place) lines.push(escapeHtml(place));
      const signed = pickText(payload.signed);
      const required = pickText(payload.required);
      if (signed && required) lines.push(`${escapeHtml(copy.signatures)}: ${escapeHtml(signed)}/${escapeHtml(required)}`);
      break;
    }
    case "docs_uploaded": {
      lines.push(`<b>${escapeHtml(copy.docsUploaded(pickText(payload.name)))}</b>`);
      if (place) lines.push(escapeHtml(place));
      const departs = formatDate(payload.departs_at, lang);
      if (departs) lines.push(`${escapeHtml(copy.departure)}: ${escapeHtml(departs)}`);
      break;
    }
    case "review_received": {
      const rating = Math.max(1, Math.min(5, Number(valueText(payload.rating)) || 0));
      lines.push(`<b>${escapeHtml(copy.reviewReceived)}</b>`);
      lines.push(`${"★".repeat(rating)}${"☆".repeat(5 - rating)}${place ? ` · ${escapeHtml(place)}` : ""}`);
      if (payload.has_comment === true) lines.push(`<i>${escapeHtml(copy.reviewWithComment)}</i>`);
      break;
    }
    default:
      throw new Error(`Unsupported club notification template: ${template}`);
  }

  lines.push("", `<i>${escapeHtml(copy.settingsHint)}</i>`);
  return lines.join("\n");
}

function clubKeyboard(template: string, payload: JsonRecord, lang: TelegramLang): InlineKeyboard {
  const copy = clubText[lang];
  const ref = encodeURIComponent(pickText(payload.ref_id));
  const keyboard = new InlineKeyboard();
  switch (template) {
    case "tour_published":
      return keyboard.url(copy.openMap, getSiteLink("/dashboard/map"));
    case "party_published":
      return keyboard.url(copy.openParties, getSiteLink("/dashboard/parties"));
    case "application_approved":
      return valueText(payload.kind) === "casting"
        ? keyboard.url(copy.openCastings, getSiteLink("/dashboard/castings"))
        : keyboard.url(copy.openApplications, getSiteLink("/dashboard/applications"));
    case "points_awarded":
      return keyboard.url(copy.openPoints, getSiteLink("/dashboard/gamification#points-history"));
    case "casting_response":
      return keyboard.url(copy.openCasting, getSiteLink(ref ? `/partner/castings/${ref}` : "/partner/castings"));
    case "contract_signed":
    case "docs_uploaded":
      return keyboard.url(copy.openRoom, getSiteLink(ref ? `/partner/manifest/${ref}/room` : "/partner/manifest"));
    case "review_received":
      return keyboard.url(copy.openPulse, getSiteLink("/partner/pulse"));
  }
  return keyboard;
}

/** Тумблеры member_preferences: участница могла выключить оповещение, пока строка ждала в очереди */
const PREFERENCE_COLUMN: Record<string, string> = {
  tour_published: "notify_tours",
  party_published: "notify_parties",
  application_approved: "notify_approvals",
  points_awarded: "notify_points",
  casting_response: "notify_casting_responses",
  contract_signed: "notify_contract_signed",
  docs_uploaded: "notify_docs_uploaded",
  review_received: "notify_reviews",
};

async function isOptedOut(recipientId: string, template: string): Promise<boolean> {
  const column = PREFERENCE_COLUMN[template];
  if (!column) return false;
  const { data, error } = await getTelegramServiceClient().from("member_preferences")
    .select(column)
    .eq("profile_id", recipientId)
    .maybeSingle();
  if (error || !data) return false;
  return (data as unknown as Record<string, unknown>)[column] === false;
}

type LanguageText = (typeof text)[TelegramLang];

function formatPayer(value: unknown, labels: LanguageText): string {
  const key = valueText(value).toLowerCase() as keyof LanguageText["payer"];
  return key in labels.payer ? labels.payer[key] : valueText(value);
}

/** tour / event (и старые shoot / show / campaign) → подпись на языке получателя */
function typeLabel(value: string, lang: TelegramLang): string {
  const key = toProjectKey(value);
  return key ? clubText[lang].projects[key] : value;
}

function notificationBody(template: string, payload: JsonRecord, lang: TelegramLang): string {
  const labels = text[lang];
  const city = pickText(payload.city);
  const project = typeLabel(pickText(payload.project), lang);
  const departure = pickText(payload.departs_at);
  const terms = record(payload.terms);
  const lines: string[] = [];

  switch (template) {
    case "contract_sign_request":
      lines.push(labels.contractRequest);
      break;
    case "contract_reminder":
      lines.push(labels.contractReminder);
      break;
    case "docs_reminder":
      lines.push(labels.docsReminder);
      break;
    case "kyc_approved":
      lines.push(labels.kycApproved);
      break;
    case "access_link":
      lines.push(labels.accessLink);
      break;
    default:
      throw new Error(`Unsupported partner notification template: ${template}`);
  }

  if (project) lines.push(`${labels.project}: ${project}`);
  if (city) lines.push(`${labels.city}: ${city}`);
  if (departure) lines.push(`${labels.departure}: ${departure}`);

  if (template === "contract_sign_request") {
    const version = pickText(payload.version);
    if (version) lines.push(`${labels.contract}: v${version}`);
    const flight = formatPayer(terms.flight_paid_by, labels);
    const hotel = formatPayer(terms.hotel_paid_by, labels);
    if (flight) lines.push(`${labels.flight}: ${flight}`);
    if (hotel) lines.push(`${labels.hotel}: ${hotel}`);
    const feeAmount = pickText(terms.fee_amount);
    const feeCurrency = pickText(terms.fee_currency);
    if (feeAmount) lines.push(`${labels.fee}: ${feeAmount}${feeCurrency ? ` ${feeCurrency}` : ""}`);
    const feeSplit = pickText(terms.fee_split);
    if (feeSplit) lines.push(`${labels.split}: ${feeSplit}`);
    const freeHours = pickText(terms.cancel_free_hours);
    if (freeHours) lines.push(`${labels.cancellation}: ${freeHours} ${labels.hours}`);
  }

  return lines.join("\n");
}

function currentContractBody(contract: JsonRecord, oldPayload: JsonRecord, lang: TelegramLang): string {
  const labels = text[lang];
  const terms = record(contract.terms ?? contract.payload ?? oldPayload.terms);
  const payloadCity = pickText(contract.city, oldPayload.city);
  const payloadProject = typeLabel(pickText(contract.project, oldPayload.project), lang);
  const payloadDeparture = pickText(contract.departs_at, contract.departure_at, oldPayload.departs_at);
  const version = pickText(contract.version);
  const lines: string[] = [labels.outdated];
  if (payloadProject) lines.push(`${labels.project}: ${payloadProject}`);
  if (payloadCity) lines.push(`${labels.city}: ${payloadCity}`);
  if (payloadDeparture) lines.push(`${labels.departure}: ${payloadDeparture}`);
  if (version) lines.push(`${labels.contract}: v${version}`);
  const flight = formatPayer(terms.flight_paid_by, labels);
  const hotel = formatPayer(terms.hotel_paid_by, labels);
  if (flight) lines.push(`${labels.flight}: ${flight}`);
  if (hotel) lines.push(`${labels.hotel}: ${hotel}`);
  const feeAmount = pickText(terms.fee_amount);
  const feeCurrency = pickText(terms.fee_currency);
  if (feeAmount) lines.push(`${labels.fee}: ${feeAmount}${feeCurrency ? ` ${feeCurrency}` : ""}`);
  const feeSplit = pickText(terms.fee_split);
  if (feeSplit) lines.push(`${labels.split}: ${feeSplit}`);
  const freeHours = pickText(terms.cancel_free_hours);
  if (freeHours) lines.push(`${labels.cancellation}: ${freeHours} ${labels.hours}`);
  return lines.join("\n");
}

function getSiteLink(path: string): string {
  const base = siteBaseUrl();
  return new URL(path, base).toString();
}

function keyboardFor(row: NotificationRow, payload: JsonRecord, lang: TelegramLang): InlineKeyboard {
  const labels = text[lang];
  const keyboard = new InlineKeyboard();
  switch (row.template) {
    case "contract_sign_request":
      keyboard.text(labels.sign, `partner:sign:${row.id}`)
        .row()
        .url(labels.openVoyage, getSiteLink("/dashboard/tours"));
      break;
    case "contract_reminder":
      keyboard.text(labels.sign, `partner:sign:${row.id}`);
      break;
    case "docs_reminder": {
      const url = safeHttpsUrl(payload.documents_url) ?? getSiteLink("/dashboard/profile");
      keyboard.url(labels.uploadDocs, url);
      break;
    }
    case "kyc_approved":
      keyboard.url(labels.openCabinet, getSiteLink("/dashboard"));
      break;
    case "access_link": {
      const url = safeHttpsUrl(payload.link);
      if (!url) throw new Error("access_link payload.link must be a valid HTTPS URL");
      keyboard.url(labels.login, url);
      break;
    }
  }
  return keyboard;
}

function telegramBotApi() {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "").trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN (or BOT_TOKEN) is not configured");
  return new Bot(token).api;
}

function safeError(error: unknown): string {
  const candidate = error && typeof error === "object" && "description" in error
    ? String((error as { description?: unknown }).description ?? "")
    : error instanceof Error ? error.message : "Telegram delivery failed";
  return candidate.replace(/[\r\n\t]+/g, " ").slice(0, 1000) || "Telegram delivery failed";
}

async function recordFailure(row: NotificationRow, error: unknown): Promise<void> {
  const db = getTelegramServiceClient();
  const currentAttempts = Math.max(0, Number(row.attempts ?? 0));
  const { error: updateError } = await db.from("partner_notifications")
    .update({ status: "failed", attempts: currentAttempts + 1, error: safeError(error) })
    .eq("id", row.id)
    .eq("attempts", currentAttempts)
    .in("status", ACTIVE_STATUSES);
  if (updateError) console.error("[partner-notifications] could not record failed delivery", { code: updateError.code ?? "unknown" });
}

async function processOne(row: NotificationRow): Promise<keyof Omit<DrainSummary, "selected">> {
  if (!row.id || !row.recipient_id || !row.template) {
    await recordFailure(row, new Error("Notification row is missing required fields"));
    return "failed";
  }

  const db = getTelegramServiceClient();
  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id,telegram_id")
    .eq("id", row.recipient_id)
    .maybeSingle();

  if (profileError) {
    await recordFailure(row, new Error(`Recipient lookup failed: ${profileError.message}`));
    return "failed";
  }
  if (!profile) {
    await recordFailure(row, new Error("Recipient profile not found"));
    return "failed";
  }

  const telegramId = valueText(profile.telegram_id);
  if (!telegramId) {
    const { error } = await db.from("partner_notifications")
      .update({ status: "skipped", error: "no_telegram" })
      .eq("id", row.id)
      .in("status", ACTIVE_STATUSES);
    if (error) {
      await recordFailure(row, new Error(`Could not mark notification as skipped: ${error.message}`));
      return "failed";
    }
    return "skipped";
  }

  if (await isOptedOut(row.recipient_id, row.template)) {
    await db.from("partner_notifications")
      .update({ status: "skipped", error: "opted_out" })
      .eq("id", row.id)
      .in("status", ACTIVE_STATUSES);
    return "skipped";
  }

  try {
    const payload = record(row.payload);
    const lang = await getPreferredTelegramLanguage(telegramId);
    const club = CLUB_TEMPLATES.has(row.template);
    const message = club ? clubNotificationBody(row.template, payload, lang) : notificationBody(row.template, payload, lang);
    const keyboard = club ? clubKeyboard(row.template, payload, lang) : keyboardFor(row, payload, lang);
    await telegramBotApi().sendMessage(telegramId, message, {
      reply_markup: keyboard,
      ...(club ? { parse_mode: "HTML" as const } : {}),
    });

    const { error: sentError } = await db.from("partner_notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .in("status", ACTIVE_STATUSES);
    if (sentError) {
      // Do not record a send failure after Telegram accepted the message: doing so would
      // cause the same message to be retried and duplicated. Leave an explicit server log.
      console.error("[partner-notifications] sent message, but could not mark queue row sent", { id: row.id, code: sentError.code ?? "unknown" });
    }
    return "sent";
  } catch (error) {
    await recordFailure(row, error);
    return "failed";
  }
}

/**
 * Drains only existing queue rows. The worker never inserts into or updates partner_contracts
 * / partner_contract_signatures / partner_events; the latter table is trigger-owned.
 */
export async function processPartnerNotificationQueue(options: DrainOptions = {}): Promise<DrainSummary> {
  const db = getTelegramServiceClient();
  const statuses = options.includeFailed ? ["queued", "failed", "sending"] : ["queued"];
  const limit = Math.min(50, Math.max(1, Math.floor(options.limit ?? DEFAULT_BATCH_SIZE)));
  const rowsById = new Map<string, NotificationRow>();

  if (options.notificationId && /^[A-Za-z0-9_-]{1,80}$/.test(options.notificationId)) {
    const { data: target, error: targetError } = await db.from("partner_notifications")
      .select("*")
      .eq("id", options.notificationId)
      .in("status", statuses)
      .lt("attempts", MAX_ATTEMPTS)
      .maybeSingle();
    if (targetError) throw new Error(`Partner notification lookup failed: ${targetError.message}`);
    if (target) rowsById.set(String(target.id), target as NotificationRow);
  }

  const { data, error } = await db.from("partner_notifications")
    .select("*")
    .in("status", statuses)
    .lt("attempts", MAX_ATTEMPTS)
    .limit(limit);
  if (error) throw new Error(`Partner notification queue query failed: ${error.message}`);

  for (const item of data ?? []) {
    const row = item as NotificationRow;
    if (row.id && !rowsById.has(String(row.id))) rowsById.set(String(row.id), row);
  }
  const rows = Array.from(rowsById.values()).slice(0, limit + (options.notificationId ? 1 : 0));
  const summary: DrainSummary = { selected: rows.length, sent: 0, skipped: 0, failed: 0, busy: 0 };

  for (const row of rows) {
    if (locallyProcessing.has(row.id)) {
      summary.busy += 1;
      continue;
    }
    locallyProcessing.add(row.id);
    try {
      // Атомарно забираем строку: параллельный вызов вебхука её уже не получит,
      // поэтому массовая рассылка не задваивает сообщения.
      const { data: claimed, error: claimError } = await db.rpc("voyage_claim_partner_notification", {
        p_id: row.id,
        p_include_failed: Boolean(options.includeFailed),
      });
      if (claimError) throw new Error(`Partner notification claim failed: ${claimError.message}`);
      const claimedRow = Array.isArray(claimed) ? claimed[0] : claimed;
      if (!claimedRow) {
        summary.busy += 1;
        continue;
      }
      const outcome = await processOne(claimedRow as NotificationRow);
      summary[outcome] += 1;
    } finally {
      locallyProcessing.delete(row.id);
    }
  }
  return summary;
}

function asComparableVersion(value: unknown): string {
  const raw = valueText(value);
  if (!raw) return "";
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? String(numeric) : raw;
}

function getTourId(notification: JsonRecord, payload: JsonRecord): string {
  return pickText(notification.tour_id, notification.tourId, payload.tour_id, payload.tourId, payload.project_id);
}

/** Handles the signature callback; identity and version are checked again server-side. */
export async function handlePartnerContractSignCallback(ctx: Context): Promise<void> {
  const callback = ctx.callbackQuery;
  const from = ctx.from;
  if (!callback || !from || !ctx.chat || ctx.chat.type !== "private") return;

  const match = typeof callback.data === "string"
    ? callback.data.match(/^partner:sign:([A-Za-z0-9_-]{1,48})$/i)
    : null;
  if (!match) {
    await ctx.answerCallbackQuery({ text: "Invalid contract action", show_alert: true });
    return;
  }

  const lang = await getPreferredTelegramLanguage(String(from.id), from.language_code);
  const labels = text[lang];
  const db = getTelegramServiceClient();
  const telegramId = String(from.id);

  const { data: notification, error: notificationError } = await db.from("partner_notifications")
    .select("*")
    .eq("id", match[1])
    .maybeSingle();
  if (notificationError || !notification || !["contract_sign_request", "contract_reminder"].includes(String(notification.template))) {
    await ctx.answerCallbackQuery({ text: labels.notAllowed, show_alert: true });
    return;
  }

  const { data: profile, error: profileError } = await db.from("profiles")
    .select("id,telegram_id,role,status,banned_until,ban_permanent")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  const banUntil = profile?.banned_until === "infinity" ? Number.POSITIVE_INFINITY : profile?.banned_until ? Date.parse(String(profile.banned_until)) : NaN;
  const banned = profile?.ban_permanent === true || profile?.banned_until === "infinity" || (Number.isFinite(banUntil) && banUntil > Date.now());
  if (profileError || !profile || profile.id !== notification.recipient_id || profile.telegram_id !== telegramId || profile.status !== "approved" || banned) {
    await ctx.answerCallbackQuery({ text: labels.notAllowed, show_alert: true });
    return;
  }

  const payload = record(notification.payload);
  let tourId = getTourId(notification as JsonRecord, payload);
  if (!tourId && notification.contract_id) {
    const { data: referencedContract } = await db.from("partner_contracts")
      .select("id,tour_id")
      .eq("id", String(notification.contract_id))
      .maybeSingle();
    tourId = pickText(referencedContract?.tour_id);
  }
  if (!tourId && /^[0-9a-f-]{36}$/i.test(pickText(payload.project))) {
    tourId = pickText(payload.project);
  }
  if (!tourId) {
    await ctx.answerCallbackQuery({ text: labels.missingContract, show_alert: true });
    await ctx.reply(labels.missingContract, { reply_markup: new InlineKeyboard().url(labels.openVoyage, getSiteLink("/dashboard/tours")) });
    return;
  }

  const { data: latestContract, error: contractError } = await db.from("partner_contracts")
    .select("*")
    .eq("tour_id", tourId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contractError || !latestContract) {
    await ctx.answerCallbackQuery({ text: labels.missingContract, show_alert: true });
    return;
  }

  if (!asComparableVersion(payload.version) || asComparableVersion(payload.version) !== asComparableVersion(latestContract.version)) {
    await ctx.answerCallbackQuery({ text: labels.outdated, show_alert: true });
    await ctx.reply(currentContractBody(latestContract as JsonRecord, payload, lang), {
      reply_markup: new InlineKeyboard().url(labels.openVoyage, getSiteLink("/dashboard/tours")),
    });
    return;
  }

  const { error: signatureError } = await db.from("partner_contract_signatures").insert({
    contract_id: latestContract.id,
    signer_id: profile.id,
  });

  if (signatureError?.code === "23505") {
    await ctx.answerCallbackQuery({ text: labels.alreadySigned, show_alert: true });
    return;
  }
  if (signatureError) {
    console.error("[partner-signature] signature insert failed", { code: signatureError.code ?? "unknown" });
    await ctx.answerCallbackQuery({ text: labels.signFailed, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: labels.signed, show_alert: true });
  await ctx.reply(labels.signed, { reply_markup: new InlineKeyboard().url(labels.openVoyage, getSiteLink("/dashboard/tours")) });
}
