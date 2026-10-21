import { InlineKeyboard } from "grammy";
import type { TelegramLang } from "@/lib/server/telegram/types";

type FaqTopic = "application" | "review" | "photos" | "access";
type Copy = {
  welcome: string;
  register: string;
  faqButton: string;
  support: string;
  languageButton: string;
  cancel: string;
  alreadyPending: string;
  alreadyApproved: string;
  alreadyRejected: string;
  alreadyBanned: string;
  faqTitle: string;
  back: string;
  supportText: string;
  languageTitle: string;
  faq: Record<FaqTopic, { title: string; answer: string }>;
  prompts: Record<"email" | "full_name" | "birth_date" | "location" | "measurements", string>;
  onboarding: Record<string, string>;
};

const COPY: Record<TelegramLang, Copy> = {
  EN: {
    welcome: "Welcome to VOYAGE Concierge. Submit your initial profile here, get answers to common questions, and receive your approval notification in this chat.",
    register: "Start application", faqButton: "FAQ", support: "Contact support", languageButton: "Language", cancel: "Application cancelled. Send /start to begin again.",
    alreadyPending: "We already have your application and it is waiting for review. We will message you here when its status changes.",
    alreadyApproved: "Your VOYAGE account is approved. Use the login details sent in this chat. Change your temporary password after signing in.",
    alreadyRejected: "A previous application is linked to this Telegram account. Contact support if you want to appeal or update it.",
    alreadyBanned: "Access to this VOYAGE account is currently restricted. Please contact support through the official channel.",
    faqTitle: "Choose a topic:", back: "Back to menu", languageTitle: "Choose your language:",
    supportText: "Contact the VOYAGE support team: @{{username}}\nPlease do not send passwords or payment-card details in chat.",
    faq: {
      application: { title: "Application", answer: "Choose “Start application”, enter an email you control, provide the requested profile details, and upload 2–3 portfolio photos. Your login account is created with a random password that is not disclosed before approval." },
      review: { title: "Review & KYC", answer: "After submitting your application, wait for Face Control review. If approved, the bot sends login details and a temporary password to this Telegram chat. Change the password immediately after signing in." },
      photos: { title: "Portfolio photos", answer: "Upload 2–3 clear photos that you are allowed to share. Send photos one by one. After at least two photos, type “done”. Photos are stored in private VOYAGE storage and associated with your profile." },
      access: { title: "Login & security", answer: "Your login is the email address from your application. The temporary password is delivered only after approval and is not stored in the profiles table. Never share it with anyone." },
    },
    prompts: {
      email: "1/5 — Enter the email address you will use to sign in:",
      full_name: "2/5 — What is your full legal name?",
      birth_date: "3/5 — Date of birth in YYYY-MM-DD format (for example, 2000-05-21):",
      location: "4/5 — Which city are you based in?",
      measurements: "5/5 — Enter measurements (bust / waist / hips). Example: 90 / 65 / 92",
    },
    onboarding: {
      onlyText: "Please reply with text.", invalidEmail: "Enter a valid email address you can access.", nameShort: "Please enter at least two characters.",
      dateFormat: "Use YYYY-MM-DD, for example 2000-05-21.", invalidDate: "That date is not valid. Check it and try again.", futureDate: "Date of birth cannot be in the future.", age: "You must be at least 18 to register.",
      measurements: "Enter bust, waist and hips, for example: 90 / 65 / 92.", portfolio: "Final step: send 2–3 portfolio photos, one at a time. When done, type “done”.",
      sendPhoto: "Please send a photo or type “done” after at least two photos.", tooFewPhotos: "At least 2 photos are required. Uploaded: {{count}}.", uploading: "Uploading photo {{n}}…",
      uploadFailed: "Could not upload the photo. Please try again.", uploaded: "Uploaded ({{count}}/3). Send another photo or type “done”.", saving: "Saving your application and creating a secure login…",
      failedDuplicate: "A profile is already linked to this Telegram account. Contact support for help.", failedEmail: "This email may already be registered. Contact support or use another email.",
      failedGeneric: "Could not save the application. Please try again later or contact support.", done: "✅ Application received. Your VOYAGE profile is waiting for Face Control review. Your login and temporary password will be sent here only after approval.",
      cancel: "Application cancelled.", missingTg: "Please open the bot in a private chat and send /start again.",
    },
  },
  RU: {
    welcome: "Добро пожаловать в VOYAGE Concierge. Здесь можно отправить первичную анкету, получить ответы на частые вопросы и получить уведомление об одобрении в этом чате.",
    register: "Заполнить анкету", faqButton: "Частые вопросы", support: "Связаться с поддержкой", languageButton: "Язык", cancel: "Анкета отменена. Отправьте /start, чтобы начать заново.",
    alreadyPending: "Ваша анкета уже получена и ожидает проверки. Мы сообщим сюда, когда статус изменится.",
    alreadyApproved: "Ваш аккаунт VOYAGE одобрен. Используйте данные для входа, отправленные в этом чате. После входа сразу смените временный пароль.",
    alreadyRejected: "С этим Telegram уже связана предыдущая заявка. Чтобы обжаловать решение или обновить данные, обратитесь в поддержку.",
    alreadyBanned: "Доступ к аккаунту VOYAGE временно ограничен. Обратитесь в поддержку по официальному каналу.",
    faqTitle: "Выберите тему:", back: "Назад в меню", languageTitle: "Выберите язык:",
    supportText: "Поддержка VOYAGE: @{{username}}\nНе отправляйте пароли и данные банковских карт в чат.",
    faq: {
      application: { title: "Анкета", answer: "Нажмите «Заполнить анкету», укажите доступный вам email, заполните данные профиля и загрузите 2–3 фотографии портфолио. Аккаунт создаётся со случайным паролем, который не раскрывается до одобрения." },
      review: { title: "Проверка и KYC", answer: "После отправки дождитесь проверки Face Control. Если анкета одобрена, бот пришлёт логин и временный пароль в этот Telegram-чат. После входа сразу смените пароль." },
      photos: { title: "Фото портфолио", answer: "Загрузите 2–3 чётких фотографии, которыми вы имеете право делиться. Отправляйте их по одной. После минимум двух фотографий напишите «готово». Фото сохраняются в приватном хранилище VOYAGE." },
      access: { title: "Вход и безопасность", answer: "Логин — email из анкеты. Временный пароль отправляется только после одобрения и не хранится в таблице профилей. Не передавайте его никому." },
    },
    prompts: {
      email: "1/5 — Укажите email, который будете использовать для входа:",
      full_name: "2/5 — Напишите ваше полное имя и фамилию:",
      birth_date: "3/5 — Дата рождения в формате ГГГГ-ММ-ДД (например, 2000-05-21):",
      location: "4/5 — В каком городе вы находитесь?",
      measurements: "5/5 — Укажите параметры (грудь / талия / бёдра). Пример: 90 / 65 / 92",
    },
    onboarding: {
      onlyText: "Пожалуйста, ответьте текстовым сообщением.", invalidEmail: "Укажите корректный email, к которому у вас есть доступ.", nameShort: "Введите не менее двух символов.",
      dateFormat: "Используйте формат ГГГГ-ММ-ДД, например 2000-05-21.", invalidDate: "Некорректная дата. Проверьте её и попробуйте ещё раз.", futureDate: "Дата рождения не может быть в будущем.", age: "Для регистрации вам должно быть не менее 18 лет.",
      measurements: "Укажите грудь, талию и бёдра, например: 90 / 65 / 92.", portfolio: "Последний шаг: отправьте 2–3 фотографии портфолио по одной. Когда закончите, напишите «готово».",
      sendPhoto: "Пришлите фотографию или напишите «готово» после загрузки минимум двух фото.", tooFewPhotos: "Нужно минимум 2 фотографии. Загружено: {{count}}.", uploading: "Загружаю фото {{n}}…",
      uploadFailed: "Не удалось загрузить фото. Попробуйте ещё раз.", uploaded: "Загружено ({{count}}/3). Пришлите ещё фото или напишите «готово».", saving: "Сохраняю анкету и создаю защищённый аккаунт…",
      failedDuplicate: "С этим Telegram уже связан профиль. Обратитесь в поддержку.", failedEmail: "Возможно, этот email уже зарегистрирован. Обратитесь в поддержку или укажите другой email.",
      failedGeneric: "Не удалось сохранить анкету. Попробуйте позже или обратитесь в поддержку.", done: "✅ Анкета принята. Профиль VOYAGE ожидает проверки Face Control. Логин и временный пароль придут сюда только после одобрения.",
      cancel: "Анкета отменена.", missingTg: "Откройте бота в личном чате и отправьте /start ещё раз.",
    },
  },
  ES: {
    welcome: "Te damos la bienvenida a VOYAGE Concierge. Envía aquí tu solicitud inicial, consulta preguntas frecuentes y recibe en este chat la notificación de aprobación.",
    register: "Iniciar solicitud", faqButton: "Preguntas frecuentes", support: "Contactar soporte", languageButton: "Idioma", cancel: "Solicitud cancelada. Envía /start para comenzar de nuevo.",
    alreadyPending: "Ya recibimos tu solicitud y está pendiente de revisión. Te avisaremos en este chat cuando cambie el estado.",
    alreadyApproved: "Tu cuenta VOYAGE está aprobada. Usa los datos enviados en este chat y cambia la contraseña temporal después de iniciar sesión.",
    alreadyRejected: "Ya hay una solicitud vinculada a esta cuenta de Telegram. Contacta con soporte para apelar o actualizarla.",
    alreadyBanned: "El acceso a esta cuenta VOYAGE está restringido temporalmente. Contacta con el soporte oficial.",
    faqTitle: "Elige un tema:", back: "Volver al menú", languageTitle: "Elige tu idioma:",
    supportText: "Soporte de VOYAGE: @{{username}}\nNo envíes contraseñas ni datos de tarjetas por chat.",
    faq: {
      application: { title: "Solicitud", answer: "Elige “Iniciar solicitud”, introduce un email al que tengas acceso, completa los datos y sube 2–3 fotos de portafolio. Se crea una cuenta con una contraseña aleatoria que no se revela antes de la aprobación." },
      review: { title: "Revisión y KYC", answer: "Después de enviar la solicitud, espera la revisión de Face Control. Si se aprueba, el bot enviará el usuario y una contraseña temporal a este chat. Cámbiala al iniciar sesión." },
      photos: { title: "Fotos de portafolio", answer: "Sube 2–3 fotos claras que tengas permiso para compartir. Envíalas una por una. Después de dos fotos como mínimo, escribe “listo”. Se guardarán en el almacenamiento privado de VOYAGE." },
      access: { title: "Acceso y seguridad", answer: "Tu usuario es el email de la solicitud. La contraseña temporal se entrega solo después de la aprobación y no se guarda en la tabla de perfiles. No la compartas." },
    },
    prompts: {
      email: "1/5 — Introduce el email que utilizarás para iniciar sesión:",
      full_name: "2/5 — Escribe tu nombre legal completo:",
      birth_date: "3/5 — Fecha de nacimiento en formato AAAA-MM-DD (por ejemplo, 2000-05-21):",
      location: "4/5 — ¿En qué ciudad te encuentras?",
      measurements: "5/5 — Indica medidas (busto / cintura / cadera). Ejemplo: 90 / 65 / 92",
    },
    onboarding: {
      onlyText: "Responde con un mensaje de texto.", invalidEmail: "Introduce un email válido al que tengas acceso.", nameShort: "Introduce al menos dos caracteres.",
      dateFormat: "Usa el formato AAAA-MM-DD, por ejemplo 2000-05-21.", invalidDate: "La fecha no es válida. Compruébala e inténtalo de nuevo.", futureDate: "La fecha de nacimiento no puede ser futura.", age: "Debes tener al menos 18 años para registrarte.",
      measurements: "Indica busto, cintura y cadera, por ejemplo: 90 / 65 / 92.", portfolio: "Último paso: envía 2–3 fotos de portafolio, una por una. Cuando termines, escribe “listo”.",
      sendPhoto: "Envía una foto o escribe “listo” después de enviar al menos dos.", tooFewPhotos: "Se requieren al menos 2 fotos. Subidas: {{count}}.", uploading: "Subiendo foto {{n}}…",
      uploadFailed: "No se pudo subir la foto. Inténtalo de nuevo.", uploaded: "Subidas ({{count}}/3). Envía otra foto o escribe “listo”.", saving: "Guardando la solicitud y creando un acceso seguro…",
      failedDuplicate: "Ya existe un perfil vinculado a esta cuenta de Telegram. Contacta con soporte.", failedEmail: "Es posible que este email ya esté registrado. Contacta con soporte o utiliza otro email.",
      failedGeneric: "No se pudo guardar la solicitud. Inténtalo más tarde o contacta con soporte.", done: "✅ Solicitud recibida. Tu perfil VOYAGE espera la revisión de Face Control. El usuario y la contraseña temporal se enviarán aquí tras la aprobación.",
      cancel: "Solicitud cancelada.", missingTg: "Abre el bot en un chat privado y envía /start de nuevo.",
    },
  },
  PT: {
    welcome: "Bem-vinda ao VOYAGE Concierge. Envie aqui sua solicitação inicial, consulte as perguntas frequentes e receba a notificação de aprovação neste chat.",
    register: "Iniciar solicitação", faqButton: "Perguntas frequentes", support: "Falar com suporte", languageButton: "Idioma", cancel: "Solicitação cancelada. Envie /start para começar novamente.",
    alreadyPending: "Já recebemos sua solicitação e ela está aguardando análise. Avisaremos neste chat quando o status mudar.",
    alreadyApproved: "Sua conta VOYAGE foi aprovada. Use os dados enviados neste chat e altere a senha temporária depois de entrar.",
    alreadyRejected: "Já existe uma solicitação vinculada a esta conta do Telegram. Fale com o suporte para recorrer ou atualizar os dados.",
    alreadyBanned: "O acesso a esta conta VOYAGE está temporariamente restrito. Fale com o suporte oficial.",
    faqTitle: "Escolha um tópico:", back: "Voltar ao menu", languageTitle: "Escolha seu idioma:",
    supportText: "Suporte VOYAGE: @{{username}}\nNão envie senhas ou dados de cartões pelo chat.",
    faq: {
      application: { title: "Solicitação", answer: "Escolha “Iniciar solicitação”, informe um email que você acessa, preencha os dados e envie 2–3 fotos de portfólio. A conta será criada com uma senha aleatória que não é revelada antes da aprovação." },
      review: { title: "Análise e KYC", answer: "Depois de enviar a solicitação, aguarde a análise do Face Control. Se aprovada, o bot enviará o login e uma senha temporária neste chat. Altere-a logo após entrar." },
      photos: { title: "Fotos do portfólio", answer: "Envie 2–3 fotos nítidas que você tenha autorização para compartilhar. Envie uma por vez. Depois de pelo menos duas fotos, escreva “pronto”. Elas serão armazenadas no espaço privado do VOYAGE." },
      access: { title: "Login e segurança", answer: "Seu login é o email informado na solicitação. A senha temporária é enviada somente após a aprovação e não fica armazenada na tabela de perfis. Não compartilhe essa senha." },
    },
    prompts: {
      email: "1/5 — Informe o email que usará para entrar:",
      full_name: "2/5 — Informe seu nome legal completo:",
      birth_date: "3/5 — Data de nascimento no formato AAAA-MM-DD (por exemplo, 2000-05-21):",
      location: "4/5 — Em qual cidade você está?",
      measurements: "5/5 — Informe as medidas (busto / cintura / quadril). Exemplo: 90 / 65 / 92",
    },
    onboarding: {
      onlyText: "Responda com uma mensagem de texto.", invalidEmail: "Informe um email válido ao qual você tenha acesso.", nameShort: "Informe pelo menos dois caracteres.",
      dateFormat: "Use o formato AAAA-MM-DD, por exemplo 2000-05-21.", invalidDate: "A data não é válida. Verifique e tente novamente.", futureDate: "A data de nascimento não pode estar no futuro.", age: "É necessário ter pelo menos 18 anos para se registrar.",
      measurements: "Informe busto, cintura e quadril, por exemplo: 90 / 65 / 92.", portfolio: "Última etapa: envie 2–3 fotos de portfólio, uma por vez. Ao terminar, digite “pronto”.",
      sendPhoto: "Envie uma foto ou digite “pronto” após enviar pelo menos duas.", tooFewPhotos: "São necessárias pelo menos 2 fotos. Enviadas: {{count}}.", uploading: "Enviando foto {{n}}…",
      uploadFailed: "Não foi possível enviar a foto. Tente novamente.", uploaded: "Enviadas ({{count}}/3). Envie outra foto ou digite “pronto”.", saving: "Salvando a solicitação e criando um acesso seguro…",
      failedDuplicate: "Já existe um perfil vinculado a esta conta do Telegram. Fale com o suporte.", failedEmail: "Este email pode já estar registrado. Fale com o suporte ou use outro email.",
      failedGeneric: "Não foi possível salvar a solicitação. Tente mais tarde ou fale com o suporte.", done: "✅ Solicitação recebida. Seu perfil VOYAGE aguarda a análise do Face Control. O login e a senha temporária serão enviados aqui após a aprovação.",
      cancel: "Solicitação cancelada.", missingTg: "Abra o bot em uma conversa privada e envie /start novamente.",
    },
  },
};

export function copy(lang: TelegramLang): Copy {
  return COPY[lang];
}

export function mainMenu(lang: TelegramLang) {
  const t = COPY[lang];
  return new InlineKeyboard()
    .text(t.register, "menu:register").row()
    .text(t.faqButton, "menu:faq").text(t.support, "menu:support").row()
    .text(t.languageButton, "menu:language");
}

export function faqMenu(lang: TelegramLang) {
  const t = COPY[lang];
  return new InlineKeyboard()
    .text(t.faq.application.title, "faq:application").row()
    .text(t.faq.review.title, "faq:review").row()
    .text(t.faq.photos.title, "faq:photos").row()
    .text(t.faq.access.title, "faq:access").row()
    .text(t.back, "faq:back");
}

export function languageMenu() {
  return new InlineKeyboard()
    .text("English", "lang:EN").text("Русский", "lang:RU").row()
    .text("Español", "lang:ES").text("Português", "lang:PT");
}
