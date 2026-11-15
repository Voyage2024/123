/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Кабинет скаута — тексты RU / EN / ES / PT
 * lib/scouting/cabinet-i18n.ts
 * ──────────────────────────────────────────────────────────────────── */

import type { FunnelStep, LedgerStatus, NextStep, PayoutMethod, ShowcaseFit, StepState } from "@/lib/scouting/cabinet";
import type { UiLang } from "@/lib/tour-ops/time";

type Dict = {
  eyebrow: string;
  pages: Record<"models" | "castings" | "earnings" | "profile", { title: string; subtitle: string }>;
  stats: { models: string; ready: string; inTour: string; pending: string; paid: string };
  funnel: Record<FunnelStep, string>;
  state: Record<StepState, string>;
  next: {
    restricted: string; not_approved: string; in_tour: (where: string) => string; photo: string; review: string;
    kyc_review: (level: number) => string; kyc: (level: number) => string; open_to_tours: string; ready: (n: number) => string; waiting: string;
  };
  lastSeen: (days: number) => string;
  privacy: string;
  emptyModels: string;
  nudge: {
    button: string; sent: string; sentNoTelegram: string; tooSoon: (at: string) => string; dailyLimit: string;
    kinds: Record<"photo" | "kyc" | "open_to_tours" | "casting", string>;
  };
  links: {
    title: string; hint: string; create: string; note: string; days: string; maxUses: string; copy: string; copied: string;
    revoke: string; uses: (u: number, m: number) => string; until: (d: string) => string; status: Record<"active" | "revoked" | "expired", string>;
    noBot: string; empty: string;
  };
  claims: { title: string; status: Record<string, string> };
  showcase: {
    empty: string; closes: (d: string) => string; fresh: string; privacy: string; models: string;
    fit: Record<ShowcaseFit, string>; fitKyc: (level: number) => string; tell: string;
  };
  earnings: {
    terms: (pct: string, base: string, personal: boolean) => string; base: Record<"total" | "agency", string>; window: (m: number) => string;
    lifelong: string; noDetails: string; detailsOn: (masked: string) => string;
    head: { date: string; model: string; tour: string; amount: string; status: string; payout: string };
    status: Record<LedgerStatus, string>; voidReason: Record<string, string>; adjusted: string; payoutLine: (ref: string, masked: string) => string;
    payoutsTitle: string; empty: string; filterAll: string;
  };
  profile: {
    name: string; telegram: string; phone: string; since: string; referredBy: string; rate: string; rateValue: (pct: string, personal: boolean) => string;
    payoutTitle: string; payoutHint: string; method: string; methods: Record<PayoutMethod, string>; details: string;
    detailsHint: Record<PayoutMethod, string>; holder: string; save: string; saved: (masked: string) => string; updatedAt: (d: string) => string;
    security: string; noTelegram: string;
  };
  recruit: { title: string; hint: string; create: string; empty: string; uses: (u: number, m: number) => string; ownerAuto: string };
  errors: Record<string, string>;
};

const RU: Dict = {
  eyebrow: "Кабинет скаута",
  pages: {
    models: { title: "Мои модели и ссылки", subtitle: "Путь каждой модели в клубе — от регистрации до тура — и подсказки, что ей сделать дальше." },
    castings: { title: "Кастинги для моделей", subtitle: "Открытые кастинги, которые подходят вашим моделям. Без гонорара, брифа и контактов менеджеров." },
    earnings: { title: "Начисления и выплаты", subtitle: "Каждый бонус: модель, тур, сумма и статус. Бонус платит клуб из доли принимающего менеджера — доля модели не уменьшается." },
    profile: { title: "Профиль", subtitle: "Контакт, ставка и реквизиты для выплат." },
  },
  stats: { models: "Моделей", ready: "Готовы к туру", inTour: "В туре", pending: "К выплате", paid: "Выплачено" },
  funnel: { registered: "Регистрация", photo: "Фото · KYC 0", kyc1: "Паспорт · KYC 1", kyc2: "Видео · KYC 2", approved: "Одобрена клубом", in_tour: "В туре" },
  state: { done: "готово", pending: "на проверке", todo: "не сделано" },
  next: {
    restricted: "Доступ ограничен клубом. Подробности — у owner.",
    not_approved: "Анкета не прошла проверку клуба.",
    in_tour: (w) => `В туре: ${w}`,
    photo: "Нет фото в профиле — без него кастинги закрыты.",
    review: "Анкета на проверке у клуба.",
    kyc_review: (l) => `Документы на проверке (KYC ${l}).`,
    kyc: (l) => `Ждёт KYC ${l}: без него открытые кастинги недоступны.`,
    open_to_tours: "Не включено «Готова к турам».",
    ready: (n) => `Готова: подходит к открытым кастингам (${n}).`,
    waiting: "Готова, ждёт подходящий кастинг.",
  },
  lastSeen: (d) => (d === 0 ? "заходила сегодня" : d === 1 ? "заходила вчера" : `заходила ${d} дн. назад`),
  privacy: "Вы видите только этапы. Документы, фото паспорта, заработок и контакты модели скрыты.",
  emptyModels: "Пока нет моделей. Создайте ссылку справа и отправьте её модели: после регистрации по ней модель закрепится за вами навсегда.",
  nudge: {
    button: "Напомнить",
    sent: "Напоминание отправлено модели в Telegram.",
    sentNoTelegram: "Сохранено, но у модели не привязан Telegram — она увидит подсказку в кабинете.",
    tooSoon: (at) => `Модели уже напоминали. Следующее — после ${at}.`,
    dailyLimit: "На сегодня лимит напоминаний исчерпан.",
    kinds: { photo: "про фото", kyc: "про верификацию", open_to_tours: "про «Готова к турам»", casting: "про кастинг" },
  },
  links: {
    title: "Мои ссылки", hint: "Ссылка ведёт в бота: модель регистрируется и закрепляется за вами. Кто привёл первым — того и модель.",
    create: "Создать ссылку", note: "Пометка (где разместили)", days: "Срок, дней", maxUses: "Регистраций", copy: "Копировать", copied: "Скопировано",
    revoke: "Отозвать", uses: (u, m) => `${u} из ${m}`, until: (d) => `до ${d}`, status: { active: "активна", revoked: "отозвана", expired: "истекла" },
    noBot: "Ссылка появится, когда в настройках сайта задан бот (NEXT_PUBLIC_BOT_USERNAME). Код можно передать модели вручную: /start mod_КОД.",
    empty: "Ссылок пока нет.",
  },
  claims: { title: "Заявки на закрепление", status: { pending: "у owner", approved: "одобрена", rejected: "отклонена", cancelled: "отменена" } },
  showcase: {
    empty: "Сейчас нет открытых кастингов для ваших одобренных моделей.",
    closes: (d) => `отклик до ${d}`,
    fresh: "новый",
    privacy: "Модель откликается сама в своём кабинете. Вы видите только город, даты и требуемый уровень верификации.",
    models: "Ваши модели",
    fit: { responded: "откликнулась", photo: "нужно фото", kyc: "нужен KYC", open_to_tours: "не готова к турам", ready: "подходит" },
    fitKyc: (l) => `нужен KYC ${l}`,
    tell: "Рассказать",
  },
  earnings: {
    terms: (p, b, personal) => `Ваша ставка: ${p} ${b}${personal ? " · персональная" : ""}.`,
    base: { total: "от суммы заказа", agency: "от доли агентства" },
    window: (m) => `Бонус начисляется по турам в течение ${m} мес. после закрепления модели.`,
    lifelong: "Бонус начисляется со всех туров модели у любого менеджера, без срока.",
    noDetails: "Укажите реквизиты в профиле — без них owner не сможет провести выплату.",
    detailsOn: (m) => `Выплаты на ${m}`,
    head: { date: "Дата", model: "Модель", tour: "Тур", amount: "Бонус", status: "Статус", payout: "Выплата" },
    status: { pending: "к выплате", paid: "выплачено", void: "аннулировано" },
    voidReason: { booking_cancelled: "заказ отменён", booking_deleted: "заказ удалён", owner: "решение owner" },
    adjusted: "с корректировкой",
    payoutLine: (r, m) => `${r}${m ? ` · ${m}` : ""}`,
    payoutsTitle: "История выплат",
    empty: "Начислений пока нет. Бонус появится, когда ваша модель закроет заказ в туре другого менеджера.",
    filterAll: "Все",
  },
  profile: {
    name: "Имя", telegram: "Telegram", phone: "Телефон", since: "Скаут с", referredBy: "Пригласил(а)", rate: "Ставка",
    rateValue: (p, personal) => `${p}${personal ? " · персональная (назначил owner)" : " · общая ставка клуба"}`,
    payoutTitle: "Реквизиты для выплат",
    payoutHint: "owner видит их, когда проводит выплату пачкой. Номер транзакции или платёжки появится у каждого бонуса.",
    method: "Способ", methods: { usdt_trc20: "USDT · TRC-20", usdt_erc20: "USDT · ERC-20", bank_transfer: "Банковский перевод", other: "Другое" },
    details: "Реквизиты",
    detailsHint: {
      usdt_trc20: "Адрес кошелька TRC-20, начинается с T (34 символа).",
      usdt_erc20: "Адрес кошелька ERC-20, начинается с 0x (42 символа).",
      bank_transfer: "IBAN / SWIFT / телефон для СБП. Полный номер карты не храним — укажите счёт.",
      other: "Как удобно получить выплату (без полного номера карты).",
    },
    holder: "Получатель (ФИО или название)", save: "Сохранить реквизиты", saved: (m) => `Сохранено: ${m}`, updatedAt: (d) => `Изменены ${d}`,
    security: "Каждая смена реквизитов приходит вам в Telegram и записывается в журнал. Если вы не меняли их — смените пароль и напишите owner.",
    noTelegram: "Telegram не привязан — уведомления о моделях и выплатах не придут.",
  },
  recruit: {
    title: "Пригласить скаута",
    hint: "Ссылка VYS для человека, который будет приводить моделей, но не вести туры. Заявку по ней одобряет owner; модели и бонусы будут его, а не ваши.",
    create: "Создать ссылку для скаута", empty: "Ссылок для скаутов пока нет.", uses: (u, m) => `${u} из ${m}`,
    ownerAuto: "Ссылка owner открывает кабинет скаута сразу, без модерации.",
  },
  errors: {
    forbidden: "Нет доступа.", failed: "Не получилось. Попробуйте ещё раз.", not_your_model: "Эта модель закреплена не за вами.",
    nudge_unavailable: "Этой модели сейчас нельзя отправить напоминание.", casting_closed: "Кастинг уже закрыт.",
    nudge_kind_invalid: "Неизвестный тип напоминания.", payout_wallet_invalid: "Неверный адрес кошелька для выбранной сети.",
    payout_card_forbidden: "Полный номер карты не принимаем. Укажите счёт, IBAN или кошелёк.",
    payout_details_invalid: "Заполните реквизиты (до 300 символов).", payout_method_invalid: "Выберите способ выплаты.",
    too_many_invites: "Слишком много активных ссылок — отзовите старые.",
  },
};

const EN: Dict = {
  eyebrow: "Scout desk",
  pages: {
    models: { title: "My models & links", subtitle: "Each model’s path in the club, from sign-up to tour, and what she should do next." },
    castings: { title: "Castings for my models", subtitle: "Open castings that fit your models. No fees, briefs or manager contacts." },
    earnings: { title: "Earnings & payouts", subtitle: "Every bonus: model, tour, amount and status. The club pays it from the host manager’s share; the model’s share never shrinks." },
    profile: { title: "Profile", subtitle: "Contact, rate and payout details." },
  },
  stats: { models: "Models", ready: "Tour-ready", inTour: "On tour", pending: "To be paid", paid: "Paid" },
  funnel: { registered: "Signed up", photo: "Photo · KYC 0", kyc1: "Passport · KYC 1", kyc2: "Video · KYC 2", approved: "Approved by club", in_tour: "On tour" },
  state: { done: "done", pending: "in review", todo: "not yet" },
  next: {
    restricted: "Access restricted by the club. Ask the owner for details.",
    not_approved: "The application did not pass the club review.",
    in_tour: (w) => `On tour: ${w}`,
    photo: "No photo — castings stay closed without one.",
    review: "Application under club review.",
    kyc_review: (l) => `Documents under review (KYC ${l}).`,
    kyc: (l) => `Needs KYC ${l} to access open castings.`,
    open_to_tours: "“Open to tours” is switched off.",
    ready: (n) => `Ready: fits open castings (${n}).`,
    waiting: "Ready, waiting for a matching casting.",
  },
  lastSeen: (d) => (d === 0 ? "active today" : d === 1 ? "active yesterday" : `active ${d} days ago`),
  privacy: "You only see the steps. Documents, passport photos, earnings and contacts stay hidden.",
  emptyModels: "No models yet. Create a link on the right and send it to a model: once she signs up with it, she is attached to you for good.",
  nudge: {
    button: "Remind",
    sent: "Reminder sent to the model in Telegram.",
    sentNoTelegram: "Saved, but the model has no Telegram linked — she will see a hint in her cabinet.",
    tooSoon: (at) => `The model was reminded recently. Next one after ${at}.`,
    dailyLimit: "Daily reminder limit reached.",
    kinds: { photo: "about the photo", kyc: "about verification", open_to_tours: "about “Open to tours”", casting: "about the casting" },
  },
  links: {
    title: "My links", hint: "The link opens the bot: the model signs up and is attached to you. Whoever brings her first keeps her.",
    create: "Create link", note: "Note (where you posted it)", days: "Valid, days", maxUses: "Sign-ups", copy: "Copy", copied: "Copied",
    revoke: "Revoke", uses: (u, m) => `${u} of ${m}`, until: (d) => `until ${d}`, status: { active: "active", revoked: "revoked", expired: "expired" },
    noBot: "The link appears once the bot is configured (NEXT_PUBLIC_BOT_USERNAME). You can share the code manually: /start mod_CODE.",
    empty: "No links yet.",
  },
  claims: { title: "Attachment requests", status: { pending: "with owner", approved: "approved", rejected: "declined", cancelled: "cancelled" } },
  showcase: {
    empty: "No open castings for your approved models right now.",
    closes: (d) => `apply by ${d}`,
    fresh: "new",
    privacy: "The model applies herself in her cabinet. You only see the city, dates and required verification level.",
    models: "Your models",
    fit: { responded: "applied", photo: "needs photo", kyc: "needs KYC", open_to_tours: "not open to tours", ready: "fits" },
    fitKyc: (l) => `needs KYC ${l}`,
    tell: "Tell her",
  },
  earnings: {
    terms: (p, b, personal) => `Your rate: ${p} ${b}${personal ? " · personal" : ""}.`,
    base: { total: "of the booking total", agency: "of the agency share" },
    window: (m) => `Bonuses accrue on tours within ${m} months after the model was attached.`,
    lifelong: "Bonuses accrue on all of the model’s tours with any manager, with no time limit.",
    noDetails: "Add payout details in your profile so the owner can pay you.",
    detailsOn: (m) => `Payouts to ${m}`,
    head: { date: "Date", model: "Model", tour: "Tour", amount: "Bonus", status: "Status", payout: "Payout" },
    status: { pending: "to be paid", paid: "paid", void: "voided" },
    voidReason: { booking_cancelled: "booking cancelled", booking_deleted: "booking deleted", owner: "owner decision" },
    adjusted: "adjusted",
    payoutLine: (r, m) => `${r}${m ? ` · ${m}` : ""}`,
    payoutsTitle: "Payout history",
    empty: "No earnings yet. A bonus appears once your model completes a booking in another manager’s tour.",
    filterAll: "All",
  },
  profile: {
    name: "Name", telegram: "Telegram", phone: "Phone", since: "Scout since", referredBy: "Invited by", rate: "Rate",
    rateValue: (p, personal) => `${p}${personal ? " · personal (set by the owner)" : " · club rate"}`,
    payoutTitle: "Payout details",
    payoutHint: "The owner sees them when paying in batch. Each bonus will show the transaction or payment reference.",
    method: "Method", methods: { usdt_trc20: "USDT · TRC-20", usdt_erc20: "USDT · ERC-20", bank_transfer: "Bank transfer", other: "Other" },
    details: "Details",
    detailsHint: {
      usdt_trc20: "TRC-20 wallet address starting with T (34 characters).",
      usdt_erc20: "ERC-20 wallet address starting with 0x (42 characters).",
      bank_transfer: "IBAN / SWIFT / account. We don’t store full card numbers.",
      other: "How you’d like to be paid (no full card numbers).",
    },
    holder: "Recipient (name or company)", save: "Save details", saved: (m) => `Saved: ${m}`, updatedAt: (d) => `Changed ${d}`,
    security: "Every change is sent to your Telegram and logged. If you didn’t change them, change your password and contact the owner.",
    noTelegram: "Telegram is not linked — model and payout notifications won’t reach you.",
  },
  recruit: {
    title: "Invite a scout",
    hint: "A VYS link for someone who will bring models but won’t run tours. The owner approves the application; the models and bonuses will be theirs, not yours.",
    create: "Create scout link", empty: "No scout links yet.", uses: (u, m) => `${u} of ${m}`,
    ownerAuto: "An owner link opens the scout desk right away, without moderation.",
  },
  errors: {
    forbidden: "Access denied.", failed: "Something went wrong. Please try again.", not_your_model: "This model isn’t attached to you.",
    nudge_unavailable: "This model can’t be reminded right now.", casting_closed: "The casting is closed.",
    nudge_kind_invalid: "Unknown reminder type.", payout_wallet_invalid: "Invalid wallet address for the selected network.",
    payout_card_forbidden: "Full card numbers aren’t accepted. Use an account, IBAN or wallet.",
    payout_details_invalid: "Fill in the details (up to 300 characters).", payout_method_invalid: "Choose a payout method.",
    too_many_invites: "Too many active links — revoke old ones.",
  },
};

const ES: Dict = {
  ...EN,
  eyebrow: "Panel de scout",
  pages: {
    models: { title: "Mis modelos y enlaces", subtitle: "El camino de cada modelo en el club, del registro al tour, y qué debe hacer después." },
    castings: { title: "Castings para mis modelos", subtitle: "Castings abiertos que encajan con tus modelos. Sin honorarios, brief ni contactos de gerentes." },
    earnings: { title: "Bonos y pagos", subtitle: "Cada bono: modelo, tour, importe y estado. El club lo paga de la parte del gerente anfitrión; la parte de la modelo no cambia." },
    profile: { title: "Perfil", subtitle: "Contacto, tarifa y datos de pago." },
  },
  stats: { models: "Modelos", ready: "Listas para tour", inTour: "En tour", pending: "Por pagar", paid: "Pagado" },
  funnel: { registered: "Registro", photo: "Foto · KYC 0", kyc1: "Pasaporte · KYC 1", kyc2: "Vídeo · KYC 2", approved: "Aprobada por el club", in_tour: "En tour" },
  state: { done: "hecho", pending: "en revisión", todo: "pendiente" },
  next: {
    restricted: "Acceso restringido por el club.", not_approved: "La solicitud no pasó la revisión.", in_tour: (w) => `En tour: ${w}`,
    photo: "Sin foto: sin ella los castings están cerrados.", review: "Solicitud en revisión del club.",
    kyc_review: (l) => `Documentos en revisión (KYC ${l}).`, kyc: (l) => `Necesita KYC ${l} para los castings abiertos.`,
    open_to_tours: "«Disponible para tours» desactivado.", ready: (n) => `Lista: encaja en castings abiertos (${n}).`, waiting: "Lista, espera un casting adecuado.",
  },
  lastSeen: (d) => (d === 0 ? "activa hoy" : d === 1 ? "activa ayer" : `activa hace ${d} días`),
  privacy: "Solo ves las etapas. Documentos, fotos del pasaporte, ingresos y contactos están ocultos.",
  emptyModels: "Aún no hay modelos. Crea un enlace y envíaselo a una modelo: al registrarse con él quedará vinculada a ti.",
  nudge: { ...EN.nudge, button: "Recordar", sent: "Recordatorio enviado por Telegram.", dailyLimit: "Límite diario de recordatorios alcanzado." },
  links: { ...EN.links, title: "Mis enlaces", create: "Crear enlace", copy: "Copiar", copied: "Copiado", revoke: "Revocar", empty: "Aún no hay enlaces." },
  showcase: { ...EN.showcase, empty: "No hay castings abiertos para tus modelos aprobadas.", models: "Tus modelos", tell: "Avisar" },
  earnings: {
    ...EN.earnings,
    status: { pending: "por pagar", paid: "pagado", void: "anulado" },
    head: { date: "Fecha", model: "Modelo", tour: "Tour", amount: "Bono", status: "Estado", payout: "Pago" },
    payoutsTitle: "Historial de pagos", filterAll: "Todos",
  },
  profile: { ...EN.profile, payoutTitle: "Datos de pago", save: "Guardar datos", method: "Método", details: "Datos", holder: "Titular" },
};

const PT: Dict = {
  ...EN,
  eyebrow: "Painel do scout",
  pages: {
    models: { title: "Minhas modelos e links", subtitle: "O caminho de cada modelo no clube, do cadastro ao tour, e o que ela deve fazer a seguir." },
    castings: { title: "Castings para minhas modelos", subtitle: "Castings abertos que combinam com suas modelos. Sem cachê, briefing ou contatos de gerentes." },
    earnings: { title: "Bônus e pagamentos", subtitle: "Cada bônus: modelo, tour, valor e status. O clube paga da parte do gerente anfitrião; a parte da modelo não muda." },
    profile: { title: "Perfil", subtitle: "Contato, taxa e dados de pagamento." },
  },
  stats: { models: "Modelos", ready: "Prontas para tour", inTour: "Em tour", pending: "A pagar", paid: "Pago" },
  funnel: { registered: "Cadastro", photo: "Foto · KYC 0", kyc1: "Passaporte · KYC 1", kyc2: "Vídeo · KYC 2", approved: "Aprovada pelo clube", in_tour: "Em tour" },
  state: { done: "feito", pending: "em análise", todo: "pendente" },
  next: {
    restricted: "Acesso restrito pelo clube.", not_approved: "A solicitação não passou na revisão.", in_tour: (w) => `Em tour: ${w}`,
    photo: "Sem foto — sem ela os castings ficam fechados.", review: "Solicitação em análise pelo clube.",
    kyc_review: (l) => `Documentos em análise (KYC ${l}).`, kyc: (l) => `Precisa de KYC ${l} para os castings abertos.`,
    open_to_tours: "«Disponível para tours» desativado.", ready: (n) => `Pronta: combina com castings abertos (${n}).`, waiting: "Pronta, aguardando um casting adequado.",
  },
  lastSeen: (d) => (d === 0 ? "ativa hoje" : d === 1 ? "ativa ontem" : `ativa há ${d} dias`),
  privacy: "Você só vê as etapas. Documentos, fotos do passaporte, ganhos e contatos ficam ocultos.",
  emptyModels: "Ainda não há modelos. Crie um link e envie para uma modelo: ao se cadastrar com ele, ela fica vinculada a você.",
  nudge: { ...EN.nudge, button: "Lembrar", sent: "Lembrete enviado pelo Telegram.", dailyLimit: "Limite diário de lembretes atingido." },
  links: { ...EN.links, title: "Meus links", create: "Criar link", copy: "Copiar", copied: "Copiado", revoke: "Revogar", empty: "Ainda não há links." },
  showcase: { ...EN.showcase, empty: "Não há castings abertos para suas modelos aprovadas.", models: "Suas modelos", tell: "Avisar" },
  earnings: {
    ...EN.earnings,
    status: { pending: "a pagar", paid: "pago", void: "anulado" },
    head: { date: "Data", model: "Modelo", tour: "Tour", amount: "Bônus", status: "Status", payout: "Pagamento" },
    payoutsTitle: "Histórico de pagamentos", filterAll: "Todos",
  },
  profile: { ...EN.profile, payoutTitle: "Dados de pagamento", save: "Salvar dados", method: "Método", details: "Dados", holder: "Titular" },
};

const DICTS: Record<UiLang, Dict> = { RU, EN, ES, PT };

export type CabinetDict = Dict;
export const cabinetDict = (lang: UiLang): Dict => DICTS[lang] ?? RU;
export const cabinetError = (t: Dict, code: string): string => t.errors[code] ?? t.errors.failed;

/** Текст подсказки «чего не хватает» для шага воронки. */
export function nextText(t: Dict, next: NextStep, opts: { level: number; castings: number; where: string }): string {
  switch (next) {
    case "in_tour": return t.next.in_tour(opts.where);
    case "kyc_review": return t.next.kyc_review(opts.level);
    case "kyc": return t.next.kyc(opts.level);
    case "ready": return t.next.ready(opts.castings);
    default: return t.next[next];
  }
}
