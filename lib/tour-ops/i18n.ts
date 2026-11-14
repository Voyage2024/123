/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · ОС туров — тексты интерфейса (RU / EN / ES / PT)
 * lib/tour-ops/i18n.ts
 *
 * Один словарь на весь модуль: пульт оператора, туры и букинги менеджера,
 * команда, пробивщик, Комната тура резидентки, контроль owner.
 * ──────────────────────────────────────────────────────────────────── */

import type { BookingFormat, BookingStatus, DocKind, GuestStatus, GuestTag, PaymentMethod } from "@/lib/tour-ops/types";
import type { UiLang } from "@/lib/tour-ops/time";

export type OpsDict = {
  common: {
    save: string; saving: string; cancel: string; close: string; edit: string; remove: string; copy: string; copied: string;
    loading: string; retry: string; back: string; all: string; none: string; yes: string; no: string; optional: string;
    tourTime: (city: string) => string; yourTime: string; minutes: string;
  };
  errors: Record<string, string>;
  status: Record<BookingStatus, string>;
  nextAction: Partial<Record<BookingStatus, string>>;
  format: Record<BookingFormat, string>;
  payment: Record<PaymentMethod, string>;
  tourStatus: Record<string, string>;
  list: {
    managerEyebrow: string; managerTitle: string; managerSubtitle: string;
    operatorEyebrow: string; operatorTitle: string; operatorSubtitle: string;
    ownerEyebrow: string; ownerTitle: string; ownerSubtitle: string;
    empty: string; emptyOperator: string; models: string; operators: string; open: string; today: string; revenue: string;
    openBoard: string; needsSettings: string; showClosed: string; manager: string; chooseTour: string;
  };
  board: {
    tabs: { timeline: string; cashbox: string; team: string; vault: string; settings: string; housing: string };
    today: string; prevDay: string; nextDay: string; newBooking: string; allModels: string;
    freeWindow: (d: string) => string; tight: (d: string, buffer: number) => string; back2back: string;
    noBookingsDay: string; noModels: string; cancelled: string; guest: string; operator: string; total: string; modelShare: string;
    agencyShare: string; address: string; reasonPrompt: string; reasonPlaceholder: string; confirmCancel: string; cancelBooking: string;
    accessNote: Record<"owner" | "manager" | "operator", string>; dayLoad: (n: number) => string; settingsMissing: string;
    readonlyClosed: string;
  };
  form: {
    titleNew: string; titleEdit: string; model: string; day: string; start: string; duration: string; end: string; format: string;
    address: string; addressHint: string; guestContact: string; guestContactHint: string; guestName: string; guestNameHint: string;
    total: string; modelShare: string; agencyShare: string; autoSplit: (pct: number) => string; payment: string; notes: string;
    overlap: string; tightWarn: (before: number | null, after: number | null, buffer: number) => string; forceTight: string;
    save: string; checking: string; operatorField: string; noOperator: string; status: string;
  };
  cashbox: {
    completed: string; pipeline: string; cancelled: string; model: string; agency: string; byModel: string; byOperator: string;
    byPayment: string; bookings: (n: number) => string; noData: string; withoutOperator: string;
  };
  team: {
    assignTitle: string; assign: string; pickOperator: string; allModels: string; onlyModels: string; noOperators: string;
    unassign: string; teamLink: string;
    pageEyebrow: string; pageTitle: string; pageSubtitle: string; applications: string; noApplications: string; approve: string;
    reject: string; approved: string; approvedNoDelivery: string; rejected: string; operatorsTitle: string; noTeam: string;
    suspend: string; activate: string; suspended: string; active: string; invitesTitle: string; inviteHint: string;
    createInvite: string; revoke: string; uses: (u: number, m: number) => string; expires: (d: string) => string; botMissing: string;
    phone: string; timezone: string; experience: string; telegram: string; submitted: string; tours: (n: number) => string;
    myTimezone: string; myTimezoneHint: string; revoked: string;
  };
  vault: {
    title: string; checklist: string; ticket: string; checkedIn: string; notYet: string; upload: string; uploading: string;
    download: string; noFiles: string; kind: Record<DocKind, string>; tooLarge: string; badType: string;
    apartments: string; addApartment: string; noApartments: string; assign: string; noApartment: string; markCheckedIn: string;
    unmarkCheckedIn: string;
  };
  apartment: {
    title: string; address: string; map: string; entrance: string; intercom: string; safe: string; wifi: string; host: string;
    notes: string; copyForGuest: string; openMap: string; namePlaceholder: string;
  };
  settings: {
    title: string; timezone: string; timezoneHint: string; currency: string; modelShare: string; modelShareHint: string;
    buffer: string; bufferHint: string; saved: string;
  };
  guests: {
    eyebrow: string; title: string; subtitle: string; placeholder: string; searching: string; noMatch: string; createCard: string;
    nameField: string; phoneField: string; telegramField: string; whatsappField: string; reviews: (n: number) => string;
    addReview: string; notePlaceholder: string; tagsLabel: string; submitReview: string; setStatus: string; statusReason: string;
    removeReview: string; removedNote: string; removeReasonPrompt: string; statusLog: string; quickLinks: string;
    openTelegram: string; openWhatsApp: string; copyNumber: string; numbuster: string; getcontact: string; statusBy: (who: string) => string;
    status: Record<GuestStatus, string>; tags: Record<GuestTag, string>; pick: string; attached: string; detach: string;
    noReviews: string; minChars: string;
  };
  operator: {
    eyebrow: string; title: string; subtitle: string; pickTour: string; manager: string; profileTitle: string; profileSubtitle: string;
    displayName: string; phone: string; telegram: string; suspendedNote: string; noTours: string;
  };
  resident: {
    roomEyebrow: string; scheduleTitle: string; scheduleEmpty: string; toReceive: string; docsTitle: string; ticket: string;
    noDocs: string; uploadMine: string; housing: string; noHousing: string; readiness: string; ticketReady: string; checkedIn: string;
    roomLink: string; flight: string; manager: string; guest: string;
  };
  owner: {
    eyebrow: string; title: string; subtitle: string; toursActive: string; models: string; operators: string; bookings: string;
    pendingApps: string; turnover: string; byDestination: string; byManager: string; tours: string; load: string; tickets: string;
    checkedIn: string; operatorsTitle: string; operatorCard: string; bookings30: string; cancelled30: string; events: string;
    period: { month: string; d30: string; d90: string }; reassign: string; reviewsLeft: string; open: string;
  };
};

const RU: OpsDict = {
  common: {
    save: "Сохранить", saving: "Сохраняю…", cancel: "Отмена", close: "Закрыть", edit: "Изменить", remove: "Удалить",
    copy: "Копировать", copied: "Скопировано", loading: "Загрузка…", retry: "Повторить", back: "Назад", all: "Все",
    none: "—", yes: "Да", no: "Нет", optional: "необязательно",
    tourTime: (city) => `время ${city}`, yourTime: "ваше время", minutes: "мин",
  },
  errors: {
    forbidden: "Нет доступа к этому действию.",
    booking_overlap: "У модели уже есть заказ в это время.",
    invalid_transition: "Такой переход статуса недоступен.",
    model_not_in_tour: "Модель не в составе этого тура.",
    tour_closed: "Тур закрыт — новые заказы не принимаются.",
    booking_locked: "Закрытый заказ может изменить только менеджер тура.",
    invalid_timezone: "Неизвестный часовой пояс.",
    guest_contacts_conflict: "Эти контакты принадлежат разным гостям. Проверьте номер и ник.",
    guest_contact_required: "Укажите телефон, WhatsApp или Telegram гостя.",
    reason_required: "Укажите причину.",
    operator_not_in_team: "Оператор не из команды организатора тура.",
    operator_not_on_tour: "Этот оператор не привязан к туру.",
    not_pending: "Заявка уже обработана.",
    email_exists: "Такой логин уже занят.",
    failed: "Не получилось. Попробуйте ещё раз.",
    money_split: "Доля модели + доля агентства должны равняться сумме заказа.", address_required: "Для Outcall укажите адрес выезда.",
    slot_tight: "Окно впритык — подтвердите заказ.", pick_models: "Выберите хотя бы одну модель.", bad_url: "Ссылка на карту должна начинаться с https://",
    auth_failed: "Не удалось создать вход оператора.", provision_failed: "Не удалось открыть кабинет оператора.",
  },
  status: { scheduled: "Ожидается", en_route: "Выехала / у двери", in_progress: "В процессе", completed: "Завершён", cancelled: "Отменён" },
  nextAction: { scheduled: "Выехала / гость у двери", en_route: "Начали", in_progress: "Завершить" },
  format: { incall: "Incall", outcall: "Outcall" },
  payment: { cash: "Наличные", card: "Карта", transfer: "Перевод", crypto: "Крипта", other: "Другое" },
  tourStatus: { confirmed: "Подтверждён", in_tour: "В туре", closed: "Закрыт", cancelled: "Отменён" },
  list: {
    managerEyebrow: "ОС туров", managerTitle: "Туры и букинги", managerSubtitle: "Расписание моделей, заказы, касса и документы по каждому вашему туру.",
    operatorEyebrow: "Диспетчерский пульт", operatorTitle: "Мои смены", operatorSubtitle: "Туры и модели, к которым вас привязал менеджер.",
    ownerEyebrow: "Контроль owner", ownerTitle: "Контроль туров и букингов", ownerSubtitle: "Все активные туры всех менеджеров: загрузка, заказы, оборот.",
    empty: "Активных туров пока нет. Тур появляется после кастинга и рукопожатия в Манифесте.",
    emptyOperator: "Менеджер ещё не привязал вас к туру. Как только привяжет — тур появится здесь.",
    models: "моделей", operators: "операторов", open: "в работе", today: "сегодня", revenue: "оборот",
    openBoard: "Открыть тур", needsSettings: "Задайте часовой пояс и валюту", showClosed: "Показать закрытые", manager: "Менеджер",
    chooseTour: "Выберите тур",
  },
  board: {
    tabs: { timeline: "Таймлайн", cashbox: "Касса", team: "Операторы", vault: "Билеты и жильё", settings: "Настройки", housing: "Апартаменты" },
    today: "Сегодня", prevDay: "Предыдущий день", nextDay: "Следующий день", newBooking: "Новый букинг", allModels: "Все модели",
    freeWindow: (d) => `Свободное окно: ${d}`, tight: (d, b) => `Впритык: ${d} — меньше буфера ${b} мин`, back2back: "Без паузы",
    noBookingsDay: "На этот день заказов нет.", noModels: "В туре пока нет моделей.", cancelled: "Отменённые",
    guest: "Гость", operator: "Оператор", total: "Сумма", modelShare: "Доля модели", agencyShare: "Доля агентства", address: "Адрес выезда",
    reasonPrompt: "Причина отмены", reasonPlaceholder: "Например: гость не вышел на связь", confirmCancel: "Отменить заказ", cancelBooking: "Отмена…",
    accessNote: {
      owner: "Режим полного контроля owner.",
      manager: "Вы организатор тура: заказы, касса, операторы и документы.",
      operator: "Вы видите только модели, к которым вас привязал менеджер.",
    },
    dayLoad: (n) => `${n} заказ(ов)`,
    settingsMissing: "Часовой пояс тура не задан — время показано в UTC. Задайте его во вкладке «Настройки».",
    readonlyClosed: "Тур закрыт — заказы только для просмотра.",
  },
  form: {
    titleNew: "Новый букинг", titleEdit: "Изменить букинг", model: "Модель", day: "День", start: "Начало (время тура)", duration: "Длительность",
    end: "Окончание", format: "Формат", address: "Адрес выезда", addressHint: "Для Outcall: улица, дом, апартаменты/номер",
    guestContact: "Контакт гостя", guestContactHint: "Телефон, WhatsApp или @ник — система сразу пробьёт по базе",
    guestName: "Имя / ник гостя для модели", guestNameHint: "Модель увидит только это имя, без телефона",
    total: "Сумма заказа", modelShare: "Доля модели", agencyShare: "Доля агентства", autoSplit: (p) => `по умолчанию модели ${p}%`,
    payment: "Оплата", notes: "Заметка для команды", overlap: "Пересечение: у модели уже есть заказ в это время.",
    tightWarn: (b, a, buf) => `Впритык: ${b !== null ? `до предыдущего ${b} мин` : ""}${b !== null && a !== null ? ", " : ""}${a !== null ? `до следующего ${a} мин` : ""} при буфере ${buf} мин на дорогу и сборы.`,
    forceTight: "Всё равно поставить", save: "Сохранить букинг", checking: "Проверяю окно…", operatorField: "Ведёт оператор",
    noOperator: "Без оператора", status: "Статус",
  },
  cashbox: {
    completed: "Завершено", pipeline: "В работе", cancelled: "Отменено", model: "Модели", agency: "Агентству",
    byModel: "По моделям", byOperator: "По операторам", byPayment: "По способу оплаты", bookings: (n) => `${n} заказ(ов)`,
    noData: "Завершённых заказов пока нет.", withoutOperator: "Менеджер",
  },
  team: {
    assignTitle: "Операторы тура", assign: "Привязать", pickOperator: "Выберите оператора", allModels: "Все модели тура",
    onlyModels: "Только выбранные модели", noOperators: "К туру пока не привязан ни один оператор.", unassign: "Отвязать",
    teamLink: "Моя команда",
    pageEyebrow: "Команда", pageTitle: "Моя команда (Операторы)", pageSubtitle: "Заявки операторов из Telegram-бота, активные операторы и инвайт-ссылки.",
    applications: "Заявки", noApplications: "Новых заявок нет.", approve: "Одобрить", reject: "Отклонить",
    approved: "Одобрено: доступ отправлен оператору в Telegram.", approvedNoDelivery: "Кабинет открыт, но доступ не дошёл в Telegram. Оператор может отправить боту /password.",
    rejected: "Заявка отклонена.", operatorsTitle: "Операторы", noTeam: "В команде пока нет операторов. Отправьте инвайт-ссылку.",
    suspend: "Приостановить", activate: "Вернуть", suspended: "Приостановлен", active: "Активен",
    invitesTitle: "Инвайт-ссылки", inviteHint: "Оператор открывает ссылку — бот сразу привязывает его к вам. Ссылку можно отправить нескольким.",
    createInvite: "Создать ссылку", revoke: "Отозвать", uses: (u, m) => `использовано ${u} из ${m}`, expires: (d) => `до ${d}`,
    botMissing: "Не задан NEXT_PUBLIC_BOT_USERNAME — показываю только код.", phone: "Телефон / WhatsApp", timezone: "Часовой пояс",
    experience: "Опыт", telegram: "Telegram", submitted: "Подана", tours: (n) => `туров: ${n}`, myTimezone: "Мой часовой пояс",
    myTimezoneHint: "Мелкое время на таймлайне показывается в этом поясе.", revoked: "Отозвана",
  },
  vault: {
    title: "Сейф тура", checklist: "Готовность", ticket: "Билет", checkedIn: "Заселена", notYet: "нет", upload: "Загрузить",
    uploading: "Загружаю…", download: "Скачать", noFiles: "Файлов нет", kind: { ticket: "Авиабилет", boarding_pass: "Посадочный", other: "Другое" },
    tooLarge: "Файл больше 15 МБ.", badType: "Только PDF или изображение.", apartments: "Апартаменты", addApartment: "Добавить апарты",
    noApartments: "Апартаменты ещё не добавлены.", assign: "Апарты", noApartment: "не назначены", markCheckedIn: "Отметить заселение",
    unmarkCheckedIn: "Снять отметку",
  },
  apartment: {
    title: "Название", address: "Точный адрес", map: "Ссылка на карту", entrance: "Код подъезда", intercom: "Домофон", safe: "Код сейфа / ключницы",
    wifi: "Wi-Fi", host: "Водитель / встречающий", notes: "Заметки", copyForGuest: "Скопировать гостю", openMap: "Карта", namePlaceholder: "Например: Marina 1",
  },
  settings: {
    title: "Настройки тура", timezone: "Часовой пояс локации", timezoneHint: "Крупное время на таймлайне и в уведомлениях моделям.",
    currency: "Валюта", modelShare: "Доля модели по умолчанию, %", modelShareHint: "Подставляется в новый заказ, можно поменять в заказе.",
    buffer: "Буфер на дорогу и сборы, мин", bufferHint: "Окно меньше буфера подсвечивается и требует подтверждения.", saved: "Сохранено",
  },
  guests: {
    eyebrow: "Пробивщик", title: "Пробивщик гостей", subtitle: "Клубная база гостей: статус, заметки команды и быстрые ссылки для проверки номера.",
    placeholder: "Телефон, WhatsApp, @ник или имя", searching: "Ищу…", noMatch: "В базе нет совпадений.", createCard: "Создать карточку",
    nameField: "Имя / ник", phoneField: "Телефон", telegramField: "Telegram @ник", whatsappField: "WhatsApp",
    reviews: (n) => `Заметок: ${n}`, addReview: "Добавить заметку", notePlaceholder: "Что важно знать команде", tagsLabel: "Теги",
    submitReview: "Добавить", setStatus: "Статус в базе", statusReason: "Причина (обязательно для «Осторожно» и ЧС)",
    removeReview: "Скрыть", removedNote: "скрыта модератором", removeReasonPrompt: "Почему скрываете заметку?", statusLog: "История статуса",
    quickLinks: "Проверить", openTelegram: "Telegram", openWhatsApp: "WhatsApp", copyNumber: "Копировать номер",
    numbuster: "NumBuster", getcontact: "GetContact", statusBy: (w) => `отметил(а) ${w}`,
    status: { neutral: "Нет отметок", vip: "VIP / Надёжный", caution: "Осторожно", blacklist: "Чёрный список" },
    tags: {
      polite: "вежливый", generous: "щедрый", regular: "постоянный", punctual: "пунктуальный", verified: "проверен",
      late: "опаздывает", no_show: "не пришёл", haggling: "торгуется", rude: "грубит", drunk: "пьяный", unsafe: "опасен",
      fake_payment: "фейк-оплата", police_risk: "риск полиции",
    },
    pick: "Выбрать для заказа", attached: "Гость выбран", detach: "Сменить", noReviews: "Заметок пока нет.", minChars: "Введите хотя бы 3 символа",
  },
  operator: {
    eyebrow: "Оператор", title: "Диспетчерский пульт", subtitle: "Таймлайн заказов с двойным временем, статусы в один клик и пробивщик.",
    pickTour: "Тур / смена", manager: "Ваш менеджер", profileTitle: "Мой профиль", profileSubtitle: "Контакты и часовой пояс для двойного времени.",
    displayName: "Псевдоним", phone: "Телефон / WhatsApp", telegram: "Telegram", suspendedNote: "Ваш доступ приостановлен менеджером.",
    noTours: "Вас пока не привязали ни к одному туру.",
  },
  resident: {
    roomEyebrow: "Комната тура", scheduleTitle: "Моё расписание на тур", scheduleEmpty: "Заказов пока нет — менеджер добавит их сюда.",
    toReceive: "к получению", docsTitle: "Документы и жильё", ticket: "Авиабилет / посадочный", noDocs: "Билет ещё не загружен.",
    uploadMine: "Загрузить свой билет", housing: "Проживание", noHousing: "Апартаменты пока не назначены.", readiness: "Готовность",
    ticketReady: "Билет загружен", checkedIn: "Заселена", roomLink: "Комната тура", flight: "Рейс", manager: "Менеджер", guest: "Гость",
  },
  owner: {
    eyebrow: "Owner", title: "Контроль туров и букингов", subtitle: "Сводка по всем турам и менеджерам. Провалитесь в любой тур, расписание или карточку оператора.",
    toursActive: "Активных туров", models: "Моделей в турах", operators: "Операторов", bookings: "Заказов за период",
    pendingApps: "Заявок операторов", turnover: "Оборот (завершённые)", byDestination: "По направлениям", byManager: "По менеджерам",
    tours: "Туры", load: "Загрузка", tickets: "Билеты", checkedIn: "Заселены", operatorsTitle: "Операторы", operatorCard: "Карточка оператора",
    bookings30: "Заказов за 30 дней", cancelled30: "Отмен за 30 дней", events: "Журнал действий", period: { month: "Этот месяц", d30: "30 дней", d90: "90 дней" },
    reassign: "Перепривязать к менеджеру", reviewsLeft: "Заметок о гостях", open: "Открыть",
  },
};

const EN: OpsDict = {
  common: {
    save: "Save", saving: "Saving…", cancel: "Cancel", close: "Close", edit: "Edit", remove: "Delete", copy: "Copy", copied: "Copied",
    loading: "Loading…", retry: "Retry", back: "Back", all: "All", none: "—", yes: "Yes", no: "No", optional: "optional",
    tourTime: (city) => `${city} time`, yourTime: "your time", minutes: "min",
  },
  errors: {
    forbidden: "You don’t have access to this action.", booking_overlap: "The model already has a booking at this time.",
    invalid_transition: "This status change is not allowed.", model_not_in_tour: "The model is not part of this tour.",
    tour_closed: "The tour is closed — no new bookings.", booking_locked: "Only the tour manager can change a closed booking.",
    invalid_timezone: "Unknown time zone.", guest_contacts_conflict: "These contacts belong to different guests. Check the number and handle.",
    guest_contact_required: "Enter the guest’s phone, WhatsApp or Telegram.", reason_required: "Please give a reason.",
    operator_not_in_team: "The operator is not in the tour organizer’s team.", operator_not_on_tour: "This operator is not assigned to the tour.",
    not_pending: "The application has already been handled.", email_exists: "This login is already taken.", failed: "Something went wrong. Please try again.",
    money_split: "Model share + agency share must equal the booking total.", address_required: "Enter the outcall address.",
    slot_tight: "Tight slot — please confirm.", pick_models: "Pick at least one model.", bad_url: "The map link must start with https://",
    auth_failed: "Could not create the operator login.", provision_failed: "Could not open the operator account.",
  },
  status: { scheduled: "Scheduled", en_route: "En route / at the door", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
  nextAction: { scheduled: "En route / guest at door", en_route: "Started", in_progress: "Complete" },
  format: { incall: "Incall", outcall: "Outcall" },
  payment: { cash: "Cash", card: "Card", transfer: "Transfer", crypto: "Crypto", other: "Other" },
  tourStatus: { confirmed: "Confirmed", in_tour: "On tour", closed: "Closed", cancelled: "Cancelled" },
  list: {
    managerEyebrow: "Tour OS", managerTitle: "Tours & Bookings", managerSubtitle: "Model schedules, bookings, cash desk and documents for each of your tours.",
    operatorEyebrow: "Dispatch desk", operatorTitle: "My shifts", operatorSubtitle: "Tours and models your manager assigned to you.",
    ownerEyebrow: "Owner control", ownerTitle: "Tours & Bookings Control", ownerSubtitle: "Every active tour of every manager: load, bookings, turnover.",
    empty: "No active tours yet. A tour appears after the casting and handshake in Manifest.",
    emptyOperator: "Your manager hasn’t assigned you to a tour yet. It will appear here once they do.",
    models: "models", operators: "operators", open: "open", today: "today", revenue: "turnover", openBoard: "Open tour",
    needsSettings: "Set the time zone and currency", showClosed: "Show closed", manager: "Manager", chooseTour: "Choose a tour",
  },
  board: {
    tabs: { timeline: "Timeline", cashbox: "Cash desk", team: "Operators", vault: "Tickets & housing", settings: "Settings", housing: "Apartments" },
    today: "Today", prevDay: "Previous day", nextDay: "Next day", newBooking: "New booking", allModels: "All models",
    freeWindow: (d) => `Free window: ${d}`, tight: (d, b) => `Tight: ${d} — under the ${b} min buffer`, back2back: "Back to back",
    noBookingsDay: "No bookings on this day.", noModels: "No models in this tour yet.", cancelled: "Cancelled",
    guest: "Guest", operator: "Operator", total: "Total", modelShare: "Model share", agencyShare: "Agency share", address: "Outcall address",
    reasonPrompt: "Cancellation reason", reasonPlaceholder: "e.g. the guest stopped responding", confirmCancel: "Cancel booking", cancelBooking: "Cancel…",
    accessNote: { owner: "Owner full-control mode.", manager: "You organize this tour: bookings, cash, operators and documents.", operator: "You only see the models your manager assigned to you." },
    dayLoad: (n) => `${n} booking(s)`, settingsMissing: "The tour time zone is not set — times are shown in UTC. Set it in Settings.",
    readonlyClosed: "The tour is closed — bookings are read-only.",
  },
  form: {
    titleNew: "New booking", titleEdit: "Edit booking", model: "Model", day: "Day", start: "Start (tour time)", duration: "Duration", end: "End",
    format: "Format", address: "Outcall address", addressHint: "For Outcall: street, building, apartment/room",
    guestContact: "Guest contact", guestContactHint: "Phone, WhatsApp or @handle — checked against the club base instantly",
    guestName: "Guest name for the model", guestNameHint: "The model sees only this name, never the phone",
    total: "Booking total", modelShare: "Model share", agencyShare: "Agency share", autoSplit: (p) => `model gets ${p}% by default`,
    payment: "Payment", notes: "Note for the team", overlap: "Overlap: the model already has a booking at this time.",
    tightWarn: (b, a, buf) => `Tight: ${b !== null ? `${b} min after the previous` : ""}${b !== null && a !== null ? ", " : ""}${a !== null ? `${a} min before the next` : ""} with a ${buf} min travel buffer.`,
    forceTight: "Book anyway", save: "Save booking", checking: "Checking the slot…", operatorField: "Handled by operator", noOperator: "No operator", status: "Status",
  },
  cashbox: {
    completed: "Completed", pipeline: "In progress", cancelled: "Cancelled", model: "Models", agency: "Agency", byModel: "By model",
    byOperator: "By operator", byPayment: "By payment method", bookings: (n) => `${n} booking(s)`, noData: "No completed bookings yet.", withoutOperator: "Manager",
  },
  team: {
    assignTitle: "Tour operators", assign: "Assign", pickOperator: "Choose an operator", allModels: "All tour models", onlyModels: "Selected models only",
    noOperators: "No operators assigned to this tour yet.", unassign: "Unassign", teamLink: "My team",
    pageEyebrow: "Team", pageTitle: "My Team (Operators)", pageSubtitle: "Operator applications from the Telegram bot, active operators and invite links.",
    applications: "Applications", noApplications: "No new applications.", approve: "Approve", reject: "Decline",
    approved: "Approved: access sent to the operator in Telegram.", approvedNoDelivery: "Account opened, but Telegram delivery failed. The operator can send /password to the bot.",
    rejected: "Application declined.", operatorsTitle: "Operators", noTeam: "No operators yet. Send an invite link.", suspend: "Suspend", activate: "Reactivate",
    suspended: "Suspended", active: "Active", invitesTitle: "Invite links", inviteHint: "The operator opens the link and the bot links them to you straight away. One link can be shared with several people.",
    createInvite: "Create link", revoke: "Revoke", uses: (u, m) => `used ${u} of ${m}`, expires: (d) => `until ${d}`,
    botMissing: "NEXT_PUBLIC_BOT_USERNAME is not set — showing the code only.", phone: "Phone / WhatsApp", timezone: "Time zone", experience: "Experience",
    telegram: "Telegram", submitted: "Submitted", tours: (n) => `tours: ${n}`, myTimezone: "My time zone", myTimezoneHint: "The small time on the timeline uses this zone.", revoked: "Revoked",
  },
  vault: {
    title: "Tour vault", checklist: "Readiness", ticket: "Ticket", checkedIn: "Checked in", notYet: "no", upload: "Upload", uploading: "Uploading…",
    download: "Download", noFiles: "No files", kind: { ticket: "Flight ticket", boarding_pass: "Boarding pass", other: "Other" }, tooLarge: "File is larger than 15 MB.",
    badType: "PDF or image only.", apartments: "Apartments", addApartment: "Add apartment", noApartments: "No apartments yet.", assign: "Apartment",
    noApartment: "not assigned", markCheckedIn: "Mark checked in", unmarkCheckedIn: "Unmark",
  },
  apartment: {
    title: "Name", address: "Exact address", map: "Map link", entrance: "Entrance code", intercom: "Intercom", safe: "Safe / key box code", wifi: "Wi-Fi",
    host: "Driver / greeter", notes: "Notes", copyForGuest: "Copy for guest", openMap: "Map", namePlaceholder: "e.g. Marina 1",
  },
  settings: {
    title: "Tour settings", timezone: "Location time zone", timezoneHint: "Large time on the timeline and in model notifications.", currency: "Currency",
    modelShare: "Default model share, %", modelShareHint: "Pre-filled in new bookings, editable per booking.", buffer: "Travel / prep buffer, min",
    bufferHint: "Gaps shorter than the buffer are highlighted and need confirmation.", saved: "Saved",
  },
  guests: {
    eyebrow: "Lookup", title: "Guest Lookup", subtitle: "Club guest base: status, team notes and quick links to check a number.",
    placeholder: "Phone, WhatsApp, @handle or name", searching: "Searching…", noMatch: "No matches in the base.", createCard: "Create card",
    nameField: "Name / handle", phoneField: "Phone", telegramField: "Telegram @handle", whatsappField: "WhatsApp", reviews: (n) => `Notes: ${n}`,
    addReview: "Add note", notePlaceholder: "What the team should know", tagsLabel: "Tags", submitReview: "Add", setStatus: "Base status",
    statusReason: "Reason (required for Caution and Blacklist)", removeReview: "Hide", removedNote: "hidden by a moderator", removeReasonPrompt: "Why are you hiding this note?",
    statusLog: "Status history", quickLinks: "Check", openTelegram: "Telegram", openWhatsApp: "WhatsApp", copyNumber: "Copy number", numbuster: "NumBuster",
    getcontact: "GetContact", statusBy: (w) => `set by ${w}`,
    status: { neutral: "No flags", vip: "VIP / Reliable", caution: "Caution", blacklist: "Blacklist" },
    tags: { polite: "polite", generous: "generous", regular: "regular", punctual: "punctual", verified: "verified", late: "late", no_show: "no-show", haggling: "haggles", rude: "rude", drunk: "drunk", unsafe: "unsafe", fake_payment: "fake payment", police_risk: "police risk" },
    pick: "Use for booking", attached: "Guest selected", detach: "Change", noReviews: "No notes yet.", minChars: "Type at least 3 characters",
  },
  operator: {
    eyebrow: "Operator", title: "Dispatch Desk", subtitle: "Booking timeline with dual time, one-tap statuses and guest lookup.", pickTour: "Tour / shift",
    manager: "Your manager", profileTitle: "My profile", profileSubtitle: "Contacts and time zone for dual time.", displayName: "Alias", phone: "Phone / WhatsApp",
    telegram: "Telegram", suspendedNote: "Your access has been suspended by your manager.", noTours: "You are not assigned to any tour yet.",
  },
  resident: {
    roomEyebrow: "Tour room", scheduleTitle: "My tour schedule", scheduleEmpty: "No bookings yet — your manager will add them here.", toReceive: "to receive",
    docsTitle: "Documents & housing", ticket: "Ticket / boarding pass", noDocs: "No ticket uploaded yet.", uploadMine: "Upload my ticket", housing: "Housing",
    noHousing: "No apartment assigned yet.", readiness: "Readiness", ticketReady: "Ticket uploaded", checkedIn: "Checked in", roomLink: "Tour room", flight: "Flight",
    manager: "Manager", guest: "Guest",
  },
  owner: {
    eyebrow: "Owner", title: "Tours & Bookings Control", subtitle: "All tours and managers at a glance. Drill into any tour, schedule or operator card.",
    toursActive: "Active tours", models: "Models on tour", operators: "Operators", bookings: "Bookings in period", pendingApps: "Operator applications",
    turnover: "Turnover (completed)", byDestination: "By destination", byManager: "By manager", tours: "Tours", load: "Load", tickets: "Tickets", checkedIn: "Checked in",
    operatorsTitle: "Operators", operatorCard: "Operator card", bookings30: "Bookings, 30 days", cancelled30: "Cancellations, 30 days", events: "Activity log",
    period: { month: "This month", d30: "30 days", d90: "90 days" }, reassign: "Reassign to manager", reviewsLeft: "Guest notes", open: "Open",
  },
};

const ES: OpsDict = {
  ...EN,
  common: { ...EN.common, save: "Guardar", saving: "Guardando…", cancel: "Cancelar", close: "Cerrar", edit: "Editar", remove: "Eliminar", copy: "Copiar", copied: "Copiado", loading: "Cargando…", retry: "Reintentar", back: "Atrás", all: "Todos", yes: "Sí", no: "No", optional: "opcional", tourTime: (c) => `hora de ${c}`, yourTime: "tu hora" },
  errors: {
    ...EN.errors, money_split: "La parte de la modelo + la de la agencia deben sumar el total.", address_required: "Indica la dirección del outcall.", slot_tight: "Hueco muy justo: confirma la reserva.", pick_models: "Elige al menos una modelo.", bad_url: "El enlace del mapa debe empezar por https://", forbidden: "No tienes acceso a esta acción.", booking_overlap: "La modelo ya tiene una reserva a esa hora.", invalid_transition: "Este cambio de estado no está permitido.",
    model_not_in_tour: "La modelo no forma parte de este tour.", tour_closed: "El tour está cerrado: no se aceptan reservas.", booking_locked: "Solo el gerente del tour puede cambiar una reserva cerrada.",
    invalid_timezone: "Zona horaria desconocida.", guest_contacts_conflict: "Estos contactos pertenecen a distintos huéspedes.", guest_contact_required: "Indica teléfono, WhatsApp o Telegram del huésped.",
    reason_required: "Indica el motivo.", failed: "Algo salió mal. Inténtalo de nuevo.",
  },
  status: { scheduled: "Programada", en_route: "En camino / en la puerta", in_progress: "En curso", completed: "Completada", cancelled: "Cancelada" },
  nextAction: { scheduled: "En camino / en la puerta", en_route: "Empezó", in_progress: "Completar" },
  payment: { cash: "Efectivo", card: "Tarjeta", transfer: "Transferencia", crypto: "Cripto", other: "Otro" },
  tourStatus: { confirmed: "Confirmado", in_tour: "En tour", closed: "Cerrado", cancelled: "Cancelado" },
  list: { ...EN.list, managerEyebrow: "SO de tours", managerTitle: "Tours y reservas", managerSubtitle: "Agenda de modelos, reservas, caja y documentos de cada tour.", operatorEyebrow: "Centro de despacho", operatorTitle: "Mis turnos", operatorSubtitle: "Tours y modelos que te asignó tu gerente.", ownerEyebrow: "Control owner", ownerTitle: "Control de tours y reservas", ownerSubtitle: "Todos los tours activos de todos los gerentes.", empty: "Aún no hay tours activos.", emptyOperator: "Tu gerente aún no te asignó a un tour.", models: "modelos", operators: "operadores", open: "abiertas", today: "hoy", revenue: "facturación", openBoard: "Abrir tour", needsSettings: "Configura zona horaria y moneda", showClosed: "Mostrar cerrados", manager: "Gerente", chooseTour: "Elige un tour" },
  board: { ...EN.board, tabs: { timeline: "Cronograma", cashbox: "Caja", team: "Operadores", vault: "Billetes y alojamiento", settings: "Ajustes", housing: "Apartamentos" }, today: "Hoy", newBooking: "Nueva reserva", allModels: "Todas las modelos", freeWindow: (d) => `Ventana libre: ${d}`, tight: (d, b) => `Justo: ${d} — menos que el margen de ${b} min`, noBookingsDay: "No hay reservas este día.", noModels: "Aún no hay modelos en el tour.", guest: "Huésped", operator: "Operador", total: "Total", modelShare: "Parte de la modelo", agencyShare: "Parte de la agencia", address: "Dirección", reasonPrompt: "Motivo de cancelación", confirmCancel: "Cancelar reserva", cancelBooking: "Cancelar…" },
  form: { ...EN.form, titleNew: "Nueva reserva", titleEdit: "Editar reserva", model: "Modelo", day: "Día", start: "Inicio (hora del tour)", duration: "Duración", end: "Fin", format: "Formato", address: "Dirección (outcall)", guestContact: "Contacto del huésped", guestName: "Nombre del huésped para la modelo", total: "Importe", modelShare: "Parte de la modelo", agencyShare: "Parte de la agencia", payment: "Pago", notes: "Nota para el equipo", forceTight: "Reservar igualmente", save: "Guardar reserva" },
  cashbox: { ...EN.cashbox, completed: "Completadas", pipeline: "En curso", cancelled: "Canceladas", model: "Modelos", agency: "Agencia", byModel: "Por modelo", byOperator: "Por operador", byPayment: "Por método de pago", noData: "Aún no hay reservas completadas." },
  team: { ...EN.team, pageEyebrow: "Equipo", pageTitle: "Mi equipo (Operadores)", applications: "Solicitudes", approve: "Aprobar", reject: "Rechazar", operatorsTitle: "Operadores", suspend: "Suspender", activate: "Reactivar", invitesTitle: "Enlaces de invitación", createInvite: "Crear enlace", revoke: "Revocar", assign: "Asignar", unassign: "Quitar", myTimezone: "Mi zona horaria" },
  vault: { ...EN.vault, title: "Caja fuerte del tour", checklist: "Preparación", ticket: "Billete", checkedIn: "Instalada", upload: "Subir", download: "Descargar", kind: { ticket: "Billete de avión", boarding_pass: "Tarjeta de embarque", other: "Otro" }, apartments: "Apartamentos", addApartment: "Añadir apartamento" },
  apartment: { ...EN.apartment, title: "Nombre", address: "Dirección exacta", map: "Enlace al mapa", entrance: "Código del portal", intercom: "Interfono", safe: "Código de caja fuerte", host: "Chófer / anfitrión", notes: "Notas", copyForGuest: "Copiar para el huésped", openMap: "Mapa" },
  settings: { ...EN.settings, title: "Ajustes del tour", timezone: "Zona horaria de la ubicación", currency: "Moneda", modelShare: "Parte de la modelo por defecto, %", buffer: "Margen de traslado, min", saved: "Guardado" },
  guests: { ...EN.guests, eyebrow: "Verificación", title: "Verificar huésped", placeholder: "Teléfono, WhatsApp, @usuario o nombre", noMatch: "Sin coincidencias.", createCard: "Crear ficha", addReview: "Añadir nota", submitReview: "Añadir", setStatus: "Estado", removeReview: "Ocultar", statusLog: "Historial de estado", quickLinks: "Verificar", copyNumber: "Copiar número", status: { neutral: "Sin marcas", vip: "VIP / Fiable", caution: "Precaución", blacklist: "Lista negra" }, pick: "Usar en la reserva", attached: "Huésped elegido", detach: "Cambiar", noReviews: "Aún no hay notas." },
  operator: { ...EN.operator, eyebrow: "Operador", title: "Centro de despacho", pickTour: "Tour / turno", manager: "Tu gerente", profileTitle: "Mi perfil", displayName: "Alias", phone: "Teléfono / WhatsApp", noTours: "Aún no estás asignado a ningún tour." },
  resident: { ...EN.resident, roomEyebrow: "Sala del tour", scheduleTitle: "Mi agenda del tour", scheduleEmpty: "Aún no hay reservas.", toReceive: "a recibir", docsTitle: "Documentos y alojamiento", noDocs: "Billete aún no subido.", uploadMine: "Subir mi billete", housing: "Alojamiento", noHousing: "Aún sin apartamento.", readiness: "Preparación", ticketReady: "Billete subido", checkedIn: "Instalada", roomLink: "Sala del tour", flight: "Vuelo", manager: "Gerente", guest: "Huésped" },
  owner: { ...EN.owner, title: "Control de tours y reservas", toursActive: "Tours activos", models: "Modelos en tour", operators: "Operadores", bookings: "Reservas del periodo", turnover: "Facturación (completadas)", byDestination: "Por destino", byManager: "Por gerente", tours: "Tours", load: "Carga", operatorsTitle: "Operadores", operatorCard: "Ficha del operador", open: "Abrir" },
};

const PT: OpsDict = {
  ...EN,
  common: { ...EN.common, save: "Salvar", saving: "Salvando…", cancel: "Cancelar", close: "Fechar", edit: "Editar", remove: "Excluir", copy: "Copiar", copied: "Copiado", loading: "Carregando…", retry: "Tentar de novo", back: "Voltar", all: "Todos", yes: "Sim", no: "Não", optional: "opcional", tourTime: (c) => `hora de ${c}`, yourTime: "sua hora" },
  errors: {
    ...EN.errors, money_split: "A parte da modelo + a da agência devem somar o total.", address_required: "Informe o endereço do outcall.", slot_tight: "Horário apertado: confirme a reserva.", pick_models: "Escolha pelo menos uma modelo.", bad_url: "O link do mapa deve começar com https://", forbidden: "Você não tem acesso a esta ação.", booking_overlap: "A modelo já tem uma reserva neste horário.", invalid_transition: "Esta mudança de status não é permitida.",
    model_not_in_tour: "A modelo não faz parte deste tour.", tour_closed: "O tour está fechado — sem novas reservas.", booking_locked: "Só o gerente do tour pode alterar uma reserva fechada.",
    invalid_timezone: "Fuso horário desconhecido.", guest_contacts_conflict: "Estes contatos pertencem a hóspedes diferentes.", guest_contact_required: "Informe telefone, WhatsApp ou Telegram do hóspede.",
    reason_required: "Informe o motivo.", failed: "Algo deu errado. Tente novamente.",
  },
  status: { scheduled: "Agendada", en_route: "A caminho / na porta", in_progress: "Em andamento", completed: "Concluída", cancelled: "Cancelada" },
  nextAction: { scheduled: "A caminho / na porta", en_route: "Começou", in_progress: "Concluir" },
  payment: { cash: "Dinheiro", card: "Cartão", transfer: "Transferência", crypto: "Cripto", other: "Outro" },
  tourStatus: { confirmed: "Confirmado", in_tour: "Em tour", closed: "Fechado", cancelled: "Cancelado" },
  list: { ...EN.list, managerEyebrow: "SO de tours", managerTitle: "Tours e reservas", managerSubtitle: "Agenda das modelos, reservas, caixa e documentos de cada tour.", operatorEyebrow: "Central de despacho", operatorTitle: "Meus turnos", operatorSubtitle: "Tours e modelos atribuídos pelo seu gerente.", ownerEyebrow: "Controle owner", ownerTitle: "Controle de tours e reservas", ownerSubtitle: "Todos os tours ativos de todos os gerentes.", empty: "Ainda não há tours ativos.", emptyOperator: "Seu gerente ainda não o atribuiu a um tour.", models: "modelos", operators: "operadores", open: "abertas", today: "hoje", revenue: "faturamento", openBoard: "Abrir tour", needsSettings: "Defina fuso e moeda", showClosed: "Mostrar fechados", manager: "Gerente", chooseTour: "Escolha um tour" },
  board: { ...EN.board, tabs: { timeline: "Linha do tempo", cashbox: "Caixa", team: "Operadores", vault: "Passagens e hospedagem", settings: "Configurações", housing: "Apartamentos" }, today: "Hoje", newBooking: "Nova reserva", allModels: "Todas as modelos", freeWindow: (d) => `Janela livre: ${d}`, tight: (d, b) => `Apertado: ${d} — abaixo da margem de ${b} min`, noBookingsDay: "Sem reservas neste dia.", noModels: "Ainda não há modelos no tour.", guest: "Hóspede", operator: "Operador", total: "Total", modelShare: "Parte da modelo", agencyShare: "Parte da agência", address: "Endereço", reasonPrompt: "Motivo do cancelamento", confirmCancel: "Cancelar reserva", cancelBooking: "Cancelar…" },
  form: { ...EN.form, titleNew: "Nova reserva", titleEdit: "Editar reserva", model: "Modelo", day: "Dia", start: "Início (hora do tour)", duration: "Duração", end: "Fim", format: "Formato", address: "Endereço (outcall)", guestContact: "Contato do hóspede", guestName: "Nome do hóspede para a modelo", total: "Valor", modelShare: "Parte da modelo", agencyShare: "Parte da agência", payment: "Pagamento", notes: "Nota para a equipe", forceTight: "Reservar mesmo assim", save: "Salvar reserva" },
  cashbox: { ...EN.cashbox, completed: "Concluídas", pipeline: "Em andamento", cancelled: "Canceladas", model: "Modelos", agency: "Agência", byModel: "Por modelo", byOperator: "Por operador", byPayment: "Por forma de pagamento", noData: "Ainda não há reservas concluídas." },
  team: { ...EN.team, pageEyebrow: "Equipe", pageTitle: "Minha equipe (Operadores)", applications: "Solicitações", approve: "Aprovar", reject: "Recusar", operatorsTitle: "Operadores", suspend: "Suspender", activate: "Reativar", invitesTitle: "Links de convite", createInvite: "Criar link", revoke: "Revogar", assign: "Atribuir", unassign: "Remover", myTimezone: "Meu fuso horário" },
  vault: { ...EN.vault, title: "Cofre do tour", checklist: "Prontidão", ticket: "Passagem", checkedIn: "Hospedada", upload: "Enviar", download: "Baixar", kind: { ticket: "Passagem aérea", boarding_pass: "Cartão de embarque", other: "Outro" }, apartments: "Apartamentos", addApartment: "Adicionar apartamento" },
  apartment: { ...EN.apartment, title: "Nome", address: "Endereço exato", map: "Link do mapa", entrance: "Código da portaria", intercom: "Interfone", safe: "Código do cofre", host: "Motorista / recepção", notes: "Notas", copyForGuest: "Copiar para o hóspede", openMap: "Mapa" },
  settings: { ...EN.settings, title: "Configurações do tour", timezone: "Fuso horário do local", currency: "Moeda", modelShare: "Parte padrão da modelo, %", buffer: "Margem de deslocamento, min", saved: "Salvo" },
  guests: { ...EN.guests, eyebrow: "Verificação", title: "Verificar hóspede", placeholder: "Telefone, WhatsApp, @usuário ou nome", noMatch: "Nenhum resultado.", createCard: "Criar ficha", addReview: "Adicionar nota", submitReview: "Adicionar", setStatus: "Status", removeReview: "Ocultar", statusLog: "Histórico de status", quickLinks: "Verificar", copyNumber: "Copiar número", status: { neutral: "Sem marcas", vip: "VIP / Confiável", caution: "Cuidado", blacklist: "Lista negra" }, pick: "Usar na reserva", attached: "Hóspede escolhido", detach: "Trocar", noReviews: "Ainda não há notas." },
  operator: { ...EN.operator, eyebrow: "Operador", title: "Central de despacho", pickTour: "Tour / turno", manager: "Seu gerente", profileTitle: "Meu perfil", displayName: "Apelido", phone: "Telefone / WhatsApp", noTours: "Você ainda não está em nenhum tour." },
  resident: { ...EN.resident, roomEyebrow: "Sala do tour", scheduleTitle: "Minha agenda do tour", scheduleEmpty: "Ainda não há reservas.", toReceive: "a receber", docsTitle: "Documentos e hospedagem", noDocs: "Passagem ainda não enviada.", uploadMine: "Enviar minha passagem", housing: "Hospedagem", noHousing: "Apartamento ainda não definido.", readiness: "Prontidão", ticketReady: "Passagem enviada", checkedIn: "Hospedada", roomLink: "Sala do tour", flight: "Voo", manager: "Gerente", guest: "Hóspede" },
  owner: { ...EN.owner, title: "Controle de tours e reservas", toursActive: "Tours ativos", models: "Modelos em tour", operators: "Operadores", bookings: "Reservas no período", turnover: "Faturamento (concluídas)", byDestination: "Por destino", byManager: "Por gerente", tours: "Tours", load: "Carga", operatorsTitle: "Operadores", operatorCard: "Ficha do operador", open: "Abrir" },
};

const DICTS: Record<UiLang, OpsDict> = { RU, EN, ES, PT };

export function opsDict(lang: string | null | undefined): OpsDict {
  return DICTS[(lang as UiLang) in DICTS ? (lang as UiLang) : "RU"];
}

export function opsError(t: OpsDict, code: string): string {
  return t.errors[code] ?? t.errors.failed;
}
