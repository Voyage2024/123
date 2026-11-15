/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Скаутинг — тексты (RU / EN / ES / PT)
 * lib/scouting/i18n.ts
 *
 * «Мои модели» и скаут-бонусы менеджера, прямые приглашения в тур
 * (менеджер и резидентка), контроль скаутов у owner.
 * ──────────────────────────────────────────────────────────────────── */

import type { Lang } from "@/app/context/LanguageContext";

export type ScoutDict = {
  errors: Record<string, string>;
  blocks: Record<string, string>;
  bonusStatus: { pending: string; paid: string; void: string };
  models: {
    eyebrow: string; title: string; subtitle: string;
    tabs: { models: string; invites: string; bonuses: string };
    empty: string; since: (d: string) => string; inTour: string; ownTour: string; inviteToTour: string;
    status: Record<string, string>; noTelegram: string; banned: string; openToTours: string;
    claimsTitle: string; claimStatus: Record<string, string>; claimReason: Record<string, string>;
    ownerHint: string; ownerLink: string; rulesTitle: string; rules: string[];
  };
  invites: {
    title: string; hint: string; create: string; note: string; notePh: string; days: string; maxUses: string;
    uses: (u: number, m: number) => string; expires: (d: string) => string; revoke: string; revoked: string; expired: string;
    botMissing: string; copyLink: string; copied: string; empty: string;
  };
  bonuses: {
    title: string; hint: string; pending: string; paid: string; empty: string; model: string; where: string; amount: string; status: string;
  };
  tourInvite: {
    tab: string; title: string; hint: string; candidates: string; noCandidates: string; message: string; messagePh: string;
    hours: string; send: string; sending: string; sent: (n: number, notified: number) => string; skipped: (n: number) => string;
    listTitle: string; empty: string; revoke: string; status: Record<string, string>; pickTour: string; noTours: string; modalTitle: (name: string) => string;
    hoursOptions: Record<string, string>; telegramOff: string;
  };
  inbox: {
    eyebrow: string; title: string; scout: (name: string) => string; scoutSince: (d: string) => string; accept: string; decline: string;
    accepted: string; declined: string; expired: string; revoked: string; openRoom: string; until: (d: string) => string; busy: string;
    from: (name: string) => string; empty: string; confirmDecline: string;
  };
  cashbox: { title: string; hint: string; net: string; byModel: (scout: string) => string; pending: string };
  owner: {
    eyebrow: string; title: string; subtitle: string; back: string; openLink: string;
    settings: string; percent: string; base: string; baseTotal: string; baseAgency: string; window: string; windowHint: string;
    grace: string; graceHint: string; save: string; saved: string; settingsHint: string;
    totalsPending: string; totalsPaid: string;
    payouts: string; payoutsHint: string; payRef: string; payRefPh: string; pay: (n: number) => string; voidRow: string; voidReason: string;
    readyToPay: string; tourOpen: string; host: string; scout: string; baseText: (pct: number, kind: string, amount: string) => string; adjustment: string;
    claims: string; noClaims: string; approve: string; reject: string; claimInfo: (created: string, tours: number) => string;
    scouts: string; models: string; withhold: string; activeInvites: string;
    assign: string; assignHint: string; search: string; searchPh: string; current: (name: string | null) => string; pickManager: string; clear: string;
    reason: string; reasonPh: string; apply: string; log: string; logAction: Record<string, string>; noPayouts: string;
  };
};

const RU: ScoutDict = {
  errors: {
    forbidden: "Нет доступа к этому действию.",
    failed: "Не получилось. Попробуйте ещё раз.",
    too_many_invites: "Активных ссылок уже 20 — отзовите старые.",
    pick_models: "Выберите хотя бы одну модель.",
    too_many_residents: "За раз можно позвать до 30 моделей.",
    invite_not_found: "Приглашение не найдено.",
    invite_closed: "Приглашение уже закрыто.",
    invite_expired: "Срок приглашения истёк.",
    tour_closed: "Тур уже закрыт.",
    not_eligible: "Сейчас участие недоступно: проверьте статус анкеты.",
    busy: "На эти даты вы уже в другом туре.",
    reason_required: "Укажите причину (от 3 символов).",
    not_pending: "Заявка уже обработана.",
    other_scout: "Модель уже закреплена за другим менеджером.",
    scout_inactive: "Этот менеджер сейчас не может быть скаутом.",
    not_a_model: "Это не профиль модели.",
    payout_ref_required: "Укажите номер или комментарий выплаты.",
    scout_locked: "Закрепление меняет только owner.",
  },
  blocks: {
    not_your_model: "не ваша модель", not_eligible: "анкета недоступна", already_member: "уже в составе",
    already_invited: "уже приглашена", invite_limit: "лимит приглашений", busy: "занята в другом туре",
    tour_closed: "тур закрыт", tour_missing: "тур не найден",
  },
  bonusStatus: { pending: "К выплате", paid: "Выплачено", void: "Аннулировано" },
  models: {
    eyebrow: "Скаутинг", title: "Мои модели", subtitle: "Модели, закреплённые за вами как за скаутом. Зовите их в свои туры напрямую, а за их работу в турах других менеджеров получайте скаут-бонус.",
    tabs: { models: "Модели", invites: "Инвайт-ссылки", bonuses: "Скаут-бонусы" },
    empty: "Пока никого. Создайте инвайт-ссылку и отправьте её модели — после регистрации по ней она закрепится за вами.",
    since: (d) => `с ${d}`, inTour: "В туре", ownTour: "ваш тур", inviteToTour: "Пригласить в тур",
    status: { approved: "Одобрена", pending: "На проверке", rejected: "Отклонена" },
    noTelegram: "без Telegram", banned: "ограничена", openToTours: "открыта к турам",
    claimsTitle: "Заявки на закрепление",
    claimStatus: { pending: "ждёт owner", approved: "одобрена", rejected: "отклонена", cancelled: "закрыта" },
    claimReason: { established_account: "давний аккаунт", tour_history: "уже работала в турах" },
    ownerHint: "Вы owner: скаутами всех менеджеров, заявками и выплатами вы управляете в «Контроле туров».",
    ownerLink: "Открыть «Скауты и бонусы»",
    rulesTitle: "Как работает закрепление",
    rules: [
      "Новая модель, зарегистрировавшаяся по вашей ссылке, закрепляется сразу.",
      "Уже зарегистрированная модель подтверждает закрепление кнопкой в боте. Если аккаунт моложе 14 дней и туров ещё не было — сразу, иначе решает owner.",
      "Модель, закреплённую за другим менеджером, переманить нельзя: перезакрепить может только owner.",
      "Ссылка не отменяет фейс-контроль: анкету по-прежнему одобряет клуб.",
    ],
  },
  invites: {
    title: "Инвайт-ссылки для моделей", hint: "Ссылка открывает бота: t.me/<бот>?start=mod_VYM-XXXX-XXXX. Одну ссылку можно отправить нескольким моделям.",
    create: "Создать ссылку", note: "Пометка", notePh: "Например: Instagram, ноябрь", days: "Срок, дней", maxUses: "Использований",
    uses: (u, m) => `${u} из ${m}`, expires: (d) => `до ${d}`, revoke: "Отозвать", revoked: "отозвана", expired: "истекла",
    botMissing: "Не задан NEXT_PUBLIC_BOT_USERNAME — ссылка покажется после настройки, код уже работает в боте: /start mod_<код>.",
    copyLink: "Скопировать ссылку", copied: "Скопировано", empty: "Ссылок пока нет.",
  },
  bonuses: {
    title: "Скаут-бонусы", hint: "Начисляются автоматически, когда ваша модель закрывает заказы в туре другого менеджера. Сумма заказов и детали чужого тура не раскрываются.",
    pending: "К выплате", paid: "Выплачено", empty: "Начислений пока нет.", model: "Модель", where: "Тур", amount: "Бонус", status: "Статус",
  },
  tourInvite: {
    tab: "Прямые приглашения", title: "Позвать своих моделей", hint: "Личное приглашение без публичного кастинга: модель получает уведомление в Telegram и в кабинете, после «Принять участие» сразу попадает в состав и в Комнату тура.",
    candidates: "Ваши закреплённые модели", noCandidates: "У организатора тура нет закреплённых моделей. Инвайт-ссылки — в разделе «Мои модели».",
    message: "Сообщение модели", messagePh: "Коротко: условия, что взять с собой…", hours: "Ответить в течение",
    send: "Отправить приглашения", sending: "Отправляем…", sent: (n, notified) => `Приглашено: ${n}, в Telegram: ${notified}.`, skipped: (n) => `Пропущено: ${n}.`,
    listTitle: "Отправленные приглашения", empty: "Приглашений ещё не было.", revoke: "Отозвать",
    status: { invited: "ждёт ответа", accepted: "в составе", declined: "отказалась", revoked: "отозвано", expired: "истекло" },
    pickTour: "Тур", noTours: "У вас нет открытых туров — сначала создайте тур из кастинга.", modalTitle: (name) => `Пригласить в тур · ${name}`,
    hoursOptions: { "24": "24 часа", "48": "48 часов", "72": "3 дня", "168": "7 дней" },
    telegramOff: "нет Telegram — увидит в кабинете",
  },
  inbox: {
    eyebrow: "Личные приглашения", title: "Вас зовут в тур", scout: (name) => `Ваш менеджер: ${name}`, scoutSince: (d) => `закреплены с ${d}`,
    accept: "Принять участие", decline: "Отказаться", accepted: "Вы в составе тура", declined: "Вы отказались", expired: "Срок ответа истёк", revoked: "Приглашение отозвано",
    openRoom: "Открыть Комнату тура", until: (d) => `ответить до ${d}`, busy: "На эти даты вы уже в другом туре — принять не получится.",
    from: (name) => `от ${name}`, empty: "", confirmDecline: "Точно отказаться? Менеджер увидит ответ.",
  },
  cashbox: { title: "Скаут-бонусы", hint: "Удерживаются из доли агентства, доля модели не меняется. Выплачивает платформа.", net: "Агентству чистыми", byModel: (scout) => `скаут: ${scout}`, pending: "к выплате" },
  owner: {
    eyebrow: "Контроль · Скаутинг", title: "Скауты и бонусы", subtitle: "Закрепления моделей за менеджерами, заявки, начисления и выплаты скаут-бонусов. Видно только owner.", back: "К контролю туров", openLink: "Скауты и бонусы",
    settings: "Ставка платформы", percent: "Скаут-бонус, %", base: "База расчёта", baseTotal: "от суммы заказа", baseAgency: "от доли агентства",
    window: "Окно атрибуции, мес.", windowHint: "0 — бессрочно. Иначе бонус идёт только за заказы в течение N месяцев с момента закрепления.",
    grace: "Льготный срок, дней", graceHint: "Уже зарегистрированную модель младше этого срока и без туров можно закрепить без вашего решения.",
    save: "Сохранить", saved: "Сохранено", settingsHint: "Новая ставка действует только на заказы, закрытые после изменения. Уже начисленное не пересчитывается.",
    totalsPending: "К выплате", totalsPaid: "Выплачено",
    payouts: "К выплате", payoutsHint: "Отметьте строки и укажите номер платёжки. Отрицательные корректировки (отмена после выплаты) зачитываются автоматически.",
    payRef: "Платёжка / комментарий", payRefPh: "PAY-2026-11-01", pay: (n) => `Отметить выплату (${n})`, voidRow: "Аннулировать", voidReason: "Причина аннулирования",
    readyToPay: "тур закрыт", tourOpen: "тур идёт", host: "Удержать с", scout: "Скаут",
    baseText: (pct, kind, amount) => `${pct}% ${kind === "agency" ? "от доли агентства" : "от суммы"} ${amount}`, adjustment: "корректировка",
    claims: "Заявки на закрепление", noClaims: "Заявок нет.", approve: "Закрепить", reject: "Отклонить",
    claimInfo: (created, tours) => `аккаунт с ${created} · туров: ${tours}`,
    scouts: "Менеджеры-скауты", models: "Моделей", withhold: "Удержано с туров", activeInvites: "Ссылок",
    assign: "Ручное закрепление", assignHint: "Найдите модель, выберите менеджера или снимите закрепление. Причина обязательна и попадёт в журнал.",
    search: "Модель", searchPh: "Имя, email или @ник", current: (name) => (name ? `сейчас: ${name}` : "не закреплена"), pickManager: "Менеджер", clear: "Снять закрепление",
    reason: "Причина", reasonPh: "Например: модель попросила сменить менеджера", apply: "Применить", log: "Журнал закреплений",
    logAction: {
      attached_new: "закреплена при регистрации", attached_existing: "закреплена по ссылке", claim_created: "заявка на закрепление",
      claim_approved: "заявка одобрена", claim_rejected: "заявка отклонена", owner_set: "закрепил owner", owner_cleared: "owner снял закрепление",
      conflict: "конфликт: уже у другого скаута", already_attached: "уже закреплена",
    },
    noPayouts: "Нечего выплачивать.",
  },
};

const EN: ScoutDict = {
  errors: {
    forbidden: "You don’t have access to this action.", failed: "Something went wrong. Please try again.",
    too_many_invites: "You already have 20 active links — revoke old ones.", pick_models: "Pick at least one model.",
    too_many_residents: "Up to 30 models at a time.", invite_not_found: "Invitation not found.", invite_closed: "This invitation is closed.",
    invite_expired: "The invitation has expired.", tour_closed: "The tour is already closed.", not_eligible: "Participation isn’t available right now: check your profile status.",
    busy: "You are already in another tour on these dates.", reason_required: "Give a reason (3+ characters).", not_pending: "Already processed.",
    other_scout: "The model is already attached to another manager.", scout_inactive: "This manager can’t be a scout right now.",
    not_a_model: "This is not a model profile.", payout_ref_required: "Enter a payout reference.", scout_locked: "Only the owner can change the attachment.",
  },
  blocks: {
    not_your_model: "not your model", not_eligible: "profile unavailable", already_member: "already in crew", already_invited: "already invited",
    invite_limit: "invite limit", busy: "busy in another tour", tour_closed: "tour closed", tour_missing: "tour not found",
  },
  bonusStatus: { pending: "To be paid", paid: "Paid", void: "Void" },
  models: {
    eyebrow: "Scouting", title: "My models", subtitle: "Models attached to you as their scout. Invite them to your tours directly and earn a scout bonus when they work in other managers’ tours.",
    tabs: { models: "Models", invites: "Invite links", bonuses: "Scout bonuses" },
    empty: "No one yet. Create an invite link and send it to a model — once she signs up with it, she’s attached to you.",
    since: (d) => `since ${d}`, inTour: "In tour", ownTour: "your tour", inviteToTour: "Invite to a tour",
    status: { approved: "Approved", pending: "In review", rejected: "Rejected" }, noTelegram: "no Telegram", banned: "restricted", openToTours: "open to tours",
    claimsTitle: "Attachment requests", claimStatus: { pending: "awaiting owner", approved: "approved", rejected: "rejected", cancelled: "closed" },
    claimReason: { established_account: "established account", tour_history: "has tour history" },
    ownerHint: "You are the owner: manage all scouts, requests and payouts in Tour Control.", ownerLink: "Open “Scouts & bonuses”",
    rulesTitle: "How attachment works",
    rules: [
      "A new model who signs up with your link is attached right away.",
      "An existing model confirms with a button in the bot. If the account is under 14 days old with no tours — right away, otherwise the owner decides.",
      "A model attached to another manager can’t be poached: only the owner can reassign.",
      "The link doesn’t skip face control: the club still approves the profile.",
    ],
  },
  invites: {
    title: "Invite links for models", hint: "The link opens the bot: t.me/<bot>?start=mod_VYM-XXXX-XXXX. One link can go to several models.",
    create: "Create link", note: "Note", notePh: "e.g. Instagram, November", days: "Valid, days", maxUses: "Uses",
    uses: (u, m) => `${u} of ${m}`, expires: (d) => `until ${d}`, revoke: "Revoke", revoked: "revoked", expired: "expired",
    botMissing: "NEXT_PUBLIC_BOT_USERNAME is not set — the link will appear once it is; the code already works in the bot: /start mod_<code>.",
    copyLink: "Copy link", copied: "Copied", empty: "No links yet.",
  },
  bonuses: {
    title: "Scout bonuses", hint: "Accrued automatically when your model completes bookings in another manager’s tour. Booking amounts and tour details stay private.",
    pending: "To be paid", paid: "Paid", empty: "No accruals yet.", model: "Model", where: "Tour", amount: "Bonus", status: "Status",
  },
  tourInvite: {
    tab: "Direct invites", title: "Invite your models", hint: "A personal invite without a public casting: the model is notified in Telegram and in her cabinet; after “Join the tour” she is in the crew and the Tour Room right away.",
    candidates: "Your attached models", noCandidates: "The tour organizer has no attached models. Invite links are in “My models”.",
    message: "Message to the model", messagePh: "Briefly: terms, what to bring…", hours: "Reply within",
    send: "Send invites", sending: "Sending…", sent: (n, notified) => `Invited: ${n}, via Telegram: ${notified}.`, skipped: (n) => `Skipped: ${n}.`,
    listTitle: "Sent invites", empty: "No invites yet.", revoke: "Revoke",
    status: { invited: "awaiting reply", accepted: "in crew", declined: "declined", revoked: "revoked", expired: "expired" },
    pickTour: "Tour", noTours: "You have no open tours — create one from a casting first.", modalTitle: (name) => `Invite to a tour · ${name}`,
    hoursOptions: { "24": "24 hours", "48": "48 hours", "72": "3 days", "168": "7 days" }, telegramOff: "no Telegram — will see it in the cabinet",
  },
  inbox: {
    eyebrow: "Personal invites", title: "You’re invited to a tour", scout: (name) => `Your manager: ${name}`, scoutSince: (d) => `attached since ${d}`,
    accept: "Join the tour", decline: "Decline", accepted: "You’re in the crew", declined: "You declined", expired: "Reply time is over", revoked: "Invitation withdrawn",
    openRoom: "Open the Tour Room", until: (d) => `reply by ${d}`, busy: "You’re already in another tour on these dates — you can’t accept.",
    from: (name) => `from ${name}`, empty: "", confirmDecline: "Decline for sure? The manager will see your answer.",
  },
  cashbox: { title: "Scout bonuses", hint: "Withheld from the agency share; the model’s share is unchanged. Paid by the platform.", net: "Agency net", byModel: (scout) => `scout: ${scout}`, pending: "to be paid" },
  owner: {
    eyebrow: "Control · Scouting", title: "Scouts & bonuses", subtitle: "Model attachments, requests, scout bonus accruals and payouts. Owner only.", back: "Back to Tour Control", openLink: "Scouts & bonuses",
    settings: "Platform rate", percent: "Scout bonus, %", base: "Base", baseTotal: "of booking total", baseAgency: "of agency share",
    window: "Attribution window, months", windowHint: "0 — no limit. Otherwise the bonus applies only to bookings within N months of attachment.",
    grace: "Grace period, days", graceHint: "An existing model younger than this with no tours can be attached without your decision.",
    save: "Save", saved: "Saved", settingsHint: "A new rate applies only to bookings completed after the change. Past accruals are never recalculated.",
    totalsPending: "To be paid", totalsPaid: "Paid",
    payouts: "To be paid", payoutsHint: "Select rows and enter the payout reference. Negative adjustments (cancellation after payout) are netted automatically.",
    payRef: "Payout reference", payRefPh: "PAY-2026-11-01", pay: (n) => `Mark as paid (${n})`, voidRow: "Void", voidReason: "Reason to void",
    readyToPay: "tour closed", tourOpen: "tour running", host: "Withhold from", scout: "Scout",
    baseText: (pct, kind, amount) => `${pct}% ${kind === "agency" ? "of agency share" : "of total"} ${amount}`, adjustment: "adjustment",
    claims: "Attachment requests", noClaims: "No requests.", approve: "Attach", reject: "Reject", claimInfo: (created, tours) => `account since ${created} · tours: ${tours}`,
    scouts: "Scout managers", models: "Models", withhold: "Withheld from tours", activeInvites: "Links",
    assign: "Manual attachment", assignHint: "Find a model, pick a manager or clear the attachment. A reason is required and goes to the log.",
    search: "Model", searchPh: "Name, email or @handle", current: (name) => (name ? `now: ${name}` : "not attached"), pickManager: "Manager", clear: "Clear attachment",
    reason: "Reason", reasonPh: "e.g. the model asked to switch managers", apply: "Apply", log: "Attachment log",
    logAction: {
      attached_new: "attached at sign-up", attached_existing: "attached via link", claim_created: "attachment request", claim_approved: "request approved",
      claim_rejected: "request rejected", owner_set: "set by owner", owner_cleared: "cleared by owner", conflict: "conflict: has another scout", already_attached: "already attached",
    },
    noPayouts: "Nothing to pay.",
  },
};

const ES: ScoutDict = {
  ...EN,
  errors: { ...EN.errors, forbidden: "No tienes acceso a esta acción.", failed: "Algo salió mal. Inténtalo de nuevo.", busy: "Ya estás en otro tour en estas fechas.", invite_expired: "La invitación ha caducado.", tour_closed: "El tour ya está cerrado." },
  blocks: { not_your_model: "no es tu modelo", not_eligible: "perfil no disponible", already_member: "ya en el equipo", already_invited: "ya invitada", invite_limit: "límite de invitaciones", busy: "ocupada en otro tour", tour_closed: "tour cerrado", tour_missing: "tour no encontrado" },
  bonusStatus: { pending: "Por pagar", paid: "Pagado", void: "Anulado" },
  models: {
    ...EN.models, eyebrow: "Scouting", title: "Mis modelos", subtitle: "Modelos vinculadas a ti como scout. Invítalas a tus tours directamente y recibe un bono scout cuando trabajen en tours de otros gerentes.",
    tabs: { models: "Modelos", invites: "Enlaces", bonuses: "Bonos scout" }, inviteToTour: "Invitar a un tour", inTour: "En tour", ownTour: "tu tour",
    empty: "Aún nadie. Crea un enlace y envíalo a una modelo: al registrarse con él quedará vinculada a ti.", since: (d) => `desde ${d}`,
    status: { approved: "Aprobada", pending: "En revisión", rejected: "Rechazada" }, claimsTitle: "Solicitudes de vinculación", rulesTitle: "Cómo funciona la vinculación",
  },
  invites: { ...EN.invites, title: "Enlaces de invitación", create: "Crear enlace", note: "Nota", days: "Días", maxUses: "Usos", revoke: "Revocar", copyLink: "Copiar enlace", copied: "Copiado", empty: "Aún no hay enlaces.", uses: (u, m) => `${u} de ${m}`, expires: (d) => `hasta ${d}` },
  bonuses: { ...EN.bonuses, title: "Bonos scout", pending: "Por pagar", paid: "Pagado", empty: "Aún no hay bonos.", model: "Modelo", amount: "Bono", status: "Estado" },
  tourInvite: {
    ...EN.tourInvite, tab: "Invitaciones directas", title: "Invita a tus modelos", candidates: "Tus modelos vinculadas", message: "Mensaje a la modelo", hours: "Responder en",
    send: "Enviar invitaciones", sending: "Enviando…", sent: (n, notified) => `Invitadas: ${n}, por Telegram: ${notified}.`, skipped: (n) => `Omitidas: ${n}.`,
    listTitle: "Invitaciones enviadas", empty: "Aún no hay invitaciones.", revoke: "Revocar", pickTour: "Tour", modalTitle: (name) => `Invitar a un tour · ${name}`,
    status: { invited: "esperando", accepted: "en el equipo", declined: "rechazó", revoked: "revocada", expired: "caducada" },
    hoursOptions: { "24": "24 horas", "48": "48 horas", "72": "3 días", "168": "7 días" },
  },
  inbox: {
    ...EN.inbox, eyebrow: "Invitaciones personales", title: "Te invitan a un tour", scout: (name) => `Tu gerente: ${name}`, scoutSince: (d) => `vinculada desde ${d}`,
    accept: "Participar", decline: "Rechazar", accepted: "Estás en el equipo", declined: "Has rechazado", expired: "El plazo terminó", revoked: "Invitación retirada",
    openRoom: "Abrir la Sala del tour", until: (d) => `responder antes del ${d}`, busy: "Ya estás en otro tour en estas fechas.", from: (name) => `de ${name}`, confirmDecline: "¿Seguro que rechazas?",
  },
  cashbox: { title: "Bonos scout", hint: "Se descuentan de la parte de la agencia; la parte de la modelo no cambia.", net: "Neto agencia", byModel: (scout) => `scout: ${scout}`, pending: "por pagar" },
};

const PT: ScoutDict = {
  ...EN,
  errors: { ...EN.errors, forbidden: "Você não tem acesso a esta ação.", failed: "Algo deu errado. Tente de novo.", busy: "Você já está em outro tour nessas datas.", invite_expired: "O convite expirou.", tour_closed: "O tour já está fechado." },
  blocks: { not_your_model: "não é sua modelo", not_eligible: "perfil indisponível", already_member: "já na equipe", already_invited: "já convidada", invite_limit: "limite de convites", busy: "ocupada em outro tour", tour_closed: "tour fechado", tour_missing: "tour não encontrado" },
  bonusStatus: { pending: "A pagar", paid: "Pago", void: "Anulado" },
  models: {
    ...EN.models, eyebrow: "Scouting", title: "Minhas modelos", subtitle: "Modelos vinculadas a você como scout. Convide-as diretamente para seus tours e receba bônus scout quando trabalharem em tours de outros gerentes.",
    tabs: { models: "Modelos", invites: "Links", bonuses: "Bônus scout" }, inviteToTour: "Convidar para um tour", inTour: "Em tour", ownTour: "seu tour",
    empty: "Ninguém ainda. Crie um link e envie para uma modelo: ao se cadastrar com ele, ela fica vinculada a você.", since: (d) => `desde ${d}`,
    status: { approved: "Aprovada", pending: "Em análise", rejected: "Recusada" }, claimsTitle: "Pedidos de vínculo", rulesTitle: "Como funciona o vínculo",
  },
  invites: { ...EN.invites, title: "Links de convite", create: "Criar link", note: "Nota", days: "Dias", maxUses: "Usos", revoke: "Revogar", copyLink: "Copiar link", copied: "Copiado", empty: "Ainda não há links.", uses: (u, m) => `${u} de ${m}`, expires: (d) => `até ${d}` },
  bonuses: { ...EN.bonuses, title: "Bônus scout", pending: "A pagar", paid: "Pago", empty: "Ainda não há bônus.", model: "Modelo", amount: "Bônus", status: "Status" },
  tourInvite: {
    ...EN.tourInvite, tab: "Convites diretos", title: "Convide suas modelos", candidates: "Suas modelos vinculadas", message: "Mensagem para a modelo", hours: "Responder em",
    send: "Enviar convites", sending: "Enviando…", sent: (n, notified) => `Convidadas: ${n}, pelo Telegram: ${notified}.`, skipped: (n) => `Ignoradas: ${n}.`,
    listTitle: "Convites enviados", empty: "Ainda não há convites.", revoke: "Revogar", pickTour: "Tour", modalTitle: (name) => `Convidar para um tour · ${name}`,
    status: { invited: "aguardando", accepted: "na equipe", declined: "recusou", revoked: "revogado", expired: "expirado" },
    hoursOptions: { "24": "24 horas", "48": "48 horas", "72": "3 dias", "168": "7 dias" },
  },
  inbox: {
    ...EN.inbox, eyebrow: "Convites pessoais", title: "Você foi convidada para um tour", scout: (name) => `Seu gerente: ${name}`, scoutSince: (d) => `vinculada desde ${d}`,
    accept: "Participar", decline: "Recusar", accepted: "Você está na equipe", declined: "Você recusou", expired: "O prazo acabou", revoked: "Convite retirado",
    openRoom: "Abrir a Sala do tour", until: (d) => `responder até ${d}`, busy: "Você já está em outro tour nessas datas.", from: (name) => `de ${name}`, confirmDecline: "Recusar mesmo?",
  },
  cashbox: { title: "Bônus scout", hint: "Descontado da parte da agência; a parte da modelo não muda.", net: "Líquido da agência", byModel: (scout) => `scout: ${scout}`, pending: "a pagar" },
};

const DICTS: Record<Lang, ScoutDict> = { RU, EN, ES, PT };
export const scoutDict = (lang: Lang): ScoutDict => DICTS[lang] ?? EN;
export const scoutError = (t: ScoutDict, code: string): string => t.errors[code] ?? t.errors.failed;
