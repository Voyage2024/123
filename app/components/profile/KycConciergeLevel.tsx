"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · KYC 3 — Консьерж / Личная верификация
 * app/components/profile/KycConciergeLevel.tsx
 *
 * Карточка третьего уровня внутри KycSection:
 *   • презентация «Зачем проходить 3-й уровень» и три ключевых привилегии;
 *   • как проходит встреча (3 шага);
 *   • превью: где появится знак (шапка профиля + карточка для заказчиков);
 *   • запись к консьержу: форма → заявка в partner_concierge_requests
 *     (существующий server action createConciergeRequest, её видит команда
 *     в /admin/concierge) + прямые кнопки Telegram / WhatsApp, если заданы
 *     NEXT_PUBLIC_CONCIERGE_TELEGRAM / NEXT_PUBLIC_CONCIERGE_WHATSAPP.
 *
 * Уровень по-прежнему ставит только персонал (club_admin_set_kyc_level),
 * здесь — кнопки «Подтвердить / Отозвать» для admin/owner.
 * Тексты RU/EN/ES/PT — словарь ниже (CONCIERGE_DICT).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ConciergeBell,
  Crown,
  Gem,
  Headset,
  Hourglass,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Send,
  ShieldCheck,
  Sparkles,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { createConciergeRequest, listMyConciergeRequests } from "@/app/actions/concierge";
import { cormorant } from "@/app/components/profile/fonts";
import { VipAvatarMark, VipBadge, VipSeal } from "@/app/components/profile/VipBadge";
import { CONCIERGE_CONTACT, conciergeTelegramUrl, conciergeWhatsappUrl } from "@/lib/concierge-contact";

/** Метка в заголовке заявки — по ней карточка узнаёт свою заявку */
export const KYC3_REQUEST_PREFIX = "[KYC 3]";

export type ConciergeLevelState = "completed" | "pending" | "locked";
type MeetFormat = "online" | "meeting";
type Channel = "telegram" | "whatsapp" | "call";

/* ══════════════════════════════════════════════════════════════════
 * ЛОКАЛИЗАЦИЯ
 * ══════════════════════════════════════════════════════════════════ */

type ConciergeDict = {
  level: string;
  eyebrow: string;
  title: string;
  lead: string;
  status: { completed: string; pending: string; review: string; locked: string };
  confirm: string;
  revoke: string;
  whyTitle: string;
  whyLead: string;
  benefits: { kicker: string; title: string; text: string }[];
  alsoTitle: string;
  also: string[];
  howTitle: string;
  steps: { title: string; text: string }[];
  previewTitle: string;
  previewLead: string;
  previewLeadDone: string;
  previewProfile: string;
  previewCard: string;
  previewHidden: string;
  previewCaption: string;
  previewSample: string;
  bookTitle: string;
  bookLead: string;
  formatLabel: string;
  formats: Record<MeetFormat, { title: string; hint: string }>;
  channelLabel: string;
  channels: Record<Channel, string>;
  contactLabel: string;
  contactPlaceholder: Record<Channel, string>;
  contactHint: string;
  whenLabel: string;
  whenHint: string;
  noteLabel: string;
  notePlaceholder: string;
  submit: string;
  submitting: string;
  directTitle: string;
  directTelegram: string;
  directWhatsapp: string;
  directMessage: (name: string) => string;
  requestedTitle: string;
  requestedText: (date: string) => string;
  requestedInProgress: string;
  openChat: string;
  errors: Record<string, string>;
  errorGeneric: string;
  lockedNote: string;
  doneTitle: string;
  doneText: string;
  doneUnlocked: string;
  requestTitle: string;
  msg: {
    intro: string;
    format: string;
    channel: string;
    contact: string;
    when: string;
    note: string;
    any: string;
  };
};

const RU: ConciergeDict = {
  level: "Уровень 3",
  eyebrow: "Вершина клуба",
  title: "Консьерж · Личная верификация",
  lead:
    "Короткая личная встреча с консьержем VOYAGE — онлайн или вживую. Последний шаг, после которого вы входите в высшую лигу клуба.",
  status: { completed: "Пройдено", pending: "Доступно", review: "Встреча запрошена", locked: "Закрыто" },
  confirm: "Подтвердить",
  revoke: "Отозвать",
  whyTitle: "Зачем проходить 3-й уровень верификации?",
  whyLead:
    "Это не формальность, а знакомство. Мы лично узнаём каждую резидентку высшего круга — поэтому заказчики доверяют ей без оговорок.",
  benefits: [
    {
      kicker: "Привилегия I",
      title: "Закрытые VIP-кастинги и премиум-контракты",
      text: "Приглашения, которые никогда не появляются в общей ленте: частные туры, флагманские проекты и контракты с повышенным гонораром.",
    },
    {
      kicker: "Привилегия II",
      title: "Персональный консьерж VOYAGE 24/7",
      text: "Ваш личный человек в клубе: перелёты, отели, трансфер, документы и любые вопросы в пути — днём и ночью.",
    },
    {
      kicker: "Привилегия III",
      title: "Золотой знак максимального доверия",
      text: "Эксклюзивный бейдж в профиле и в анкете для заказчиков. Его нельзя купить — только получить лично.",
    },
  ],
  alsoTitle: "А также",
  also: ["VIP-туры", "Приоритетное бронирование", "Максимальное доверие заказчиков"],
  howTitle: "Как проходит встреча",
  steps: [
    { title: "Запрос", text: "Выберите формат и удобное время — это займёт пару минут." },
    { title: "Встреча 15–20 минут", text: "Видеозвонок или живая встреча с консьержем. Спокойный разговор, без экзаменов." },
    { title: "Золотой знак", text: "Сразу после подтверждения статус и знак появятся в вашем профиле." },
  ],
  previewTitle: "Где появится ваш знак",
  previewLead: "Так вас будут видеть после встречи с консьержем:",
  previewLeadDone: "Так вас уже видят в клубе:",
  previewProfile: "Шапка вашего профиля",
  previewCard: "Анкета для заказчиков и менеджеров",
  previewHidden: "Имя скрыто до сделки",
  previewCaption:
    "Знак виден рядом с именем и на фото — в кабинете, в анкете для заказчиков и в откликах на кастинги. Даже в анонимной анкете заказчик сразу видит ваш статус.",
  previewSample: "Пример",
  bookTitle: "Записаться к консьержу",
  bookLead: "Оставьте запрос — консьерж свяжется с вами в течение 24 часов и согласует время.",
  formatLabel: "Формат встречи",
  formats: {
    online: { title: "Онлайн-созвон", hint: "Видеозвонок 15–20 минут из любой точки мира" },
    meeting: { title: "Живая встреча", hint: "Лично с консьержем — в городе, где есть команда клуба" },
  },
  channelLabel: "Как с вами связаться",
  channels: { telegram: "Telegram", whatsapp: "WhatsApp", call: "Звонок" },
  contactLabel: "Контакт",
  contactPlaceholder: { telegram: "@username", whatsapp: "+7 900 000-00-00", call: "+7 900 000-00-00" },
  contactHint: "Для Telegram можно оставить пустым — мы напишем в аккаунт, привязанный к клубу.",
  whenLabel: "Удобные дата и время",
  whenHint: "Необязательно — консьерж предложит варианты сам.",
  noteLabel: "Пожелания",
  notePlaceholder: "Например: удобнее вечером по Дубаю, говорю на английском…",
  submit: "Запросить встречу с консьержем",
  submitting: "Отправляем…",
  directTitle: "Или напишите консьержу напрямую",
  directTelegram: "Написать в Telegram",
  directWhatsapp: "Написать в WhatsApp",
  directMessage: (name) =>
    `Здравствуйте! Я ${name || "резидентка VOYAGE"}, хочу пройти 3-й уровень верификации — личную встречу с консьержем.`,
  requestedTitle: "Запрос у консьержа",
  requestedText: (date) => `Вы отправили запрос ${date}. Консьерж свяжется с вами в течение 24 часов, чтобы согласовать время.`,
  requestedInProgress: "Консьерж уже занимается вашим запросом.",
  openChat: "Открыть переписку",
  errors: {
    not_approved: "Запись станет доступна, когда ваша анкета будет одобрена клубом.",
    resident_only: "Запись к консьержу доступна только резиденткам.",
    banned: "Сейчас запись недоступна. Напишите в поддержку клуба.",
    unauthenticated: "Сессия истекла — войдите снова.",
    validation: "Проверьте поля формы.",
  },
  errorGeneric: "Не удалось отправить запрос. Попробуйте ещё раз.",
  lockedNote: "Запись откроется после уровня 2",
  doneTitle: "Добро пожаловать в высшую лигу VOYAGE",
  doneText:
    "Консьерж подтвердил вашу личность. Золотой знак уже в вашем профиле — заказчики и менеджеры видят его в анкете.",
  doneUnlocked: "Открыто",
  requestTitle: "Личная верификация с консьержем",
  msg: {
    intro: "Запрос на 3-й уровень верификации (личная встреча с консьержем).",
    format: "Формат",
    channel: "Связь",
    contact: "Контакт",
    when: "Удобное время",
    note: "Пожелания",
    any: "любое",
  },
};

const EN: ConciergeDict = {
  level: "Level 3",
  eyebrow: "The summit of the club",
  title: "Concierge · Personal verification",
  lead:
    "A short personal meeting with a VOYAGE concierge — online or in person. The final step that brings you into the club's highest league.",
  status: { completed: "Completed", pending: "Available", review: "Meeting requested", locked: "Locked" },
  confirm: "Confirm",
  revoke: "Revoke",
  whyTitle: "Why complete verification level 3?",
  whyLead:
    "It isn't a formality — it's an introduction. We personally get to know every resident of the inner circle, which is why clients trust her without reservation.",
  benefits: [
    {
      kicker: "Privilege I",
      title: "Private VIP castings and premium contracts",
      text: "Invitations that never appear in the general feed: private tours, flagship projects and contracts with higher fees.",
    },
    {
      kicker: "Privilege II",
      title: "Your personal VOYAGE concierge, 24/7",
      text: "Your own person at the club: flights, hotels, transfers, documents and anything on the road — day and night.",
    },
    {
      kicker: "Privilege III",
      title: "The golden badge of highest trust",
      text: "An exclusive badge on your profile and on the card clients see. It can't be bought — only earned in person.",
    },
  ],
  alsoTitle: "Also included",
  also: ["VIP tours", "Priority booking", "Maximum client trust"],
  howTitle: "How the meeting works",
  steps: [
    { title: "Request", text: "Choose a format and a convenient time — it takes a couple of minutes." },
    { title: "A 15–20 minute meeting", text: "A video call or an in-person meeting with the concierge. A relaxed conversation, not an exam." },
    { title: "The golden badge", text: "Right after confirmation, your status and badge appear on your profile." },
  ],
  previewTitle: "Where your badge will appear",
  previewLead: "This is how you'll be seen after meeting the concierge:",
  previewLeadDone: "This is how the club sees you now:",
  previewProfile: "Your profile header",
  previewCard: "The card clients and managers see",
  previewHidden: "Name hidden until the deal",
  previewCaption:
    "The badge sits next to your name and on your photo — in your account, on the card clients see and in casting responses. Even on an anonymous card, clients see your status at once.",
  previewSample: "Preview",
  bookTitle: "Book the concierge",
  bookLead: "Leave a request — the concierge will contact you within 24 hours to agree on a time.",
  formatLabel: "Meeting format",
  formats: {
    online: { title: "Online call", hint: "A 15–20 minute video call from anywhere in the world" },
    meeting: { title: "In-person meeting", hint: "Face to face with the concierge, in a city where the club team is present" },
  },
  channelLabel: "How to reach you",
  channels: { telegram: "Telegram", whatsapp: "WhatsApp", call: "Phone call" },
  contactLabel: "Contact",
  contactPlaceholder: { telegram: "@username", whatsapp: "+44 7000 000000", call: "+44 7000 000000" },
  contactHint: "For Telegram you can leave it empty — we'll message the account linked to the club.",
  whenLabel: "Preferred date and time",
  whenHint: "Optional — the concierge will suggest options.",
  noteLabel: "Wishes",
  notePlaceholder: "For example: evenings Dubai time work best, I speak English…",
  submit: "Request a concierge meeting",
  submitting: "Sending…",
  directTitle: "Or message the concierge directly",
  directTelegram: "Message on Telegram",
  directWhatsapp: "Message on WhatsApp",
  directMessage: (name) =>
    `Hello! I'm ${name || "a VOYAGE resident"} and I'd like to complete verification level 3 — a personal meeting with the concierge.`,
  requestedTitle: "Your request is with the concierge",
  requestedText: (date) => `You sent your request on ${date}. The concierge will contact you within 24 hours to agree on a time.`,
  requestedInProgress: "The concierge is already working on your request.",
  openChat: "Open the conversation",
  errors: {
    not_approved: "Booking opens once the club approves your profile.",
    resident_only: "Concierge booking is available to residents only.",
    banned: "Booking is unavailable right now. Please contact club support.",
    unauthenticated: "Your session has expired — please sign in again.",
    validation: "Please check the form fields.",
  },
  errorGeneric: "Couldn't send the request. Please try again.",
  lockedNote: "Booking opens after level 2",
  doneTitle: "Welcome to VOYAGE's highest league",
  doneText:
    "The concierge has confirmed your identity. The golden badge is already on your profile — clients and managers see it on your card.",
  doneUnlocked: "Unlocked",
  requestTitle: "Personal verification with the concierge",
  msg: {
    intro: "Request for verification level 3 (personal meeting with the concierge).",
    format: "Format",
    channel: "Contact via",
    contact: "Contact",
    when: "Preferred time",
    note: "Wishes",
    any: "any",
  },
};

const ES: ConciergeDict = {
  level: "Nivel 3",
  eyebrow: "La cima del club",
  title: "Concierge · Verificación personal",
  lead:
    "Un breve encuentro personal con un concierge de VOYAGE, en línea o en persona. El último paso para entrar en la liga más alta del club.",
  status: { completed: "Completado", pending: "Disponible", review: "Encuentro solicitado", locked: "Bloqueado" },
  confirm: "Confirmar",
  revoke: "Revocar",
  whyTitle: "¿Por qué completar el nivel 3 de verificación?",
  whyLead:
    "No es una formalidad, es una presentación. Conocemos en persona a cada residente del círculo más alto, por eso los clientes confían en ella sin reservas.",
  benefits: [
    {
      kicker: "Privilegio I",
      title: "Castings VIP privados y contratos premium",
      text: "Invitaciones que nunca aparecen en el feed general: tours privados, proyectos insignia y contratos con honorarios más altos.",
    },
    {
      kicker: "Privilegio II",
      title: "Concierge personal de VOYAGE 24/7",
      text: "Tu persona de confianza en el club: vuelos, hoteles, traslados, documentos y cualquier imprevisto en el viaje, de día y de noche.",
    },
    {
      kicker: "Privilegio III",
      title: "La insignia dorada de máxima confianza",
      text: "Una insignia exclusiva en tu perfil y en la ficha que ven los clientes. No se puede comprar: solo se obtiene en persona.",
    },
  ],
  alsoTitle: "Además",
  also: ["Tours VIP", "Reserva prioritaria", "Máxima confianza de los clientes"],
  howTitle: "Cómo es el encuentro",
  steps: [
    { title: "Solicitud", text: "Elige el formato y un horario cómodo: te llevará un par de minutos." },
    { title: "Encuentro de 15–20 minutos", text: "Videollamada o encuentro en persona con el concierge. Una conversación tranquila, sin exámenes." },
    { title: "La insignia dorada", text: "Justo después de la confirmación, tu estatus y tu insignia aparecen en tu perfil." },
  ],
  previewTitle: "Dónde aparecerá tu insignia",
  previewLead: "Así te verán después del encuentro con el concierge:",
  previewLeadDone: "Así te ve ya el club:",
  previewProfile: "Cabecera de tu perfil",
  previewCard: "Ficha para clientes y managers",
  previewHidden: "Nombre oculto hasta el acuerdo",
  previewCaption:
    "La insignia aparece junto a tu nombre y en tu foto: en tu cuenta, en la ficha para clientes y en las respuestas a castings. Incluso en una ficha anónima, el cliente ve tu estatus al instante.",
  previewSample: "Vista previa",
  bookTitle: "Reservar con el concierge",
  bookLead: "Deja tu solicitud: el concierge te contactará en un plazo de 24 horas para acordar el horario.",
  formatLabel: "Formato del encuentro",
  formats: {
    online: { title: "Llamada en línea", hint: "Videollamada de 15–20 minutos desde cualquier lugar del mundo" },
    meeting: { title: "Encuentro en persona", hint: "Cara a cara con el concierge, en una ciudad donde esté el equipo del club" },
  },
  channelLabel: "Cómo contactarte",
  channels: { telegram: "Telegram", whatsapp: "WhatsApp", call: "Llamada" },
  contactLabel: "Contacto",
  contactPlaceholder: { telegram: "@usuario", whatsapp: "+34 600 000 000", call: "+34 600 000 000" },
  contactHint: "Para Telegram puedes dejarlo vacío: escribiremos a la cuenta vinculada al club.",
  whenLabel: "Fecha y hora preferidas",
  whenHint: "Opcional: el concierge te propondrá opciones.",
  noteLabel: "Preferencias",
  notePlaceholder: "Por ejemplo: mejor por la tarde, hora de Dubái; hablo inglés…",
  submit: "Solicitar encuentro con el concierge",
  submitting: "Enviando…",
  directTitle: "O escribe directamente al concierge",
  directTelegram: "Escribir por Telegram",
  directWhatsapp: "Escribir por WhatsApp",
  directMessage: (name) =>
    `¡Hola! Soy ${name || "residente de VOYAGE"} y quiero completar el nivel 3 de verificación: un encuentro personal con el concierge.`,
  requestedTitle: "Tu solicitud está con el concierge",
  requestedText: (date) => `Enviaste tu solicitud el ${date}. El concierge te contactará en un plazo de 24 horas para acordar el horario.`,
  requestedInProgress: "El concierge ya está atendiendo tu solicitud.",
  openChat: "Abrir la conversación",
  errors: {
    not_approved: "La reserva se abrirá cuando el club apruebe tu perfil.",
    resident_only: "La reserva con el concierge es solo para residentes.",
    banned: "La reserva no está disponible ahora. Escribe al soporte del club.",
    unauthenticated: "Tu sesión ha caducado: vuelve a iniciar sesión.",
    validation: "Revisa los campos del formulario.",
  },
  errorGeneric: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
  lockedNote: "La reserva se abre después del nivel 2",
  doneTitle: "Bienvenida a la liga más alta de VOYAGE",
  doneText:
    "El concierge ha confirmado tu identidad. La insignia dorada ya está en tu perfil: clientes y managers la ven en tu ficha.",
  doneUnlocked: "Desbloqueado",
  requestTitle: "Verificación personal con el concierge",
  msg: {
    intro: "Solicitud de verificación de nivel 3 (encuentro personal con el concierge).",
    format: "Formato",
    channel: "Contacto por",
    contact: "Contacto",
    when: "Horario preferido",
    note: "Preferencias",
    any: "cualquiera",
  },
};

const PT: ConciergeDict = {
  level: "Nível 3",
  eyebrow: "O topo do clube",
  title: "Concierge · Verificação pessoal",
  lead:
    "Um breve encontro pessoal com um concierge da VOYAGE, online ou presencial. O último passo para entrar na liga mais alta do clube.",
  status: { completed: "Concluído", pending: "Disponível", review: "Encontro solicitado", locked: "Bloqueado" },
  confirm: "Confirmar",
  revoke: "Revogar",
  whyTitle: "Por que concluir o nível 3 de verificação?",
  whyLead:
    "Não é uma formalidade, é uma apresentação. Conhecemos pessoalmente cada residente do círculo mais alto — por isso os clientes confiam nela sem reservas.",
  benefits: [
    {
      kicker: "Privilégio I",
      title: "Castings VIP fechados e contratos premium",
      text: "Convites que nunca aparecem no feed geral: tours privados, projetos de destaque e contratos com cachê mais alto.",
    },
    {
      kicker: "Privilégio II",
      title: "Concierge pessoal VOYAGE 24/7",
      text: "Sua pessoa de confiança no clube: voos, hotéis, traslados, documentos e qualquer questão na viagem, de dia e de noite.",
    },
    {
      kicker: "Privilégio III",
      title: "O selo dourado de confiança máxima",
      text: "Um selo exclusivo no seu perfil e na ficha que os clientes veem. Não se compra — só se conquista pessoalmente.",
    },
  ],
  alsoTitle: "E também",
  also: ["Tours VIP", "Reserva prioritária", "Confiança máxima dos clientes"],
  howTitle: "Como funciona o encontro",
  steps: [
    { title: "Pedido", text: "Escolha o formato e um horário conveniente — leva só alguns minutos." },
    { title: "Encontro de 15–20 minutos", text: "Videochamada ou encontro presencial com o concierge. Uma conversa tranquila, sem provas." },
    { title: "O selo dourado", text: "Logo após a confirmação, seu status e seu selo aparecem no perfil." },
  ],
  previewTitle: "Onde seu selo vai aparecer",
  previewLead: "É assim que você será vista depois do encontro com o concierge:",
  previewLeadDone: "É assim que o clube já vê você:",
  previewProfile: "Cabeçalho do seu perfil",
  previewCard: "Ficha para clientes e gerentes",
  previewHidden: "Nome oculto até o acordo",
  previewCaption:
    "O selo fica ao lado do seu nome e na sua foto — na sua conta, na ficha para clientes e nas respostas a castings. Mesmo numa ficha anônima, o cliente vê seu status na hora.",
  previewSample: "Prévia",
  bookTitle: "Agendar com o concierge",
  bookLead: "Deixe seu pedido — o concierge entrará em contato em até 24 horas para combinar o horário.",
  formatLabel: "Formato do encontro",
  formats: {
    online: { title: "Chamada online", hint: "Videochamada de 15–20 minutos de qualquer lugar do mundo" },
    meeting: { title: "Encontro presencial", hint: "Pessoalmente com o concierge, numa cidade onde a equipe do clube está" },
  },
  channelLabel: "Como falar com você",
  channels: { telegram: "Telegram", whatsapp: "WhatsApp", call: "Ligação" },
  contactLabel: "Contato",
  contactPlaceholder: { telegram: "@usuario", whatsapp: "+55 11 90000-0000", call: "+55 11 90000-0000" },
  contactHint: "Para Telegram pode deixar vazio — escreveremos para a conta vinculada ao clube.",
  whenLabel: "Data e horário preferidos",
  whenHint: "Opcional — o concierge vai sugerir opções.",
  noteLabel: "Preferências",
  notePlaceholder: "Por exemplo: melhor à noite, horário de Dubai; falo inglês…",
  submit: "Solicitar encontro com o concierge",
  submitting: "Enviando…",
  directTitle: "Ou escreva direto para o concierge",
  directTelegram: "Escrever no Telegram",
  directWhatsapp: "Escrever no WhatsApp",
  directMessage: (name) =>
    `Olá! Sou ${name || "residente da VOYAGE"} e quero concluir o nível 3 de verificação — um encontro pessoal com o concierge.`,
  requestedTitle: "Seu pedido está com o concierge",
  requestedText: (date) => `Você enviou o pedido em ${date}. O concierge entrará em contato em até 24 horas para combinar o horário.`,
  requestedInProgress: "O concierge já está cuidando do seu pedido.",
  openChat: "Abrir a conversa",
  errors: {
    not_approved: "O agendamento abre quando o clube aprovar seu perfil.",
    resident_only: "O agendamento com o concierge é só para residentes.",
    banned: "O agendamento está indisponível agora. Fale com o suporte do clube.",
    unauthenticated: "Sua sessão expirou — entre novamente.",
    validation: "Confira os campos do formulário.",
  },
  errorGeneric: "Não foi possível enviar o pedido. Tente novamente.",
  lockedNote: "O agendamento abre após o nível 2",
  doneTitle: "Bem-vinda à liga mais alta da VOYAGE",
  doneText:
    "O concierge confirmou sua identidade. O selo dourado já está no seu perfil — clientes e gerentes o veem na sua ficha.",
  doneUnlocked: "Liberado",
  requestTitle: "Verificação pessoal com o concierge",
  msg: {
    intro: "Pedido de verificação de nível 3 (encontro pessoal com o concierge).",
    format: "Formato",
    channel: "Contato por",
    contact: "Contato",
    when: "Horário preferido",
    note: "Preferências",
    any: "qualquer",
  },
};

export const CONCIERGE_DICT: Record<Lang, ConciergeDict> = { RU, EN, ES, PT };

const DATE_LOCALE: Record<Lang, string> = { RU: "ru-RU", EN: "en-GB", ES: "es-ES", PT: "pt-BR" };
const BENEFIT_ICONS: LucideIcon[] = [Gem, Headset, Crown];
const ALSO_ICONS: LucideIcon[] = [Plane, CalendarClock, ShieldCheck];
const STEP_ICONS: LucideIcon[] = [ConciergeBell, Video, Crown];

/* ══════════════════════════════════════════════════════════════════
 * МЕЛКИЕ ЭЛЕМЕНТЫ
 * ══════════════════════════════════════════════════════════════════ */

function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "V";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-amber-200/75">{children}</p>;
}

function StatusChip({ kind, t }: { kind: "completed" | "pending" | "review" | "locked"; t: ConciergeDict }) {
  const cfg = {
    completed: { Icon: CheckCircle2, cls: "border-amber-200/45 bg-amber-200/[0.12] text-amber-100" },
    pending: { Icon: Sparkles, cls: "border-amber-200/30 bg-amber-200/[0.07] text-amber-200" },
    review: { Icon: Hourglass, cls: "border-amber-200/35 bg-amber-200/10 text-amber-100" },
    locked: { Icon: Lock, cls: "border-zinc-700/50 bg-zinc-900/60 text-zinc-400" },
  }[kind];
  const { Icon } = cfg;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] sm:px-2.5 sm:py-1 sm:text-[10px] ${cfg.cls}`}
    >
      <Icon aria-hidden className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      {t.status[kind]}
    </span>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { key: T; title: string; hint?: string; Icon: LucideIcon }[];
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</legend>
      <div className={`grid gap-2 ${options.length === 2 ? "sm:grid-cols-2" : "grid-cols-3"}`}>
        {options.map(({ key, title, hint, Icon }) => {
          const active = key === value;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={`flex min-h-11 min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2.5 sm:gap-2.5 sm:px-3 text-left transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/60 ${
                active
                  ? "border-amber-200/55 bg-amber-200/[0.09] shadow-[0_0_24px_-12px_rgba(253,230,138,0.7)]"
                  : "border-zinc-800 bg-zinc-950/50 hover:border-amber-200/25"
              } ${hint ? "" : "items-center justify-center"}`}
            >
              <Icon
                aria-hidden
                className={`mt-0.5 h-4 w-4 shrink-0 ${hint ? "" : "hidden min-[400px]:block"} ${active ? "text-amber-200" : "text-zinc-500"}`}
                strokeWidth={1.5}
              />
              <span className="min-w-0">
                <span className={`block text-[12.5px] font-medium ${active ? "text-amber-50" : "text-zinc-300"}`}>{title}</span>
                {hint && <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const INPUT =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-200/45 disabled:opacity-50 [color-scheme:dark]";

/* ══════════════════════════════════════════════════════════════════
 * ПРЕВЬЮ ЗНАКА
 * ══════════════════════════════════════════════════════════════════ */

function BadgePreview({
  t,
  lang,
  fullName,
  avatarUrl,
  done,
}: {
  done: boolean;
  t: ConciergeDict;
  lang: Lang;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const name = fullName?.trim() || "Voyage Resident";
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-zinc-950/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>{t.previewTitle}</Eyebrow>
        <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
          {t.previewSample}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-zinc-400">{done ? t.previewLeadDone : t.previewLead}</p>

      <div aria-hidden className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* 1. шапка профиля */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-3.5">
          <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-500">{t.previewProfile}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="relative shrink-0">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-amber-200/45 bg-zinc-900">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className={`${cormorant.className} text-lg text-amber-100/85`}>{initialsOf(fullName)}</span>
                )}
              </span>
              <VipAvatarMark lang={lang} size="sm" className="-bottom-0.5 -right-0.5" />
            </span>
            <span className="min-w-0">
              <span className={`${cormorant.className} flex items-center gap-1.5 truncate text-xl leading-tight text-zinc-50`}>
                <span className="truncate">{name}</span>
                <VipSeal className="h-4 w-4" />
              </span>
              <span className="mt-1.5 block">
                <VipBadge lang={lang} variant="compact" />
              </span>
            </span>
          </div>
        </div>

        {/* 2. анкета для заказчиков */}
        <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-3.5">
          <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-500">{t.previewCard}</p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-mono text-xs tracking-[0.2em] text-amber-200/80">VY-••••</span>
              <span className="mt-1 block truncate text-sm text-zinc-300">{t.previewHidden}</span>
            </span>
            <span className="relative flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
              <Lock className="h-3.5 w-3.5 text-zinc-600" strokeWidth={1.5} />
              <VipAvatarMark lang={lang} size="sm" className="-bottom-1.5 -right-1.5" />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <VipBadge lang={lang} variant="compact" />
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 px-2 py-0.5 text-[9px] text-zinc-400">
              172 cm · EN · RU
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3.5 text-[11.5px] leading-relaxed text-zinc-500">{t.previewCaption}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ЗАПИСЬ К КОНСЬЕРЖУ
 * ══════════════════════════════════════════════════════════════════ */

type OpenRequest = { id: string; createdAt: string; status: "open" | "in_progress" };

function DirectLinks({ t, fullName }: { t: ConciergeDict; fullName: string | null }) {
  if (!CONCIERGE_CONTACT.hasTelegram && !CONCIERGE_CONTACT.hasWhatsapp) return null;
  const text = t.directMessage(fullName?.trim() ?? "");
  const tg = conciergeTelegramUrl(text);
  const wa = conciergeWhatsappUrl(text);
  const cls =
    "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-950/60 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-200 transition hover:border-amber-200/45 hover:text-amber-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/60";
  return (
    <div className="mt-4 border-t border-white/[0.05] pt-4">
      <p className="mb-2.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.directTitle}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {tg && (
          <a href={tg} target="_blank" rel="noopener noreferrer" className={cls}>
            <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.6} />
            {t.directTelegram}
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={cls}>
            <MessageCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={1.6} />
            {t.directWhatsapp}
          </a>
        )}
      </div>
    </div>
  );
}

function BookingPanel({
  t,
  lang,
  fullName,
  existing,
  onRequested,
}: {
  t: ConciergeDict;
  lang: Lang;
  fullName: string | null;
  existing: OpenRequest | null;
  onRequested: (r: OpenRequest) => void;
}) {
  const uid = useId();
  const [format, setFormat] = useState<MeetFormat>("online");
  const [channel, setChannel] = useState<Channel>(CONCIERGE_CONTACT.hasWhatsapp && !CONCIERGE_CONTACT.hasTelegram ? "whatsapp" : "telegram");
  const [contact, setContact] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(DATE_LOCALE[lang] ?? "en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(
      new Date(iso),
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmedContact = contact.trim().slice(0, 120);
    if (channel !== "telegram" && trimmedContact.replace(/\D/g, "").length < 7) {
      setError(t.errors.validation);
      return;
    }
    setBusy(true);
    setError(null);

    const desiredAt = when ? new Date(when).toISOString() : null;
    const lines = [
      t.msg.intro,
      `${t.msg.format}: ${t.formats[format].title}`,
      `${t.msg.channel}: ${t.channels[channel]}`,
      trimmedContact ? `${t.msg.contact}: ${trimmedContact}` : null,
      `${t.msg.when}: ${when ? fmtDate(desiredAt as string) : t.msg.any}`,
      note.trim() ? `${t.msg.note}: ${note.trim().slice(0, 1500)}` : null,
    ].filter(Boolean);

    try {
      const res = await createConciergeRequest({
        title: `${KYC3_REQUEST_PREFIX} ${t.requestTitle}`,
        category: "documents",
        message: lines.join("\n"),
        tripStage: "before_tour",
        desiredAt,
        language: lang,
      });
      if (!res.ok) {
        setError(t.errors[res.reason] ?? t.errorGeneric);
        return;
      }
      onRequested({ id: String(res.request?.id ?? ""), createdAt: String(res.request?.created_at ?? new Date().toISOString()), status: "open" });
    } catch {
      setError(t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  /* запрос уже у консьержа */
  if (existing) {
    return (
      <div className="rounded-2xl border border-amber-200/30 bg-[linear-gradient(135deg,rgba(253,230,138,0.10)_0%,rgba(253,230,138,0.02)_100%)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/45 text-amber-200">
            <Hourglass aria-hidden className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-50">{t.requestedTitle}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-300">
              {existing.status === "in_progress" ? t.requestedInProgress : t.requestedText(fmtDate(existing.createdAt))}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/dashboard/concierge"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-amber-200/45 bg-amber-200/10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100 transition hover:bg-amber-200/15"
              >
                {t.openChat}
                <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
        <DirectLinks t={t} fullName={fullName} />
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="relative overflow-hidden rounded-2xl border border-amber-200/25 bg-zinc-950/70 p-4 sm:p-5"
      aria-labelledby={`${uid}-book`}
    >
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-200/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/45 bg-amber-200/10 text-amber-200">
            <ConciergeBell aria-hidden className="h-4 w-4" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h4 id={`${uid}-book`} className={`${cormorant.className} text-[22px] leading-tight text-zinc-50`}>
              {t.bookTitle}
            </h4>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">{t.bookLead}</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <Segmented
            label={t.formatLabel}
            value={format}
            onChange={setFormat}
            disabled={busy}
            options={[
              { key: "online", title: t.formats.online.title, hint: t.formats.online.hint, Icon: Video },
              { key: "meeting", title: t.formats.meeting.title, hint: t.formats.meeting.hint, Icon: MapPin },
            ]}
          />
          <Segmented
            label={t.channelLabel}
            value={channel}
            onChange={setChannel}
            disabled={busy}
            options={[
              { key: "telegram", title: t.channels.telegram, Icon: Send },
              { key: "whatsapp", title: t.channels.whatsapp, Icon: MessageCircle },
              { key: "call", title: t.channels.call, Icon: Phone },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{t.contactLabel}</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={t.contactPlaceholder[channel]}
                inputMode={channel === "telegram" ? "text" : "tel"}
                autoComplete={channel === "telegram" ? "off" : "tel"}
                maxLength={120}
                disabled={busy}
                className={INPUT}
              />
              {channel === "telegram" && <span className="mt-1.5 block text-[11px] leading-snug text-zinc-600">{t.contactHint}</span>}
            </label>
            <label className="block min-w-0">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{t.whenLabel}</span>
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                disabled={busy}
                className={INPUT}
              />
              <span className="mt-1.5 block text-[11px] leading-snug text-zinc-600">{t.whenHint}</span>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{t.noteLabel}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePlaceholder}
              rows={2}
              maxLength={1500}
              disabled={busy}
              className={`${INPUT} resize-none`}
            />
          </label>

          {error && (
            <p role="alert" className="flex items-start gap-2 text-[12px] text-rose-300">
              <X aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(90deg,#fcd34d_0%,#fde68a_45%,#fef3c7_55%,#fcd34d_100%)] px-5 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-zinc-950 shadow-[0_12px_34px_-12px_rgba(253,230,138,0.75)] transition-all duration-300 hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-100/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <ConciergeBell aria-hidden className="h-4 w-4" strokeWidth={1.6} />}
            {busy ? t.submitting : t.submit}
          </button>
        </div>

        <DirectLinks t={t} fullName={fullName} />
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КАРТОЧКА УРОВНЯ 3
 * ══════════════════════════════════════════════════════════════════ */

export function KycConciergeLevel({
  state,
  lang,
  isAdmin,
  onConfirm,
  onRevoke,
  fullName = null,
  avatarUrl = null,
}: {
  state: ConciergeLevelState;
  lang: Lang;
  isAdmin: boolean;
  onConfirm: () => void;
  onRevoke: () => void;
  fullName?: string | null;
  avatarUrl?: string | null;
}) {
  const t = CONCIERGE_DICT[lang] ?? CONCIERGE_DICT.EN;
  const [existing, setExisting] = useState<OpenRequest | null>(null);

  const done = state === "completed";
  const locked = state === "locked";

  const loadExisting = useCallback(async () => {
    try {
      const res = await listMyConciergeRequests();
      if (!res.ok) return;
      const mine = res.requests.find(
        (r) =>
          String(r.title ?? "").startsWith(KYC3_REQUEST_PREFIX) && (r.status === "open" || r.status === "in_progress"),
      );
      setExisting(
        mine ? { id: String(mine.id), createdAt: String(mine.created_at), status: mine.status as OpenRequest["status"] } : null,
      );
    } catch {
      /* нет доступа к заявкам — просто показываем форму */
    }
  }, []);

  useEffect(() => {
    if (state === "pending") void loadExisting();
  }, [state, loadExisting]);

  const chip = done ? "completed" : locked ? "locked" : existing ? "review" : "pending";

  return (
    <article
      aria-labelledby="kyc3-title"
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-md ${
        locked
          ? "border-amber-200/10 bg-zinc-900/30"
          : "border-amber-200/30 bg-gradient-to-br from-amber-200/[0.08] via-zinc-950/95 to-zinc-950 shadow-[0_30px_80px_-40px_rgba(253,230,138,0.35)]"
      }`}
    >
      {/* декор: золотая линия, свечение, водяной знак */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-amber-200/[0.07] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 opacity-[0.06]">
        <VipSeal className="h-48 w-48 sm:h-56 sm:w-56" glow={false} />
      </div>

      <div className="relative flex flex-col gap-5 p-4 sm:gap-6 sm:p-6">
        {/* ── шапка ── */}
        <div className="flex items-start gap-3 sm:gap-4">
          <span
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:h-12 sm:w-12 ${
              locked ? "border-zinc-700/50 bg-zinc-900/60" : "border-amber-200/45 bg-amber-200/[0.08]"
            }`}
          >
            <VipSeal className={`h-6 w-6 sm:h-7 sm:w-7 ${locked ? "opacity-50" : ""}`} glow={!locked} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">{t.level}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">·</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.eyebrow}</span>
              <StatusChip kind={chip} t={t} />
            </div>
            <h3
              id="kyc3-title"
              className={`${cormorant.className} mt-2 text-[24px] font-medium leading-tight sm:text-[28px] ${
                locked ? "text-zinc-300" : "text-zinc-50"
              }`}
            >
              {t.title}
            </h3>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-zinc-400">{t.lead}</p>
          </div>

          {isAdmin && (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {state === "pending" && (
                <button
                  type="button"
                  onClick={onConfirm}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-amber-200/40 bg-amber-200/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100 transition-all hover:border-amber-200/70 hover:bg-amber-200/15"
                >
                  <Check aria-hidden className="h-3.5 w-3.5" />
                  {t.confirm}
                </button>
              )}
              {done && (
                <button
                  type="button"
                  onClick={onRevoke}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:text-amber-200/80"
                >
                  <X aria-hidden className="h-3 w-3" />
                  {t.revoke}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── пройдено: торжественный блок ── */}
        {done && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-200/35 bg-[radial-gradient(ellipse_at_top,rgba(253,230,138,0.14),transparent_70%)] px-4 py-6 text-center sm:py-7">
            <VipSeal className="h-14 w-14 sm:h-16 sm:w-16" title={t.doneTitle} />
            <h4 className={`${cormorant.className} text-[24px] leading-tight text-amber-50 sm:text-[28px]`}>{t.doneTitle}</h4>
            <p className="max-w-lg text-[13px] leading-relaxed text-zinc-300">{t.doneText}</p>
            <VipBadge lang={lang} />
          </div>
        )}

        {/* ── зачем ── */}
        <section aria-labelledby="kyc3-why" className="space-y-3">
          {!done && (
            <div>
              <h4 id="kyc3-why" className={`${cormorant.className} text-[21px] leading-tight text-zinc-100 sm:text-[23px]`}>
                {t.whyTitle}
              </h4>
              <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-zinc-400">{t.whyLead}</p>
            </div>
          )}
          <ul className="grid gap-2.5 lg:grid-cols-3">
            {t.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i] ?? Sparkles;
              return (
                <li
                  key={b.kicker}
                  className="relative flex gap-3.5 overflow-hidden rounded-xl border border-amber-200/[0.12] bg-zinc-950/60 p-4 lg:flex-col lg:gap-3"
                >
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200/25 bg-gradient-to-br from-amber-200/[0.14] to-transparent text-amber-200"
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.4} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-amber-200/70">{b.kicker}</p>
                      {done && (
                        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] text-amber-100/90">
                          <Check aria-hidden className="h-3 w-3" />
                          {t.doneUnlocked}
                        </span>
                      )}
                    </div>
                    <h5 className="mt-1 text-[14px] font-medium leading-snug text-zinc-100">{b.title}</h5>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">{b.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="mr-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t.alsoTitle}</span>
            {t.also.map((label, i) => {
              const Icon = ALSO_ICONS[i] ?? Sparkles;
              return (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/15 bg-amber-200/[0.04] px-2.5 py-1 text-[11px] text-amber-50/85"
                >
                  <Icon aria-hidden className="h-3 w-3 text-amber-200/80" strokeWidth={1.6} />
                  {label}
                </span>
              );
            })}
          </div>
        </section>

        {/* ── как проходит ── */}
        {!done && (
          <section aria-label={t.howTitle}>
            <Eyebrow>{t.howTitle}</Eyebrow>
            <ol className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {t.steps.map((s, i) => {
                const Icon = STEP_ICONS[i] ?? Sparkles;
                return (
                  <li key={s.title} className="relative rounded-xl border border-white/[0.06] bg-zinc-950/50 p-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`${cormorant.className} text-[22px] leading-none text-amber-200/80`}>
                        {["I", "II", "III"][i]}
                      </span>
                      <Icon aria-hidden className="h-4 w-4 text-zinc-500" strokeWidth={1.5} />
                    </div>
                    <p className="mt-2 text-[13px] font-medium text-zinc-100">{s.title}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{s.text}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* ── превью знака ── */}
        <BadgePreview t={t} lang={lang} fullName={fullName} avatarUrl={avatarUrl} done={done} />

        {/* ── запись ── */}
        {state === "pending" && (
          <BookingPanel t={t} lang={lang} fullName={fullName} existing={existing} onRequested={setExisting} />
        )}
        {locked && (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-700/60 bg-zinc-950/40 px-4 py-3.5">
            <Lock aria-hidden className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.5} />
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-zinc-500">{t.lockedNote}</p>
          </div>
        )}
      </div>
    </article>
  );
}
