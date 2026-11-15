import "server-only";

import { InlineKeyboard } from "grammy";
import type { TelegramLang } from "@/lib/server/telegram/types";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Бот — уведомления скаутинга (очередь partner_notifications)
 *
 *   tour_direct_invite    → модели: личное приглашение в тур
 *   tour_invite_answer    → менеджеру тура: модель приняла / отказалась
 *   scout_model_attached  → менеджеру: за ним закрепили модель
 *   scout_bonus           → скауту (менеджер или scout): начислен скаут-бонус
 *   scout_nudge           → модели: мягкое напоминание скаута (только шаблон)
 *   scout_model_progress  → скауту: модель прошла этап (без документов)
 *   scout_payout          → скауту: выплата проведена (сумма — в кабинете)
 *   scout_payout_details  → скауту: реквизиты изменены (маска, защита от угона)
 *
 * Ссылки ведут в кабинет по роли получателя: scout → /scout…,
 * manager/owner → /partner/models.
 *
 * В payload нет денег и текста сообщения менеджера (admin видит очередь),
 * поэтому сумма и детали — только по кнопке в кабинете. HTML-разметка.
 * ──────────────────────────────────────────────────────────────────── */

type JsonRecord = Record<string, unknown>;

export const SCOUT_TEMPLATES = new Set([
  "tour_direct_invite", "tour_invite_answer", "scout_model_attached", "scout_bonus",
  "scout_nudge", "scout_model_progress", "scout_payout", "scout_payout_details",
]);

type NudgeKind = "photo" | "kyc" | "open_to_tours" | "casting";
type Stage = "approved" | "not_approved" | "kyc" | "photo" | "in_tour";

const T: Record<TelegramLang, {
  invite: string; inviteHint: string; until: string; openInvite: string;
  accepted: (n: string) => string; declined: (n: string) => string; openTour: string;
  attached: (n: string) => string; attachedHow: Record<string, string>; openModels: string;
  bonus: (n: string, city: string) => string; bonusHint: string; openBonuses: string;
  nudgeFrom: (scout: string) => string; nudge: Record<NudgeKind, string>; nudgeLevel: (l: number) => string;
  nudgeCasting: (city: string, date: string) => string; openProfile: string; openCastings: string;
  stage: Record<Stage, (n: string) => string>; kycLevel: (l: number) => string;
  payout: string; payoutHint: string; openEarnings: string;
  details: string; detailsHint: (masked: string) => string; openProfileScout: string;
}> = {
  RU: {
    invite: "Вас лично приглашают в тур", inviteHint: "Без кастинга: ответьте в кабинете — после «Принять участие» откроется Комната тура.",
    until: "Ответить до", openInvite: "Открыть приглашение",
    accepted: (n) => `${n} приняла приглашение в тур`, declined: (n) => `${n} отказалась от приглашения в тур`, openTour: "Открыть тур",
    attached: (n) => `За вами закреплена модель: ${n}`,
    attachedHow: { attached_new: "Зарегистрировалась по вашей ссылке.", attached_existing: "Подтвердила закрепление по вашей ссылке.", claim_approved: "owner одобрил заявку.", owner_set: "Закрепил owner." },
    openModels: "Мои модели",
    bonus: (n, city) => `Скаут-бонус: ${n}${city ? ` · ${city}` : ""}`, bonusHint: "Модель закрыла заказ в туре другого менеджера. Сумма и статус — в кабинете.", openBonuses: "Скаут-бонусы",
    nudgeFrom: (s) => `Ваш скаут ${s} напоминает:`,
    nudge: { photo: "Добавьте хотя бы одно фото в профиль — без него кастинги закрыты.", kyc: "Пройдите следующий шаг верификации — откроется больше кастингов.", open_to_tours: "Включите «Готова к турам» — тогда менеджеры смогут вас пригласить.", casting: "Есть открытый кастинг, который вам подходит." },
    nudgeLevel: (l) => `Нужен уровень верификации: KYC ${l}.`,
    nudgeCasting: (c, d) => `Кастинг: ${c}${d ? ` · с ${d}` : ""}.`,
    openProfile: "Открыть профиль", openCastings: "Открыть кастинги",
    stage: {
      approved: (n) => `${n}: анкета одобрена клубом`, not_approved: (n) => `${n}: анкета не прошла проверку клуба`,
      kyc: (n) => `${n}: новый уровень верификации`, photo: (n) => `${n}: добавила фото`, in_tour: (n) => `${n}: в туре`,
    },
    kycLevel: (l) => `Уровень: KYC ${l}`,
    payout: "Скаут-бонусы выплачены", payoutHint: "Сумма, реквизиты и номер транзакции — в кабинете.", openEarnings: "Начисления и выплаты",
    details: "Реквизиты для выплат изменены", detailsHint: (m) => `Новые: ${m}. Если это были не вы — срочно смените пароль и напишите owner.`, openProfileScout: "Профиль",
  },
  EN: {
    invite: "You are personally invited to a tour", inviteHint: "No casting: reply in your cabinet — after “Join the tour” the Tour Room opens.",
    until: "Reply by", openInvite: "Open the invite",
    accepted: (n) => `${n} accepted your tour invite`, declined: (n) => `${n} declined your tour invite`, openTour: "Open the tour",
    attached: (n) => `A model is now attached to you: ${n}`,
    attachedHow: { attached_new: "Signed up with your link.", attached_existing: "Confirmed via your link.", claim_approved: "The owner approved the request.", owner_set: "Attached by the owner." },
    openModels: "My models",
    bonus: (n, city) => `Scout bonus: ${n}${city ? ` · ${city}` : ""}`, bonusHint: "Your model completed a booking in another manager’s tour. Amount and status are in your cabinet.", openBonuses: "Scout bonuses",
    nudgeFrom: (s) => `A reminder from your scout ${s}:`,
    nudge: { photo: "Add at least one photo to your profile — castings stay closed without it.", kyc: "Complete the next verification step to unlock more castings.", open_to_tours: "Turn on “Open to tours” so managers can invite you.", casting: "There is an open casting that fits you." },
    nudgeLevel: (l) => `Required verification level: KYC ${l}.`,
    nudgeCasting: (c, d) => `Casting: ${c}${d ? ` · from ${d}` : ""}.`,
    openProfile: "Open profile", openCastings: "Open castings",
    stage: {
      approved: (n) => `${n}: approved by the club`, not_approved: (n) => `${n}: did not pass the club review`,
      kyc: (n) => `${n}: new verification level`, photo: (n) => `${n}: added a photo`, in_tour: (n) => `${n}: on tour`,
    },
    kycLevel: (l) => `Level: KYC ${l}`,
    payout: "Scout bonuses paid", payoutHint: "Amount, payout details and transaction ref are in your cabinet.", openEarnings: "Earnings & payouts",
    details: "Payout details changed", detailsHint: (m) => `New: ${m}. If this wasn’t you, change your password now and contact the owner.`, openProfileScout: "Profile",
  },
  ES: {
    invite: "Te invitan personalmente a un tour", inviteHint: "Sin casting: responde en tu cabina; tras «Participar» se abre la Sala del tour.",
    until: "Responder antes de", openInvite: "Abrir la invitación",
    accepted: (n) => `${n} aceptó la invitación al tour`, declined: (n) => `${n} rechazó la invitación al tour`, openTour: "Abrir el tour",
    attached: (n) => `Modelo vinculada contigo: ${n}`,
    attachedHow: { attached_new: "Se registró con tu enlace.", attached_existing: "Confirmó con tu enlace.", claim_approved: "El owner aprobó la solicitud.", owner_set: "Vinculada por el owner." },
    openModels: "Mis modelos",
    bonus: (n, city) => `Bono scout: ${n}${city ? ` · ${city}` : ""}`, bonusHint: "Tu modelo cerró una reserva en el tour de otro gerente. Importe y estado en tu cabina.", openBonuses: "Bonos scout",
    nudgeFrom: (s) => `Recordatorio de tu scout ${s}:`,
    nudge: { photo: "Añade al menos una foto al perfil: sin ella los castings están cerrados.", kyc: "Completa el siguiente paso de verificación para abrir más castings.", open_to_tours: "Activa «Disponible para tours» para que los gerentes te inviten.", casting: "Hay un casting abierto que encaja contigo." },
    nudgeLevel: (l) => `Nivel requerido: KYC ${l}.`,
    nudgeCasting: (c, d) => `Casting: ${c}${d ? ` · desde ${d}` : ""}.`,
    openProfile: "Abrir perfil", openCastings: "Abrir castings",
    stage: {
      approved: (n) => `${n}: aprobada por el club`, not_approved: (n) => `${n}: no pasó la revisión del club`,
      kyc: (n) => `${n}: nuevo nivel de verificación`, photo: (n) => `${n}: añadió una foto`, in_tour: (n) => `${n}: en tour`,
    },
    kycLevel: (l) => `Nivel: KYC ${l}`,
    payout: "Bonos scout pagados", payoutHint: "Importe, datos y referencia de la transacción en tu panel.", openEarnings: "Bonos y pagos",
    details: "Datos de pago cambiados", detailsHint: (m) => `Nuevos: ${m}. Si no fuiste tú, cambia la contraseña y escribe al owner.`, openProfileScout: "Perfil",
  },
  PT: {
    invite: "Você foi convidada pessoalmente para um tour", inviteHint: "Sem casting: responda no painel — depois de «Participar» a Sala do tour abre.",
    until: "Responder até", openInvite: "Abrir o convite",
    accepted: (n) => `${n} aceitou o convite para o tour`, declined: (n) => `${n} recusou o convite para o tour`, openTour: "Abrir o tour",
    attached: (n) => `Modelo vinculada a você: ${n}`,
    attachedHow: { attached_new: "Cadastrou-se pelo seu link.", attached_existing: "Confirmou pelo seu link.", claim_approved: "O owner aprovou o pedido.", owner_set: "Vinculada pelo owner." },
    openModels: "Minhas modelos",
    bonus: (n, city) => `Bônus scout: ${n}${city ? ` · ${city}` : ""}`, bonusHint: "Sua modelo fechou uma reserva no tour de outro gerente. Valor e status no painel.", openBonuses: "Bônus scout",
    nudgeFrom: (s) => `Lembrete do seu scout ${s}:`,
    nudge: { photo: "Adicione pelo menos uma foto ao perfil — sem ela os castings ficam fechados.", kyc: "Conclua a próxima etapa de verificação para abrir mais castings.", open_to_tours: "Ative «Disponível para tours» para que os gerentes possam convidar você.", casting: "Há um casting aberto que combina com você." },
    nudgeLevel: (l) => `Nível exigido: KYC ${l}.`,
    nudgeCasting: (c, d) => `Casting: ${c}${d ? ` · a partir de ${d}` : ""}.`,
    openProfile: "Abrir perfil", openCastings: "Abrir castings",
    stage: {
      approved: (n) => `${n}: aprovada pelo clube`, not_approved: (n) => `${n}: não passou na revisão do clube`,
      kyc: (n) => `${n}: novo nível de verificação`, photo: (n) => `${n}: adicionou uma foto`, in_tour: (n) => `${n}: em tour`,
    },
    kycLevel: (l) => `Nível: KYC ${l}`,
    payout: "Bônus scout pagos", payoutHint: "Valor, dados e referência da transação no painel.", openEarnings: "Bônus e pagamentos",
    details: "Dados de pagamento alterados", detailsHint: (m) => `Novos: ${m}. Se não foi você, troque a senha agora e fale com o owner.`, openProfileScout: "Perfil",
  },
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const esc = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LOCALE: Record<TelegramLang, string> = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-PT" };

function day(v: unknown, lang: TelegramLang, withTime = false): string {
  const d = new Date(str(v));
  if (!str(v) || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(LOCALE[lang], { day: "numeric", month: "long", timeZone: "UTC", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }) + (withTime ? " UTC" : "");
}

export function scoutNotificationBody(template: string, payload: JsonRecord, lang: TelegramLang): string {
  const t = T[lang];
  const city = esc(str(payload.city));
  switch (template) {
    case "tour_direct_invite": {
      const dates = [day(payload.departs_at, lang), day(payload.returns_at, lang)].filter(Boolean).join(" — ");
      const until = day(payload.expires_at, lang, true);
      const head = [`<b>${esc(t.invite)}</b>`, [city, esc(dates)].filter(Boolean).join(" · "), until ? `${esc(t.until)}: ${esc(until)}` : ""].filter(Boolean);
      return [...head, "", `<i>${esc(t.inviteHint)}</i>`].join("\n");
    }
    case "tour_invite_answer":
      return [`<b>${esc(payload.accepted === true ? t.accepted(str(payload.name) || "—") : t.declined(str(payload.name) || "—"))}</b>`, city].filter(Boolean).join("\n");
    case "scout_model_attached": {
      const how = t.attachedHow[str(payload.action)];
      return [`<b>${esc(t.attached(str(payload.name) || "—"))}</b>`, how ? esc(how) : ""].filter(Boolean).join("\n");
    }
    case "scout_bonus":
      return [`<b>${esc(t.bonus(str(payload.name) || "—", str(payload.city)))}</b>`, esc(t.bonusHint)].join("\n");
    case "scout_nudge": {
      const kind = (["photo", "kyc", "open_to_tours", "casting"].includes(str(payload.kind)) ? str(payload.kind) : "kyc") as NudgeKind;
      const level = Number(payload.level ?? payload.min_kyc_level);
      const lines = [`<i>${esc(t.nudgeFrom(str(payload.scout_name) || "VOYAGE"))}</i>`, `<b>${esc(t.nudge[kind])}</b>`];
      if (kind === "casting" && str(payload.city)) lines.push(esc(t.nudgeCasting(str(payload.city), day(payload.starts_on, lang))));
      if ((kind === "kyc" || kind === "casting") && Number.isFinite(level) && level > 0) lines.push(esc(t.nudgeLevel(level)));
      return lines.join("\n");
    }
    case "scout_model_progress": {
      const stage = (["approved", "not_approved", "kyc", "photo", "in_tour"].includes(str(payload.stage)) ? str(payload.stage) : "kyc") as Stage;
      const lines = [`<b>${esc(t.stage[stage](str(payload.name) || "—"))}</b>`];
      if (stage === "kyc" && Number.isFinite(Number(payload.level))) lines.push(esc(t.kycLevel(Number(payload.level))));
      if (stage === "in_tour") {
        const dates = [day(payload.departs_at, lang), day(payload.returns_at, lang)].filter(Boolean).join(" — ");
        lines.push([city, esc(dates)].filter(Boolean).join(" · "));
      }
      return lines.filter(Boolean).join("\n");
    }
    case "scout_payout":
      return [`<b>${esc(t.payout)}</b>`, esc(t.payoutHint)].join("\n");
    case "scout_payout_details":
      return [`<b>${esc(t.details)}</b>`, esc(t.detailsHint(str(payload.masked) || "—"))].join("\n");
    default:
      return esc(str(payload.name) || "—");
  }
}

export function scoutKeyboard(template: string, payload: JsonRecord, lang: TelegramLang, link: (path: string) => string, recipientRole = ""): InlineKeyboard {
  const t = T[lang];
  const k = new InlineKeyboard();
  const ref = encodeURIComponent(str(payload.ref_id));
  // Скаут живёт только в /scout; менеджер и owner — в /partner/models.
  const isScout = recipientRole === "scout";
  const models = isScout ? "/scout" : "/partner/models";
  const earnings = isScout ? "/scout/earnings" : "/partner/models";
  switch (template) {
    case "tour_direct_invite":
      return k.url(t.openInvite, link("/dashboard/castings"));
    case "tour_invite_answer":
      return ref ? k.url(t.openTour, link(`/partner/bookings/${ref}`)) : k.url(t.openModels, link("/partner/models"));
    case "scout_model_attached":
    case "scout_model_progress":
      return k.url(t.openModels, link(models));
    case "scout_bonus":
      return k.url(t.openBonuses, link(earnings));
    case "scout_payout":
      return k.url(t.openEarnings, link(earnings));
    case "scout_payout_details":
      return k.url(t.openProfileScout, link(isScout ? "/scout/profile" : "/partner/models"));
    case "scout_nudge":
      return str(payload.kind) === "photo" || str(payload.kind) === "kyc"
        ? k.url(t.openProfile, link("/dashboard"))
        : k.url(t.openCastings, link("/dashboard/castings"));
    default:
      return k;
  }
}
