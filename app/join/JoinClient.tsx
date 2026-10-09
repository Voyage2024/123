"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · /join — гостья открывает ключ-приглашение
 * app/join/JoinClient.tsx
 *
 * Путь гостьи:
 *   1. /join?key=VYG-XXXX-XXXX → club_invite_preview: «Анна К. (Inner Circle)
 *      приглашает вас в закрытый клуб Voyage», имя на приглашении, срок.
 *   2. «Принять приглашение» → вход или регистрация прямо здесь, ключ
 *      остаётся на странице (и в localStorage — на случай подтверждения почты).
 *   3. Как только появляется сессия → club_redeem_invite(key, имя):
 *      ключ открыт, анкета ушла комитету (status = pending).
 *      Если Supabase просит подтвердить почту, ссылка из письма вернёт
 *      гостью сюда же, и ключ активируется сам.
 *   Ошибки: нет ключа, не найден, истёк, уже открыт, «вы уже в клубе»,
 *   «это ваш ключ» и т. д. — у каждой свой экран.
 *
 * Сервер — миграции 20261009_club_invites.sql и 20261010_join_and_admin_access.sql.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Hourglass,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/app/context/LanguageContext";
import { LANGS, normalizeCircleKey, normalizeLang, type CircleKey, type Lang } from "@/lib/gamification";
import { KEY_TTL_DAYS, inviteErrorCode, normalizeInviteCode, type InvitePreviewRow } from "@/lib/patronage";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/* ══════════════════════════════════════════════════════════════════
 * СЛОВАРЬ
 * ══════════════════════════════════════════════════════════════════ */

type InvalidReason = "missing" | "not_found" | "expired" | "used" | "network";
type RedeemError = "already_member" | "already_linked" | "self_invite" | "profile_missing" | "generic";
type AuthError =
  | "invalidCredentials"
  | "userExists"
  | "weakPassword"
  | "rateLimit"
  | "invalidEmail"
  | "notConfirmed"
  | "signupDisabled"
  | "generic";

const en = {
  tagline: "Private Club",
  language: "Language",
  eyebrow: "Sur invitation",
  checking: "Checking your key…",
  invitesYou: "invites you to the private club Voyage",
  aResident: "A resident of Voyage",
  personalFor: "Personal invitation for",
  personalKey: "Personal key",
  validUntil: (d: string) => `Valid until ${d}`,
  accept: "Accept the invitation",
  acceptNote: "The key opens once — and only for you.",
  signedInAs: (e: string) => `Signed in as ${e}`,
  signOut: "Sign out",
  stepsTitle: "What happens next",
  steps: [
    ["Your private access", "Create an account with your email — your key opens it."],
    ["The committee", "Your application goes to the club committee, your sponsor's name beside yours."],
    ["Welcome aboard", "Once approved, your Voyage passport and first tours are open to you."],
  ] as Array<[string, string]>,
  // вход и регистрация
  titleSignUp: "Create your access",
  titleSignIn: "Welcome back",
  inviteFrom: (p: string) => `Sponsored by ${p}`,
  tabSignUp: "New here",
  tabSignIn: "I have an account",
  fullName: "Full name",
  email: "Email",
  password: "Password",
  passwordHint: "At least 8 characters",
  showPassword: "Show password",
  hidePassword: "Hide password",
  submitSignUp: "Create access & accept",
  submitSignIn: "Sign in & accept",
  submitSignInOnly: "Sign in",
  back: "Back to the invitation",
  errName: "Please enter your full name.",
  errEmail: "Please check the email address.",
  errPassword: "At least 8 characters, please.",
  authError: {
    invalidCredentials: "Email or password is incorrect.",
    userExists: "This email is already registered — please sign in instead.",
    weakPassword: "Please choose a stronger password.",
    rateLimit: "Too many attempts. Please wait a minute and try again.",
    invalidEmail: "This email address doesn't look right.",
    notConfirmed: "Please confirm your email first — the link is in your inbox.",
    signupDisabled: "New registrations are paused. Please write to the concierge.",
    generic: "Something went wrong. Please try again.",
  } as Record<AuthError, string>,
  // подтверждение почты
  confirmTitle: "Check your inbox",
  confirmBody: (e: string) =>
    `We've sent a confirmation link to ${e}. Open it on this device — you'll return here and your key will activate itself.`,
  resend: "Send the link again",
  resent: "Sent — please check your inbox",
  resendIn: (s: number) => `Send again in ${s}s`,
  changeEmail: "Use another email",
  // активация
  redeeming: "Breaking the seal…",
  doneTitle: "Your key is accepted",
  doneBody: (p: string) =>
    `Your application is now with the club committee. ${p} vouched for you — we'll be in touch soon.`,
  doneBodyAnon: "Your application is now with the club committee — we'll be in touch soon.",
  statusPending: "Application under review",
  toDashboard: "Go to my Voyage",
  approvedTitle: "Welcome to Voyage",
  approvedBody: "Your application has been approved. The club is open to you.",
  declinedTitle: "The committee has decided",
  declinedBody: "This time the club could not extend membership. Thank you for your interest in Voyage.",
  // ключ недействителен
  invalid: {
    missing: [
      "An invitation is needed",
      "Voyage is entered by invitation only. Open the personal link you received — or enter your key below.",
    ],
    not_found: ["This key is unknown", "Check the link, or type the key exactly as it was sent to you."],
    expired: [
      "This key has expired",
      `Keys are valid for ${KEY_TTL_DAYS} days. Ask your sponsor for a new one — an unopened key returns to her.`,
    ],
    used: [
      "This key has already been opened",
      "Each key opens only once. If it was you, sign in to see your application.",
    ],
    network: ["The club is out of reach", "Please check your connection and try again."],
  } as Record<InvalidReason, [string, string]>,
  enterKey: "Your key",
  keyPlaceholder: "VYG-XXXX-XXXX",
  openKey: "Open",
  keyFormat: "A key looks like VYG-XXXX-XXXX.",
  retry: "Try again",
  home: "Return home",
  signIn: "Sign in",
  // ключ не открылся
  redeemError: {
    already_member: [
      "You're already a member",
      "This key is meant for a new guest. Your club is open in your dashboard.",
    ],
    already_linked: [
      "You already have a sponsor",
      "Your account is already linked to an invitation — one sponsorship per guest.",
    ],
    self_invite: ["This is your own key", "Send it to your guest — a sponsor can't open her own key."],
    profile_missing: [
      "Your account is almost ready",
      "Please try again in a moment. If it persists, write to the concierge.",
    ],
    generic: ["The seal didn't break", "Something went wrong. Please try again."],
  } as Record<RedeemError, [string, string]>,
  useAnother: "Sign out and use another account",
  myKeys: "Back to my keys",
  footer: "Membership in Voyage is never sold — only handed on.",
};

type Dict = typeof en;

const ru: Dict = {
  tagline: "Закрытый клуб",
  language: "Язык",
  eyebrow: "Sur invitation",
  checking: "Проверяем ключ…",
  invitesYou: "приглашает вас в закрытый клуб Voyage",
  aResident: "Резидентка Voyage",
  personalFor: "Именное приглашение для",
  personalKey: "Персональный ключ",
  validUntil: (d) => `Действует до ${d}`,
  accept: "Принять приглашение",
  acceptNote: "Ключ открывается один раз — и только для вас.",
  signedInAs: (e) => `Вы вошли как ${e}`,
  signOut: "Выйти",
  stepsTitle: "Что дальше",
  steps: [
    ["Личный доступ", "Создайте аккаунт по почте — ваш ключ откроет его."],
    ["Комитет клуба", "Анкета уходит комитету, и рядом с вашим именем стоит имя поручительницы."],
    ["Добро пожаловать", "После одобрения вам откроются паспорт Voyage и первые туры."],
  ],
  titleSignUp: "Создайте личный доступ",
  titleSignIn: "С возвращением",
  inviteFrom: (p) => `Поручитель — ${p}`,
  tabSignUp: "Я впервые",
  tabSignIn: "Есть аккаунт",
  fullName: "Имя и фамилия",
  email: "Почта",
  password: "Пароль",
  passwordHint: "Не короче 8 символов",
  showPassword: "Показать пароль",
  hidePassword: "Скрыть пароль",
  submitSignUp: "Создать доступ и принять",
  submitSignIn: "Войти и принять",
  submitSignInOnly: "Войти",
  back: "Назад к приглашению",
  errName: "Укажите имя и фамилию.",
  errEmail: "Проверьте адрес почты.",
  errPassword: "Пароль — не короче 8 символов.",
  authError: {
    invalidCredentials: "Неверная почта или пароль.",
    userExists: "Эта почта уже зарегистрирована — войдите в аккаунт.",
    weakPassword: "Выберите пароль понадёжнее.",
    rateLimit: "Слишком много попыток. Подождите минуту и попробуйте снова.",
    invalidEmail: "Адрес почты выглядит неверно.",
    notConfirmed: "Сначала подтвердите почту — ссылка во входящих.",
    signupDisabled: "Регистрация сейчас закрыта. Напишите консьержу.",
    generic: "Что-то пошло не так. Попробуйте ещё раз.",
  },
  confirmTitle: "Проверьте почту",
  confirmBody: (e) =>
    `Мы отправили ссылку для подтверждения на ${e}. Откройте её на этом устройстве — вы вернётесь сюда, и ключ активируется сам.`,
  resend: "Отправить ссылку ещё раз",
  resent: "Отправили — проверьте входящие",
  resendIn: (s) => `Повторить через ${s} с`,
  changeEmail: "Указать другую почту",
  redeeming: "Ломаем печать…",
  doneTitle: "Ключ принят",
  doneBody: (p) => `Ваша анкета у комитета клуба. За вас поручилась ${p} — мы скоро свяжемся с вами.`,
  doneBodyAnon: "Ваша анкета у комитета клуба — мы скоро свяжемся с вами.",
  statusPending: "Анкета на рассмотрении",
  toDashboard: "Перейти в Voyage",
  approvedTitle: "Добро пожаловать в Voyage",
  approvedBody: "Ваша анкета одобрена. Клуб открыт для вас.",
  declinedTitle: "Комитет принял решение",
  declinedBody: "В этот раз клуб не смог предложить вам членство. Спасибо за интерес к Voyage.",
  invalid: {
    missing: [
      "Нужно приглашение",
      "В Voyage входят только по приглашению. Откройте личную ссылку, которую вам прислали, — или введите ключ ниже.",
    ],
    not_found: ["Такого ключа нет", "Проверьте ссылку или введите ключ ровно так, как его прислали."],
    expired: [
      "Срок ключа истёк",
      `Ключ действует ${KEY_TTL_DAYS} дней. Попросите у поручительницы новый — неоткрытый ключ уже вернулся к ней.`,
    ],
    used: [
      "Этот ключ уже открыт",
      "Каждый ключ открывается один раз. Если это были вы — войдите, чтобы увидеть свою анкету.",
    ],
    network: ["Клуб сейчас недоступен", "Проверьте подключение и попробуйте ещё раз."],
  },
  enterKey: "Ваш ключ",
  keyPlaceholder: "VYG-XXXX-XXXX",
  openKey: "Открыть",
  keyFormat: "Ключ выглядит так: VYG-XXXX-XXXX.",
  retry: "Попробовать снова",
  home: "На главную",
  signIn: "Войти",
  redeemError: {
    already_member: ["Вы уже в клубе", "Этот ключ — для новой гостьи. Ваш клуб открыт в личном кабинете."],
    already_linked: [
      "У вас уже есть поручительница",
      "Ваш аккаунт уже связан с приглашением — у гостьи одно поручительство.",
    ],
    self_invite: ["Это ваш собственный ключ", "Отправьте его гостье — поручительница не может открыть свой ключ."],
    profile_missing: [
      "Аккаунт почти готов",
      "Попробуйте ещё раз через минуту. Если не получится — напишите консьержу.",
    ],
    generic: ["Печать не поддалась", "Что-то пошло не так. Попробуйте ещё раз."],
  },
  useAnother: "Выйти и войти другим аккаунтом",
  myKeys: "К моим ключам",
  footer: "Членство в Voyage не продаётся — его передают из рук в руки.",
};

const es: Dict = {
  tagline: "Club Privado",
  language: "Idioma",
  eyebrow: "Sur invitation",
  checking: "Comprobando su llave…",
  invitesYou: "le invita al club privado Voyage",
  aResident: "Una residente de Voyage",
  personalFor: "Invitación personal para",
  personalKey: "Llave personal",
  validUntil: (d) => `Válida hasta el ${d}`,
  accept: "Aceptar la invitación",
  acceptNote: "La llave se abre una sola vez, y solo para usted.",
  signedInAs: (e) => `Sesión iniciada como ${e}`,
  signOut: "Cerrar sesión",
  stepsTitle: "Qué sigue",
  steps: [
    ["Su acceso privado", "Cree una cuenta con su correo: su llave la abre."],
    ["El comité", "Su solicitud pasa al comité del club, con el nombre de su madrina junto al suyo."],
    ["Bienvenida", "Una vez aprobada, se abren su pasaporte Voyage y sus primeras giras."],
  ],
  titleSignUp: "Cree su acceso",
  titleSignIn: "Bienvenida de nuevo",
  inviteFrom: (p) => `Madrina: ${p}`,
  tabSignUp: "Soy nueva",
  tabSignIn: "Ya tengo cuenta",
  fullName: "Nombre y apellido",
  email: "Correo",
  password: "Contraseña",
  passwordHint: "Al menos 8 caracteres",
  showPassword: "Mostrar contraseña",
  hidePassword: "Ocultar contraseña",
  submitSignUp: "Crear acceso y aceptar",
  submitSignIn: "Entrar y aceptar",
  submitSignInOnly: "Entrar",
  back: "Volver a la invitación",
  errName: "Indique su nombre y apellido.",
  errEmail: "Revise la dirección de correo.",
  errPassword: "Al menos 8 caracteres, por favor.",
  authError: {
    invalidCredentials: "Correo o contraseña incorrectos.",
    userExists: "Este correo ya está registrado: inicie sesión.",
    weakPassword: "Elija una contraseña más segura.",
    rateLimit: "Demasiados intentos. Espere un minuto e inténtelo de nuevo.",
    invalidEmail: "La dirección de correo no parece correcta.",
    notConfirmed: "Primero confirme su correo: el enlace está en su bandeja de entrada.",
    signupDisabled: "Los registros están pausados. Escriba al conserje.",
    generic: "Algo salió mal. Inténtelo de nuevo.",
  },
  confirmTitle: "Revise su correo",
  confirmBody: (e) =>
    `Enviamos un enlace de confirmación a ${e}. Ábralo en este dispositivo: volverá aquí y su llave se activará sola.`,
  resend: "Enviar el enlace de nuevo",
  resent: "Enviado: revise su bandeja de entrada",
  resendIn: (s) => `Reenviar en ${s} s`,
  changeEmail: "Usar otro correo",
  redeeming: "Rompiendo el sello…",
  doneTitle: "Su llave fue aceptada",
  doneBody: (p) => `Su solicitud está ahora con el comité del club. ${p} respondió por usted; pronto le escribiremos.`,
  doneBodyAnon: "Su solicitud está ahora con el comité del club; pronto le escribiremos.",
  statusPending: "Solicitud en revisión",
  toDashboard: "Ir a mi Voyage",
  approvedTitle: "Bienvenida a Voyage",
  approvedBody: "Su solicitud fue aprobada. El club está abierto para usted.",
  declinedTitle: "El comité ha decidido",
  declinedBody: "Esta vez el club no pudo ofrecerle la membresía. Gracias por su interés en Voyage.",
  invalid: {
    missing: [
      "Se necesita una invitación",
      "A Voyage solo se entra por invitación. Abra el enlace personal que recibió, o escriba su llave abajo.",
    ],
    not_found: ["Esta llave no existe", "Revise el enlace o escriba la llave tal como se la enviaron."],
    expired: [
      "Esta llave ha caducado",
      `Las llaves valen ${KEY_TTL_DAYS} días. Pida una nueva a su madrina: la llave sin abrir ya volvió a ella.`,
    ],
    used: [
      "Esta llave ya fue abierta",
      "Cada llave se abre una sola vez. Si fue usted, inicie sesión para ver su solicitud.",
    ],
    network: ["El club no responde", "Revise su conexión e inténtelo de nuevo."],
  },
  enterKey: "Su llave",
  keyPlaceholder: "VYG-XXXX-XXXX",
  openKey: "Abrir",
  keyFormat: "Una llave tiene esta forma: VYG-XXXX-XXXX.",
  retry: "Reintentar",
  home: "Volver al inicio",
  signIn: "Iniciar sesión",
  redeemError: {
    already_member: ["Usted ya es miembro", "Esta llave es para una invitada nueva. Su club está abierto en su panel."],
    already_linked: [
      "Usted ya tiene madrina",
      "Su cuenta ya está vinculada a una invitación: un madrinazgo por invitada.",
    ],
    self_invite: ["Es su propia llave", "Envíela a su invitada: una madrina no puede abrir su propia llave."],
    profile_missing: [
      "Su cuenta está casi lista",
      "Inténtelo de nuevo en un momento. Si persiste, escriba al conserje.",
    ],
    generic: ["El sello no cedió", "Algo salió mal. Inténtelo de nuevo."],
  },
  useAnother: "Cerrar sesión y usar otra cuenta",
  myKeys: "Volver a mis llaves",
  footer: "La membresía de Voyage no se vende: solo pasa de mano en mano.",
};

const pt: Dict = {
  tagline: "Clube Privado",
  language: "Idioma",
  eyebrow: "Sur invitation",
  checking: "Verificando sua chave…",
  invitesYou: "convida você para o clube privado Voyage",
  aResident: "Uma residente do Voyage",
  personalFor: "Convite pessoal para",
  personalKey: "Chave pessoal",
  validUntil: (d) => `Válida até ${d}`,
  accept: "Aceitar o convite",
  acceptNote: "A chave abre uma única vez — e só para você.",
  signedInAs: (e) => `Conectada como ${e}`,
  signOut: "Sair",
  stepsTitle: "O que vem a seguir",
  steps: [
    ["Seu acesso privado", "Crie uma conta com seu e-mail — sua chave abre essa conta."],
    ["O comitê", "Sua candidatura vai para o comitê do clube, com o nome da madrinha ao lado do seu."],
    ["Boas-vindas", "Depois da aprovação, seu passaporte Voyage e as primeiras turnês se abrem para você."],
  ],
  titleSignUp: "Crie seu acesso",
  titleSignIn: "Bem-vinda de volta",
  inviteFrom: (p) => `Madrinha: ${p}`,
  tabSignUp: "Sou nova",
  tabSignIn: "Já tenho conta",
  fullName: "Nome e sobrenome",
  email: "E-mail",
  password: "Senha",
  passwordHint: "Pelo menos 8 caracteres",
  showPassword: "Mostrar senha",
  hidePassword: "Ocultar senha",
  submitSignUp: "Criar acesso e aceitar",
  submitSignIn: "Entrar e aceitar",
  submitSignInOnly: "Entrar",
  back: "Voltar ao convite",
  errName: "Informe seu nome e sobrenome.",
  errEmail: "Verifique o endereço de e-mail.",
  errPassword: "Pelo menos 8 caracteres, por favor.",
  authError: {
    invalidCredentials: "E-mail ou senha incorretos.",
    userExists: "Este e-mail já está cadastrado — entre na sua conta.",
    weakPassword: "Escolha uma senha mais forte.",
    rateLimit: "Muitas tentativas. Aguarde um minuto e tente de novo.",
    invalidEmail: "Este e-mail não parece correto.",
    notConfirmed: "Confirme seu e-mail primeiro — o link está na sua caixa de entrada.",
    signupDisabled: "Os cadastros estão pausados. Escreva para o concierge.",
    generic: "Algo deu errado. Tente novamente.",
  },
  confirmTitle: "Confira seu e-mail",
  confirmBody: (e) =>
    `Enviamos um link de confirmação para ${e}. Abra-o neste dispositivo — você volta para cá e a chave se ativa sozinha.`,
  resend: "Enviar o link de novo",
  resent: "Enviado — confira sua caixa de entrada",
  resendIn: (s) => `Reenviar em ${s} s`,
  changeEmail: "Usar outro e-mail",
  redeeming: "Rompendo o selo…",
  doneTitle: "Sua chave foi aceita",
  doneBody: (p) =>
    `Sua candidatura está com o comitê do clube. ${p} garantiu por você — entraremos em contato em breve.`,
  doneBodyAnon: "Sua candidatura está com o comitê do clube — entraremos em contato em breve.",
  statusPending: "Candidatura em análise",
  toDashboard: "Ir para o meu Voyage",
  approvedTitle: "Boas-vindas ao Voyage",
  approvedBody: "Sua candidatura foi aprovada. O clube está aberto para você.",
  declinedTitle: "O comitê decidiu",
  declinedBody: "Desta vez o clube não pôde oferecer a filiação. Obrigado pelo seu interesse no Voyage.",
  invalid: {
    missing: [
      "É preciso um convite",
      "No Voyage só se entra por convite. Abra o link pessoal que você recebeu — ou digite sua chave abaixo.",
    ],
    not_found: ["Esta chave não existe", "Confira o link ou digite a chave exatamente como foi enviada."],
    expired: [
      "Esta chave expirou",
      `As chaves valem ${KEY_TTL_DAYS} dias. Peça uma nova à sua madrinha — a chave não aberta já voltou para ela.`,
    ],
    used: ["Esta chave já foi aberta", "Cada chave abre uma única vez. Se foi você, entre para ver sua candidatura."],
    network: ["O clube está fora de alcance", "Verifique sua conexão e tente de novo."],
  },
  enterKey: "Sua chave",
  keyPlaceholder: "VYG-XXXX-XXXX",
  openKey: "Abrir",
  keyFormat: "Uma chave tem este formato: VYG-XXXX-XXXX.",
  retry: "Tentar de novo",
  home: "Voltar ao início",
  signIn: "Entrar",
  redeemError: {
    already_member: ["Você já é membro", "Esta chave é para uma nova convidada. Seu clube está aberto no seu painel."],
    already_linked: [
      "Você já tem madrinha",
      "Sua conta já está ligada a um convite — um apadrinhamento por convidada.",
    ],
    self_invite: [
      "Esta é a sua própria chave",
      "Envie-a para sua convidada — a madrinha não pode abrir a própria chave.",
    ],
    profile_missing: [
      "Sua conta está quase pronta",
      "Tente de novo em instantes. Se continuar, escreva para o concierge.",
    ],
    generic: ["O selo não cedeu", "Algo deu errado. Tente novamente."],
  },
  useAnother: "Sair e usar outra conta",
  myKeys: "Voltar às minhas chaves",
  footer: "A filiação ao Voyage não se vende — só passa de mão em mão.",
};

const T: Record<Lang, Dict> = { en, ru, es, pt };
const LOCALES: Record<Lang, string> = { en: "en-GB", ru: "ru-RU", es: "es-ES", pt: "pt-BR" };

/* ══════════════════════════════════════════════════════════════════
 * УТИЛИТЫ
 * ══════════════════════════════════════════════════════════════════ */

const PENDING_KEY = "voyage:join";
const PENDING_TTL_MS = 7 * 86_400_000;
const SEAL_MS = 1100; // минимальная длительность «ломаем печать»
const RESEND_COOLDOWN_S = 45;

type Pending = { code: string; name: string | null; at: number };

/** Ключ, который гостья начала принимать, — переживёт подтверждение почты */
function savePending(code: string, name: string | null) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ code, name, at: Date.now() } satisfies Pending));
  } catch {
    /* приватный режим — ключ всё равно в ссылке из письма */
  }
}

function readPending(): Pending | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (!p?.code || Date.now() - p.at > PENDING_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ничего */
  }
}

function fmtDate(lang: Lang, iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(d)
    .replace(/\s?г\.$/, "");
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Ошибка Supabase Auth → наш код */
function authErrorCode(error: unknown): AuthError {
  const e = (error ?? {}) as { message?: string; code?: string; status?: number };
  const code = e.code ?? "";
  const msg = (e.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return "invalidCredentials";
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered"))
    return "userExists";
  if (code === "weak_password" || msg.includes("password should")) return "weakPassword";
  if (code.startsWith("over_") || e.status === 429 || msg.includes("rate limit")) return "rateLimit";
  if (code === "email_address_invalid" || code === "validation_failed" || /invalid.*email|email.*invalid/.test(msg)) {
    return "invalidEmail";
  }
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "notConfirmed";
  if (code === "signup_disabled" || msg.includes("signups not allowed")) return "signupDisabled";
  return "generic";
}

/* ══════════════════════════════════════════════════════════════════
 * ХУКИ
 * ══════════════════════════════════════════════════════════════════ */

type LangCtx = { lang?: unknown; language?: unknown; setLang?: (l: string) => void; setLanguage?: (l: string) => void };

/** Язык из контекста приложения; если провайдера на этой странице нет — свой выбор */
function useJoinLang() {
  let ctx: LangCtx | null = null;
  try {
    ctx = useLanguage() as unknown as LangCtx;
  } catch {
    ctx = null; // провайдер языка подключён только внутри дашборда
  }
  const [override, setOverride] = useState<Lang | null>(null);
  const raw = ctx?.lang ?? ctx?.language;
  const lang: Lang = override ?? normalizeLang(raw);
  const upper = typeof raw === "string" && raw.length > 0 && raw === raw.toUpperCase();
  const set = (l: Lang) => {
    setOverride(l);
    const setter = ctx?.setLang ?? ctx?.setLanguage;
    if (setter) setter(upper ? l.toUpperCase() : l);
  };
  return { lang, setLang: set };
}

type SessionLite = { userId: string; email: string | null } | null;

/** undefined — сессия ещё неизвестна, null — гостья не вошла */
function useSessionLite() {
  const [session, setSession] = useState<SessionLite | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const lite = (s: { user?: { id: string; email?: string | null } } | null): SessionLite =>
      s?.user ? { userId: s.user.id, email: s.user.email ?? null } : null;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setSession(lite(data.session));
      })
      .catch(() => {
        if (alive) setSession(null);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (alive) setSession(lite(s));
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return session;
}

const reducedQuery = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(reducedQuery);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ОФОРМЛЕНИЕ
 * ══════════════════════════════════════════════════════════════════ */

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)";

const JOIN_CSS = `
@keyframes vj-enter { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes vj-ring { 0% { transform: scale(.75); opacity: .6 } 100% { transform: scale(2.1); opacity: 0 } }
@keyframes vj-breathe { 0%, 100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes vj-press { 0% { transform: scale(1.35) rotate(-18deg); opacity: 0 } 60% { transform: scale(.96) rotate(-6deg); opacity: 1 } 100% { transform: scale(1) rotate(-8deg); opacity: 1 } }
.vj-enter { animation: vj-enter 600ms ${EASE} both }
.vj-enter-2 { animation: vj-enter 600ms ${EASE} 120ms both }
.vj-enter-3 { animation: vj-enter 600ms ${EASE} 240ms both }
.vj-ring { animation: vj-ring 1600ms ${EASE} infinite }
.vj-breathe { animation: vj-breathe 1.8s ease-in-out infinite }
.vj-press { animation: vj-press 700ms cubic-bezier(.3,1.4,.5,1) both }
@media (prefers-reduced-motion: reduce) {
  .vj-enter, .vj-enter-2, .vj-enter-3, .vj-ring, .vj-breathe, .vj-press { animation: none !important }
}
/* очень узкие экраны: остаётся монограмма V и переключатель языка */
@media (max-width: 359px) { .vj-wordmark { display: none !important } }
/* шаги: на телефоне — список, на широком экране — три колонки */
.vj-steps { display: grid; gap: .75rem; grid-template-columns: minmax(0, 1fr) }
.vj-step { display: flex; gap: 1rem; align-items: baseline }
@media (min-width: 600px) {
  .vj-steps { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .vj-step { display: block }
}
`;

const CIRCLE_BADGE: Record<CircleKey, string> = {
  voyager: "border-zinc-700/80 text-zinc-400",
  resident: "border-zinc-600/70 text-zinc-200",
  preferred: "border-amber-200/25 text-amber-200/80",
  inner: "border-amber-200/40 bg-amber-200/[0.06] text-amber-200",
  private: "border-slate-200/35 bg-slate-200/[0.05] text-slate-100",
  black: "border-amber-100/50 bg-black text-amber-100",
};

const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40";
const BTN_PRIMARY = `inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-amber-200 px-6 text-[15px] font-medium text-zinc-950 transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-70 ${FOCUS} focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950`;
const BTN_GHOST = `inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 ${FOCUS}`;
const LINK_QUIET = `inline-flex items-center gap-1.5 rounded-md text-sm text-zinc-500 transition-colors hover:text-amber-100 ${FOCUS}`;

/** Золотая печать Voyage */
function Seal({ size = 64, press = false, mark }: { size?: number; press?: boolean; mark?: ReactNode }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full ${press ? "vj-press" : ""}`}
      style={{
        width: size,
        height: size,
        transform: press ? undefined : "rotate(-8deg)",
        background:
          "radial-gradient(circle at 34% 28%, #fef3c7 0%, #fde68a 18%, #d9b46a 46%, #a07c3a 74%, #6d5226 100%)",
        boxShadow:
          "0 8px 22px rgba(0,0,0,.55), inset 0 -3px 6px rgba(60,40,10,.45), inset 0 2px 3px rgba(255,248,220,.55)",
      }}
      aria-hidden
    >
      <span className="absolute inset-[5px] rounded-full border border-[#6d5226]/40" />
      {mark ?? (
        <span
          className={`${cormorant.className} relative font-semibold italic leading-none`}
          style={{ color: "#4a3816", textShadow: "0 1px 0 rgba(255,240,200,.45)", fontSize: size * 0.48 }}
        >
          V
        </span>
      )}
    </span>
  );
}

function Medallion({ icon: Icon, tone = "amber" }: { icon: LucideIcon; tone?: "amber" | "muted" | "red" }) {
  const cls =
    tone === "amber"
      ? "border-amber-200/35 text-amber-200"
      : tone === "red"
        ? "border-red-300/25 text-red-200/80"
        : "border-zinc-700 text-zinc-400";
  return (
    <span className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${cls}`}>
      <span className="absolute inset-[4px] rounded-full border border-current opacity-20" />
      <Icon size={24} strokeWidth={1.2} aria-hidden />
    </span>
  );
}

/** Двойная золотая рамка с ромбами в углах */
function Frame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const corners = [
    { left: 10, top: 10, transform: "translate(-50%, -50%) rotate(45deg)" },
    { right: 10, top: 10, transform: "translate(50%, -50%) rotate(45deg)" },
    { left: 10, bottom: 10, transform: "translate(-50%, 50%) rotate(45deg)" },
    { right: 10, bottom: 10, transform: "translate(50%, 50%) rotate(45deg)" },
  ];
  return (
    <div
      className={`relative rounded-2xl border border-amber-200/20 ${className}`}
      style={{ background: "linear-gradient(160deg, #19191c 0%, #111114 55%, #0b0b0d 100%)" }}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: NOISE }}
      />
      <span className="pointer-events-none absolute inset-[10px] rounded-xl border border-amber-200/25" />
      <span className="pointer-events-none absolute inset-[14px] rounded-[10px] border border-amber-200/10" />
      {corners.map((c, i) => (
        <span key={i} className="pointer-events-none absolute h-1.5 w-1.5 bg-amber-200/60" style={c} />
      ))}
      <div className="relative">{children}</div>
    </div>
  );
}

function Ornament() {
  return (
    <span className="flex items-center justify-center gap-2 text-amber-200/40" aria-hidden>
      <span className="h-px w-10 bg-current" />
      <span className="h-1 w-1 rotate-45 bg-current" />
      <span className="h-px w-10 bg-current" />
    </span>
  );
}

/** Экран-сообщение: медальон, заголовок, текст, действия */
function Notice({
  icon,
  tone,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  tone?: "amber" | "muted" | "red";
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="vj-enter text-center">
      <Medallion icon={icon} tone={tone} />
      <h1 className={`${cormorant.className} mt-6 text-3xl font-medium leading-tight text-zinc-50 sm:text-4xl`}>
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-zinc-400">{body}</p>
      {children && <div className="mx-auto mt-8 flex max-w-sm flex-col items-stretch gap-3">{children}</div>}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-red-300/90">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-zinc-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const INPUT =
  "h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 text-[15px] text-zinc-100 transition-colors placeholder:text-zinc-600 focus:border-amber-200/40 focus:outline-none focus:ring-1 focus:ring-amber-200/25 disabled:opacity-60";

/* ══════════════════════════════════════════════════════════════════
 * ЭКРАНЫ
 * ══════════════════════════════════════════════════════════════════ */

type View =
  | { kind: "checking" }
  | { kind: "invalid"; reason: InvalidReason }
  | { kind: "invite" }
  | { kind: "auth"; mode: "signup" | "signin"; intent: "accept" | "status" }
  | { kind: "confirm"; email: string }
  | { kind: "redeeming" }
  | { kind: "done" }
  | { kind: "yours"; status: string }
  | { kind: "redeemError"; error: RedeemError };

/** Приглашение: кто зовёт, для кого, ключ и срок */
function InvitationCard({ preview, code, t, lang }: { preview: InvitePreviewRow; code: string; t: Dict; lang: Lang }) {
  const circleKey = normalizeCircleKey(preview.patron_circle_key);
  const patron = preview.patron_display ?? preview.patron_first_name;
  return (
    <div className="relative pt-8">
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2">
        <Seal size={68} press />
      </div>
      <Frame className="px-6 pb-9 pt-14 text-center sm:px-10">
        <p className="pl-[0.55em] text-[10px] font-medium uppercase tracking-[0.55em] text-amber-200/70">Voyage</p>

        <h1
          className={`${cormorant.className} mt-5 text-[1.9rem] font-medium leading-[1.15] text-zinc-50 sm:text-[2.35rem]`}
        >
          {patron ? (
            <>
              <span className="text-amber-200">{patron}</span>
              {preview.patron_circle && (
                <span className="whitespace-nowrap">
                  {" "}
                  <span className="text-zinc-500">(</span>
                  <span
                    className={`mx-0.5 inline-block translate-y-[-0.2em] rounded-full border px-2.5 py-0.5 align-middle font-sans text-[10px] uppercase tracking-[0.2em] ${
                      circleKey ? CIRCLE_BADGE[circleKey] : CIRCLE_BADGE.voyager
                    }`}
                  >
                    {preview.patron_circle}
                  </span>
                  <span className="text-zinc-500">)</span>
                </span>
              )}{" "}
            </>
          ) : (
            <span className="text-amber-200">{t.aResident} </span>
          )}
          <span className="italic text-slate-200">{t.invitesYou}</span>
        </h1>

        <div className="mt-7">
          <Ornament />
        </div>

        {preview.guest_name && (
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.personalFor}</p>
            <p className={`${cormorant.className} mt-1.5 break-words text-2xl italic text-amber-100 sm:text-3xl`}>
              {preview.guest_name}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-1.5">
          <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">{t.personalKey}</p>
          <p className="rounded-md border border-amber-200/20 bg-black/30 px-3.5 py-1.5 font-mono text-sm tracking-[0.22em] text-slate-100">
            {code}
          </p>
          {preview.expires_at && (
            <p className="text-[11px] text-zinc-500">{t.validUntil(fmtDate(lang, preview.expires_at))}</p>
          )}
        </div>
      </Frame>
    </div>
  );
}

function Steps({ t }: { t: Dict }) {
  return (
    <section aria-labelledby="vj-steps" className="vj-enter-3">
      <p id="vj-steps" className="text-center text-[10px] uppercase tracking-[0.35em] text-zinc-600">
        {t.stepsTitle}
      </p>
      <ol className="vj-steps mt-5">
        {t.steps.map(([title, body], i) => (
          <li key={title} className="vj-step rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-4">
            <p className={`${cormorant.className} w-6 shrink-0 text-lg italic text-amber-200/60`}>
              {["I", "II", "III"][i]}
            </p>
            <div className="min-w-0">
              <p className="mt-1 text-sm text-zinc-200">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Ручной ввод ключа (нет ссылки / ключ не найден) */
function KeyEntry({ t, onOpen, initial }: { t: Dict; onOpen: (code: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState(false);
  return (
    <form
      className="text-left"
      onSubmit={(e) => {
        e.preventDefault();
        const code = normalizeInviteCode(value);
        if (!code) {
          setError(true);
          return;
        }
        onOpen(code);
      }}
    >
      <Field id="vj-key" label={t.enterKey} error={error ? t.keyFormat : null}>
        <div className="flex gap-2">
          <input
            id="vj-key"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder={t.keyPlaceholder}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={error}
            aria-describedby={error ? "vj-key-msg" : undefined}
            className={`${INPUT} min-w-0 flex-1 font-mono uppercase tracking-[0.18em]`}
          />
          <button type="submit" className={`${BTN_GHOST} h-12 shrink-0`}>
            <KeyRound size={15} strokeWidth={1.5} aria-hidden />
            {t.openKey}
          </button>
        </div>
      </Field>
    </form>
  );
}

/** Вход и регистрация — ключ остаётся на странице */
function AuthPanel({
  t,
  mode,
  intent,
  patron,
  code,
  guestName,
  onMode,
  onBack,
  onSubmit,
}: {
  t: Dict;
  mode: "signup" | "signin";
  intent: "accept" | "status";
  patron: string | null;
  code: string;
  guestName: string | null;
  onMode: (m: "signup" | "signin") => void;
  onBack: () => void;
  onSubmit: (f: {
    mode: "signup" | "signin";
    name: string;
    email: string;
    password: string;
  }) => Promise<AuthError | null>;
}) {
  const [name, setName] = useState(guestName ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [fieldErr, setFieldErr] = useState<{ name?: boolean; email?: boolean; password?: boolean }>({});
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, [mode]);

  const submit = async () => {
    const cleanName = name.trim().replace(/\s+/g, " ");
    const errs = {
      name: mode === "signup" && cleanName.length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
      password: password.length < 8,
    };
    setFieldErr(errs);
    if (errs.name || errs.email || errs.password) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit({ mode, name: cleanName, email: email.trim(), password });
    setBusy(false);
    if (result) {
      setError(result);
      if (result === "userExists") onMode("signin");
    }
  };

  const tabs: Array<["signup" | "signin", string]> = [
    ["signup", t.tabSignUp],
    ["signin", t.tabSignIn],
  ];

  return (
    <div className="vj-enter">
      <div className="text-center">
        <Seal size={44} />
        <h1 className={`${cormorant.className} mt-5 text-3xl font-medium text-zinc-50 sm:text-4xl`}>
          {mode === "signup" ? t.titleSignUp : t.titleSignIn}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {patron ? `${t.inviteFrom(patron)} · ` : ""}
          <span className="font-mono tracking-[0.14em] text-zinc-400">{code}</span>
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-5 sm:p-7">
        {intent === "accept" && (
          <div
            role="tablist"
            className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1"
          >
            {tabs.map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setError(null);
                  setFieldErr({});
                  onMode(m);
                }}
                className={`min-w-0 truncate rounded-lg px-3 py-2 text-sm transition-colors ${FOCUS} ${
                  mode === m
                    ? "bg-zinc-900 text-amber-200 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.14)]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <form
          noValidate
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {mode === "signup" && (
            <Field id="vj-name" label={t.fullName} error={fieldErr.name ? t.errName : null}>
              <input
                ref={firstRef}
                id="vj-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFieldErr((f) => ({ ...f, name: false }));
                }}
                autoComplete="name"
                maxLength={80}
                disabled={busy}
                aria-invalid={!!fieldErr.name}
                className={INPUT}
              />
            </Field>
          )}
          <Field id="vj-email" label={t.email} error={fieldErr.email ? t.errEmail : null}>
            <input
              ref={mode === "signin" ? firstRef : undefined}
              id="vj-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErr((f) => ({ ...f, email: false }));
              }}
              autoComplete="email"
              inputMode="email"
              disabled={busy}
              aria-invalid={!!fieldErr.email}
              className={INPUT}
            />
          </Field>
          <Field
            id="vj-password"
            label={t.password}
            hint={mode === "signup" ? t.passwordHint : undefined}
            error={fieldErr.password ? t.errPassword : null}
          >
            <div className="relative">
              <input
                id="vj-password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErr((f) => ({ ...f, password: false }));
                }}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                disabled={busy}
                aria-invalid={!!fieldErr.password}
                aria-describedby="vj-password-msg"
                className={`${INPUT} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? t.hidePassword : t.showPassword}
                title={show ? t.hidePassword : t.showPassword}
                className={`absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-zinc-200 ${FOCUS}`}
              >
                {show ? (
                  <EyeOff size={16} strokeWidth={1.5} aria-hidden />
                ) : (
                  <Eye size={16} strokeWidth={1.5} aria-hidden />
                )}
              </button>
            </div>
          </Field>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/20 bg-red-500/[0.06] px-3.5 py-2.5 text-[13px] text-red-200/90"
            >
              {t.authError[error]}
            </p>
          )}

          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? (
              <Loader2 size={17} strokeWidth={1.6} className="animate-spin" aria-hidden />
            ) : (
              <KeyRound size={17} strokeWidth={1.5} aria-hidden />
            )}
            {intent === "status" ? t.submitSignInOnly : mode === "signup" ? t.submitSignUp : t.submitSignIn}
          </button>
        </form>
      </div>

      <div className="mt-6 text-center">
        <button type="button" onClick={onBack} className={LINK_QUIET}>
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
          {t.back}
        </button>
      </div>
    </div>
  );
}

/** «Проверьте почту» — с повторной отправкой */
function ConfirmPanel({ t, email, code, onChange }: { t: Dict; email: string; code: string; onChange: () => void }) {
  const [left, setLeft] = useState(RESEND_COOLDOWN_S);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const resend = async () => {
    setLeft(RESEND_COOLDOWN_S);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/join?key=${encodeURIComponent(code)}` },
    });
    setSent(!error);
  };

  return (
    <Notice icon={Mail} title={t.confirmTitle} body={t.confirmBody(email)}>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={left > 0}
        className={`${BTN_GHOST} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {sent && left > 0 ? (
          <Check size={15} strokeWidth={1.6} aria-hidden />
        ) : (
          <Mail size={15} strokeWidth={1.5} aria-hidden />
        )}
        {left > 0 ? (sent ? t.resent : t.resendIn(left)) : t.resend}
      </button>
      <button type="button" onClick={onChange} className={`${LINK_QUIET} justify-center`}>
        {t.changeEmail}
      </button>
    </Notice>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

/** Пока Next.js читает параметры ссылки — тот же фон и печать */
export function JoinFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <span className="relative inline-flex">
        <span className="absolute inset-0 rounded-full border border-amber-200/40" />
        <Seal size={56} />
      </span>
    </div>
  );
}

export default function JoinClient() {
  const params = useSearchParams();
  const router = useRouter();
  const { lang, setLang } = useJoinLang();
  const t = T[lang];
  const session = useSessionLite();
  const reduced = usePrefersReducedMotion();

  const urlCode = useMemo(() => normalizeInviteCode(params.get("key")), [params]);
  const rawKey = params.get("key");
  const [code, setCode] = useState<string | null>(urlCode);
  const [preview, setPreview] = useState<InvitePreviewRow | null>(null);
  const [view, setView] = useState<View>({ kind: "checking" });
  const request = useRef(0);
  const redeeming = useRef(false);

  // ключ из ссылки; если ссылки нет — тот, что гостья начала принимать
  useEffect(() => {
    if (urlCode) {
      setCode(urlCode);
      return;
    }
    const pending = readPending();
    if (pending && !rawKey) setCode(pending.code);
    else setView({ kind: "invalid", reason: rawKey ? "not_found" : "missing" });
  }, [urlCode, rawKey]);

  /* ── активация ── */
  const redeem = useCallback(
    async (name: string | null) => {
      if (!code || redeeming.current) return;
      redeeming.current = true;
      setView({ kind: "redeeming" });
      try {
        const [{ error }] = await Promise.all([
          supabase.rpc("club_redeem_invite", { p_code: code, p_full_name: name }),
          wait(reduced ? 0 : SEAL_MS),
        ]);
        if (error) {
          const c = inviteErrorCode(error);
          console.error("[Join] Redeem error:", error);
          if (c === "key_expired") setView({ kind: "invalid", reason: "expired" });
          else if (c === "key_used") setView({ kind: "invalid", reason: "used" });
          else if (c === "not_found") setView({ kind: "invalid", reason: "not_found" });
          else if (c === "already_member" || c === "already_linked" || c === "self_invite" || c === "profile_missing") {
            setView({ kind: "redeemError", error: c });
          } else setView({ kind: "redeemError", error: "generic" });
          if (c !== "profile_missing" && c !== null) clearPending();
          return;
        }
        clearPending();
        setView({ kind: "done" });
      } finally {
        redeeming.current = false;
      }
    },
    [code, reduced],
  );

  /* ── превью: при открытии, смене ключа и после входа ── */
  const userId = session === undefined ? undefined : (session?.userId ?? null);
  useEffect(() => {
    if (!code || userId === undefined) return;
    const id = ++request.current;
    let alive = true;
    (async () => {
      setView((v) => (v.kind === "auth" || v.kind === "confirm" || v.kind === "redeeming" ? v : { kind: "checking" }));
      try {
        const { data, error } = await supabase.rpc("club_invite_preview", { p_code: code });
        if (!alive || id !== request.current) return;
        if (error) {
          console.error("[Join] Preview error:", error);
          setView({ kind: "invalid", reason: "network" });
          return;
        }
        const row = (Array.isArray(data) ? data[0] : data) as InvitePreviewRow | null;
        if (!row) {
          setView({ kind: "invalid", reason: "not_found" });
          return;
        }
        setPreview(row);
        if (row.reason === "yours") {
          clearPending();
          setView({ kind: "yours", status: row.invite_status ?? "pending" });
        } else if (row.reason === "ok") {
          const pending = readPending();
          // гостья уже начала принимать ключ (регистрация / письмо) — активируем сразу
          if (userId && pending?.code === code) void redeem(pending.name);
          else setView((v) => (v.kind === "auth" ? v : { kind: "invite" }));
        } else {
          setView({
            kind: "invalid",
            reason: row.reason === "expired" ? "expired" : row.reason === "used" ? "used" : "not_found",
          });
        }
      } catch (e) {
        if (!alive) return;
        console.error("[Join] Preview exception:", e);
        setView({ kind: "invalid", reason: "network" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, userId, redeem]);

  /* ── действия ── */
  const openKey = (next: string) => {
    setCode(next);
    router.replace(`/join?key=${encodeURIComponent(next)}`);
  };

  const accept = () => {
    if (!code) return;
    if (session) void redeem(null);
    else {
      savePending(code, preview?.guest_name ?? null);
      setView({ kind: "auth", mode: "signup", intent: "accept" });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setView({ kind: "checking" });
  };

  const submitAuth = async (f: { mode: "signup" | "signin"; name: string; email: string; password: string }) => {
    if (!code) return "generic" as AuthError;
    const intent = view.kind === "auth" ? view.intent : "accept";
    try {
      if (f.mode === "signup") {
        savePending(code, f.name);
        const { data, error } = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: {
            data: { full_name: f.name, invite_key: code },
            emailRedirectTo: `${window.location.origin}/join?key=${encodeURIComponent(code)}`,
          },
        });
        if (error) return authErrorCode(error);
        // почта уже зарегистрирована (Supabase в этом случае не раскрывает это ошибкой)
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return "userExists";
        if (!data.session) {
          setView({ kind: "confirm", email: f.email });
          return null;
        }
        return null; // сессия появилась — превью перечитается и ключ активируется сам
      }
      if (intent === "accept") savePending(code, readPending()?.name ?? preview?.guest_name ?? null);
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) return authErrorCode(error);
      if (intent === "status") setView({ kind: "checking" });
      return null;
    } catch (e) {
      console.error("[Join] Auth exception:", e);
      return "generic";
    }
  };

  const patron = preview?.patron_display ?? preview?.patron_first_name ?? null;

  /* ── разметка ── */
  let body: ReactNode;
  switch (view.kind) {
    case "checking":
      body = (
        <div className="flex flex-col items-center gap-6 py-16 text-center" aria-live="polite">
          <span className="relative inline-flex">
            <span className="vj-ring absolute inset-0 rounded-full border border-amber-200/40" />
            <Seal size={64} />
          </span>
          <p className="vj-breathe text-sm tracking-wide text-zinc-500">{t.checking}</p>
        </div>
      );
      break;

    case "invalid": {
      const [title, text] = t.invalid[view.reason];
      const icon =
        view.reason === "expired"
          ? Hourglass
          : view.reason === "used"
            ? LockKeyhole
            : view.reason === "network"
              ? WifiOff
              : KeyRound;
      body = (
        <Notice icon={icon} tone={view.reason === "network" ? "muted" : "amber"} title={title} body={text}>
          {(view.reason === "missing" || view.reason === "not_found") && (
            <KeyEntry t={t} onOpen={openKey} initial={view.reason === "not_found" ? (rawKey ?? "") : ""} />
          )}
          {view.reason === "used" && !session && (
            <button
              type="button"
              onClick={() => setView({ kind: "auth", mode: "signin", intent: "status" })}
              className={BTN_GHOST}
            >
              {t.signIn}
            </button>
          )}
          {view.reason === "network" && code && (
            <button
              type="button"
              onClick={() => {
                const c = code;
                setCode(null);
                setTimeout(() => setCode(c), 0);
              }}
              className={BTN_GHOST}
            >
              {t.retry}
            </button>
          )}
          <a href="/" className={`${LINK_QUIET} justify-center`}>
            {t.home}
          </a>
        </Notice>
      );
      break;
    }

    case "invite":
      body = preview && code && (
        <div className="space-y-10">
          <div className="vj-enter">
            <InvitationCard preview={preview} code={code} t={t} lang={lang} />
          </div>
          <div className="vj-enter-2 mx-auto max-w-sm space-y-3 text-center">
            {session && (
              <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                <ShieldCheck size={13} strokeWidth={1.5} className="text-amber-200/70" aria-hidden />
                <span>{t.signedInAs(session.email ?? "—")}</span>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="underline-offset-4 hover:text-zinc-200 hover:underline"
                >
                  {t.signOut}
                </button>
              </p>
            )}
            <button type="button" onClick={accept} className={BTN_PRIMARY}>
              <KeyRound size={17} strokeWidth={1.5} aria-hidden />
              {t.accept}
            </button>
            <p className="text-xs text-zinc-600">{t.acceptNote}</p>
          </div>
          <Steps t={t} />
        </div>
      );
      break;

    case "auth":
      body = code && (
        <AuthPanel
          t={t}
          mode={view.mode}
          intent={view.intent}
          patron={patron}
          code={code}
          guestName={readPending()?.name ?? preview?.guest_name ?? null}
          onMode={(m) => setView({ kind: "auth", mode: m, intent: view.intent })}
          onBack={() => setView(view.intent === "status" ? { kind: "invalid", reason: "used" } : { kind: "invite" })}
          onSubmit={submitAuth}
        />
      );
      break;

    case "confirm":
      body = code && (
        <ConfirmPanel
          t={t}
          email={view.email}
          code={code}
          onChange={() => setView({ kind: "auth", mode: "signup", intent: "accept" })}
        />
      );
      break;

    case "redeeming":
      body = (
        <div className="flex flex-col items-center gap-7 py-16 text-center" aria-live="polite">
          <span className="relative inline-flex">
            <span className="vj-ring absolute inset-0 rounded-full border border-amber-200/50" />
            <Seal size={84} />
          </span>
          <p className={`${cormorant.className} vj-breathe text-2xl italic text-amber-100`}>{t.redeeming}</p>
        </div>
      );
      break;

    case "done":
    case "yours": {
      const status = view.kind === "done" ? "pending" : view.status;
      const approved = status === "approved";
      const declined = status === "declined" || status === "burned";
      body = (
        <div className="vj-enter text-center" aria-live="polite">
          <Seal
            size={76}
            press
            mark={
              approved || !declined ? <Check size={30} strokeWidth={1.6} style={{ color: "#4a3816" }} /> : undefined
            }
          />
          <h1 className={`${cormorant.className} mt-7 text-3xl font-medium leading-tight text-zinc-50 sm:text-4xl`}>
            {approved ? t.approvedTitle : declined ? t.declinedTitle : t.doneTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-zinc-400">
            {approved ? t.approvedBody : declined ? t.declinedBody : patron ? t.doneBody(patron) : t.doneBodyAnon}
          </p>
          {!approved && !declined && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-200/[0.05] px-3.5 py-1.5 text-xs text-amber-200">
              <Hourglass size={13} strokeWidth={1.6} aria-hidden />
              {t.statusPending}
            </p>
          )}
          {!declined && (
            <div className="mx-auto mt-8 max-w-sm">
              <a href="/dashboard" className={BTN_PRIMARY}>
                {t.toDashboard}
              </a>
            </div>
          )}
          <div className="mt-6">
            <Ornament />
          </div>
        </div>
      );
      break;
    }

    case "redeemError": {
      const [title, text] = t.redeemError[view.error];
      body = (
        <Notice
          icon={view.error === "generic" ? X : view.error === "profile_missing" ? Hourglass : ShieldCheck}
          tone={view.error === "generic" ? "red" : "amber"}
          title={title}
          body={text}
        >
          {view.error === "already_member" || view.error === "already_linked" ? (
            <a href="/dashboard" className={BTN_PRIMARY}>
              {t.toDashboard}
            </a>
          ) : view.error === "self_invite" ? (
            <a href="/dashboard/invite" className={BTN_PRIMARY}>
              {t.myKeys}
            </a>
          ) : (
            <button type="button" onClick={() => void redeem(readPending()?.name ?? null)} className={BTN_PRIMARY}>
              {t.retry}
            </button>
          )}
          {(view.error === "already_member" || view.error === "already_linked" || view.error === "self_invite") && (
            <button type="button" onClick={() => void signOut()} className={`${LINK_QUIET} justify-center`}>
              <LogOut size={14} strokeWidth={1.5} aria-hidden />
              {t.useAnother}
            </button>
          )}
        </Notice>
      );
      break;
    }
  }

  return (
    <div
      lang={lang}
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-zinc-950 text-zinc-300 antialiased"
    >
      <style>{JOIN_CSS}</style>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_50%_-5%,rgba(253,230,138,0.08)_0%,transparent_65%)]" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-6 sm:px-10">
        <a href="/" className={`flex items-center gap-3 rounded-lg ${FOCUS}`}>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/30">
            <span className={`${cormorant.className} text-lg font-medium text-amber-200/90`}>V</span>
          </span>
          <span className="vj-wordmark flex flex-col">
            <span className={`${cormorant.className} text-xl font-medium tracking-[0.2em] text-zinc-50`}>VOYAGE</span>
            <span className="text-[9px] uppercase tracking-[0.3em] text-zinc-500">{t.tagline}</span>
          </span>
        </a>
        <div
          role="group"
          aria-label={t.language}
          className="flex items-center gap-1 rounded-full border border-zinc-800/80 p-1"
        >
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] transition-colors ${FOCUS} ${
                lang === l ? "bg-amber-200/10 text-amber-200" : "text-zinc-500 hover:text-zinc-200"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[36rem] flex-1 flex-col justify-center px-5 pb-10 pt-4">
        {view.kind === "invite" && (
          <p className="vj-enter mb-2 text-center text-[10px] uppercase tracking-[0.45em] text-zinc-600">{t.eyebrow}</p>
        )}
        <div key={view.kind}>{body}</div>
      </main>

      <footer className="relative z-10 px-5 pb-8 text-center">
        <p className={`${cormorant.className} text-base italic text-zinc-600`}>{t.footer}</p>
      </footer>
    </div>
  );
}
