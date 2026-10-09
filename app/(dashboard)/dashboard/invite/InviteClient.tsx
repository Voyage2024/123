"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PATRONAGE — «Пригласить в клуб»
 * app/(dashboard)/dashboard/invite/InviteClient.tsx
 *
 * Механика
 *   Ключи сезона   — квота зависит от Circle поручительницы.
 *                    Сезон = календарный год, ключи не переносятся.
 *                    Ключ именной, одноразовый, живёт KEY_TTL_DAYS дней.
 *                    Не использован → возвращается. Гостью не приняли →
 *                    ключ сгорает: имя поручительницы стоит рядом с её.
 *   Дивиденды      — баллы к Influence Index идут за путь гостьи в клубе,
 *                    а не за регистрацию: принята → первый
 *                    визовый штамп → Inner Circle.
 *   Отличия        — Club Scout · Patron · Tastemaker (ACHIEVEMENTS).
 *
 * Данные приходят пропсами (InviteData) — компонент не знает о таблицах.
 * page.tsx берёт их из Supabase (v_club_invites, club_invite_allowance,
 * club_patronage_rules) и выдаёт ключи через RPC club_issue_invite —
 * квоту проверяет сервер. Без пропсов (InviteClient без data) страница
 * работает на демо-данных и выдаёт ключи локально (demoIssueKey).
 * Правила по умолчанию — lib/patronage.ts; правила из БД их переопределяют.
 *
 * Бренд-слой (Voyage, Circle, Influence Index, названия отличий,
 * французская микрокопия) одинаков во всех языках.
 * ──────────────────────────────────────────────────────────────────── */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  CalendarDays,
  Check,
  Copy,
  Crown,
  DoorOpen,
  Feather,
  Flame,
  Gem,
  Hourglass,
  KeyRound,
  Link2,
  Mail,
  Plane,
  Plus,
  Share2,
  Stamp,
  Telescope,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { CIRCLES, fmtPoints, normalizeCircleKey, normalizeLang, type CircleKey, type Lang } from "@/lib/gamification";
import {
  DEFAULT_DIVIDENDS,
  DEFAULT_INVITE_QUOTA,
  KEY_TTL_DAYS,
  MILESTONES,
  PATRON_GOAL,
  dividendMax,
  inviteUrl,
  type Milestone,
} from "@/lib/patronage";

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

/* ══════════════════════════════════════════════════════════════════
 * КОНТРАКТ ДАННЫХ
 * ══════════════════════════════════════════════════════════════════ */

/**
 * sealed   — ключ выдан, гостья ещё не открыла его
 * pending  — анкета у модерации
 * approved — принята в клуб
 * touring  — получила визовый штамп, летает
 * declined — модерация отказала (ключ сгорел)
 * expired  — срок ключа вышел (ключ вернулся)
 * burned   — клуб сжёг поручительство: дивиденды сняты
 */
export type InviteStatus = "sealed" | "pending" | "approved" | "touring" | "declined" | "expired" | "burned";

export type Protege = {
  id: string;
  /** ключ VYG-XXXX-XXXX — для статуса sealed */
  code?: string;
  inviteUrl?: string;
  name: string;
  avatarUrl?: string | null;
  invitedAt: string;
  expiresAt?: string | null;
  /** сезон ключа; по умолчанию — год invitedAt (UTC) */
  season?: number;
  status: InviteStatus;
  /** её собственный Circle, когда она уже в клубе */
  circleKey?: CircleKey | null;
  milestones: Record<Milestone, boolean>;
  /** если сервер считает дивиденды сам — переопределяет расчёт по этапам */
  dividends?: number;
};

export type IssuedKey = {
  code: string;
  url: string;
  guestName: string;
  expiresAt: string;
};

export type AchievementId = "club-scout" | "patron" | "tastemaker";

export type InviteData = {
  /** по умолчанию — имя из сессии */
  patronName?: string;
  circleKey: CircleKey;
  season: number;
  /** момент обновления ключей, ISO */
  seasonEndsAt: string;
  /** ключи этого сезона, которые уже заняты (выданные + сгоревшие) */
  keysUsed: number;
  /** по умолчанию — квота Circle из rules */
  keysTotal?: number;
  proteges: Protege[];
  /** отличия, которые сервер уже выдал; объединяются с вычисленными */
  achievements?: AchievementId[];
  /** правила из БД (club_patronage_rules, game_circles.invite_quota) */
  rules?: {
    dividends?: Partial<Record<Milestone, number>>;
    quota?: Partial<Record<CircleKey, number>>;
  };
};

export type InviteClientProps = {
  data?: InviteData;
  /** выдать ключ на имя гостьи; бросает ошибку, если квота исчерпана */
  onIssueKey?: (guestName: string) => Promise<IssuedKey>;
};

const NO_MILESTONES: Record<Milestone, boolean> = { approved: false, firstStamp: false, innerCircle: false };

/* ── Демо ────────────────────────────────────────────────────────── */

export const DEMO_INVITE_DATA: InviteData = {
  circleKey: "inner",
  season: 2026,
  seasonEndsAt: "2027-01-01T00:00:00Z",
  keysUsed: 3,
  proteges: [
    {
      id: "demo-camila",
      code: "VYG-K7QM-2XRT",
      name: "Camila Duarte",
      invitedAt: "2026-10-05T09:30:00Z",
      expiresAt: "2026-10-19T09:30:00Z",
      status: "sealed",
      milestones: NO_MILESTONES,
    },
    {
      id: "demo-ines",
      name: "Inès Laurent",
      invitedAt: "2026-09-28T16:10:00Z",
      status: "pending",
      milestones: NO_MILESTONES,
    },
    {
      id: "demo-mila",
      name: "Mila Novak",
      invitedAt: "2026-06-02T12:00:00Z",
      expiresAt: "2026-06-16T12:00:00Z",
      status: "expired",
      milestones: NO_MILESTONES,
    },
    {
      id: "demo-daria",
      name: "Daria Volkova",
      invitedAt: "2026-03-14T11:00:00Z",
      status: "touring",
      circleKey: "preferred",
      milestones: { approved: true, firstStamp: true, innerCircle: false },
    },
    {
      id: "demo-sofia",
      name: "Sofía Martín",
      invitedAt: "2025-11-18T18:45:00Z",
      status: "approved",
      circleKey: "voyager",
      milestones: { approved: true, firstStamp: false, innerCircle: false },
    },
    {
      id: "demo-elena",
      name: "Elena Ricci",
      invitedAt: "2025-04-09T08:20:00Z",
      status: "touring",
      circleKey: "inner",
      milestones: { approved: true, firstStamp: true, innerCircle: true },
    },
  ],
};

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O и 1/I

function randomKeyCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]);
  return `VYG-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Демо-выдача: ключ создаётся в браузере и никуда не сохраняется */
export async function demoIssueKey(guestName: string): Promise<IssuedKey> {
  const code = randomKeyCode();
  return {
    code,
    url: inviteUrl(code),
    guestName,
    expiresAt: new Date(Date.now() + KEY_TTL_DAYS * 86_400_000).toISOString(),
  };
}

/* ══════════════════════════════════════════════════════════════════
 * СЛОВАРЬ
 * ══════════════════════════════════════════════════════════════════ */

const ru3 = (n: number, one: string, few: string, many: string) => {
  const m100 = Math.abs(n) % 100;
  const m10 = m100 % 10;
  if (m100 > 10 && m100 < 20) return many;
  if (m10 === 1) return one;
  if (m10 >= 2 && m10 <= 4) return few;
  return many;
};
const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);

type Stage = "sealed" | "pending" | "approved" | "touring" | "inner" | "declined" | "expired" | "burned";

type InviteText = { guest: string; patron: string; code: string; url: string; date: string };

const en = {
  title: "Extend an invitation",
  lead: "Voyage grows by recommendation alone. Every key carries your name beside hers.",
  hint: (p: string) => `When your guest earns her first visa stamp, you receive ${p} to your Influence Index`,
  hintScout: " and the Club Scout distinction.",
  hintEnd: ".",

  envelopeFor: "For",
  envelopeGuest: "your guest",
  invitation: "Invitation",
  sponsoredBy: (n: string) => `Sponsored by ${n}`,
  personalKey: "Personal key",
  validUntil: (d: string) => `Valid until ${d}`,

  forWhom: "Who is this key for?",
  namePlaceholder: "Your guest's full name",
  nameNote: "Her name will be inscribed on the invitation. The key opens only once.",
  seal: "Seal the key",
  sealing: "Sealing…",
  sealError: "The key couldn't be sealed. Please try again.",

  copyKey: "Copy key",
  copyLink: "Copy personal link",
  copyInvite: "Copy invitation text",
  share: "Share",
  copied: "Copied",
  copyFailed: "Couldn't copy — select the text manually",
  another: "Seal another key",
  issuedNote: "Send it personally — in your own message, never a group chat.",
  srSealed: (code: string) => `Key sealed: ${code}`,
  inviteText: ({ guest, patron, code, url, date }: InviteText) =>
    `${guest}, I'd like to invite you to Voyage. I issue this key personally, and it is for you alone.\n\nKey: ${code}\nValid until ${date}\n${url}\n\n— ${patron}`,

  exhaustedTitle: "This season's keys have all been given",
  exhaustedNote: (d: string) => `New keys arrive on ${d}. A higher Circle brings more of them.`,

  seasonKeys: (s: number) => `Keys of season ${s}`,
  keysRemaining: "keys remaining",
  renews: (d: string) => `Renewed on ${d}`,
  quotaTitle: "Keys per season, by Circle",
  yourCircle: "your Circle",
  keyUsed: "Key given",
  keyFree: "Key available",
  ruleTtl: (d: number) => `Each key is personal, single-use and valid for ${d} days.`,
  ruleReturn: "A key that goes unopened returns to you.",
  ruleBurn: "If the club declines your guest, the key burns — your name stands beside hers.",
  ruleSeason: "Keys don't carry over into the next season.",

  divTitle: "A sponsor's dividends",
  divLead: (max: string) =>
    `Points follow your guest's path in the club, not her sign-up. Up to ${max} from a single protégée.`,
  toIndex: "to your Influence Index",
  milestone: {
    approved: "Admitted to the club",
    firstStamp: "First visa stamp",
    innerCircle: "Inner Circle",
  } as Record<Milestone, string>,
  milestoneNote: {
    approved: "The committee confirms your recommendation.",
    firstStamp: "She flies her first tour. For your first protégée — the Club Scout distinction.",
    innerCircle: "She reaches Inner Circle — the clearest proof of your eye.",
  } as Record<Milestone, string>,

  achTitle: "Distinctions",
  achNote: {
    "club-scout": "Your protégée earned her first visa stamp.",
    patron: `${PATRON_GOAL} protégées admitted in a single season.`,
    tastemaker: "A protégée of yours reached Inner Circle.",
  } as Record<AchievementId, string>,
  earned: "Earned",
  ahead: "Ahead",

  protegesTitle: "My protégées",
  broughtYou: "Brought you",
  season: (s: number) => `Season ${s}`,
  invitedOn: (d: string) => `Invited ${d}`,
  keyUntil: (d: string) => `Key valid until ${d}`,
  pendingNote: "Her application is with the committee",
  expiredNote: "The key has returned to you",
  declinedNote: "The key has burned",
  burnedNote: "The club withdrew the sponsorship — her dividends are cancelled",
  stage: {
    sealed: "Key sent",
    pending: "Awaiting moderation",
    approved: "In the club",
    touring: "On tour",
    inner: "Inner Circle",
    declined: "Not admitted",
    expired: "Key expired",
    burned: "Sponsorship withdrawn",
  } as Record<Stage, string>,
  milestoneState: (label: string, done: boolean) => `${label}: ${done ? "reached" : "not yet"}`,
  copyLinkFor: (n: string) => `Copy the link for ${n}`,
  emptyTitle: "No protégées yet",
  emptyNote: "Your first key is waiting above. Choose without haste.",

  footer: "Membership in Voyage is never sold — only handed on.",
};

type Dict = typeof en;

const ru: Dict = {
  title: "Пригласить в клуб",
  lead: "Voyage растёт только по рекомендации. На каждом ключе ваше имя стоит рядом с её именем.",
  hint: (p) => `Когда ваша гостья получит свой первый визовый штамп, вы получите ${p} к Influence Index`,
  hintScout: " и отличие Club Scout.",
  hintEnd: ".",

  envelopeFor: "Для",
  envelopeGuest: "вашей гостьи",
  invitation: "Приглашение",
  sponsoredBy: (n) => `Поручитель — ${n}`,
  personalKey: "Персональный ключ",
  validUntil: (d) => `Действует до ${d}`,

  forWhom: "Для кого этот ключ?",
  namePlaceholder: "Имя и фамилия гостьи",
  nameNote: "Имя будет вписано в приглашение. Ключ открывается один раз.",
  seal: "Запечатать ключ",
  sealing: "Запечатываем…",
  sealError: "Не удалось запечатать ключ. Попробуйте ещё раз.",

  copyKey: "Скопировать ключ",
  copyLink: "Скопировать ссылку",
  copyInvite: "Скопировать приглашение",
  share: "Поделиться",
  copied: "Скопировано",
  copyFailed: "Не удалось скопировать — выделите текст вручную",
  another: "Запечатать ещё один ключ",
  issuedNote: "Отправьте лично — своим сообщением, не в общий чат.",
  srSealed: (code) => `Ключ запечатан: ${code}`,
  inviteText: ({ guest, patron, code, url, date }) =>
    `${guest}, приглашаю вас в Voyage. Этот ключ я выдаю лично — он только для вас.\n\nКлюч: ${code}\nДействует до ${date}\n${url}\n\n— ${patron}`,

  exhaustedTitle: "Ключи этого сезона уже вручены",
  exhaustedNote: (d) => `Новые ключи придут ${d}. Чем выше Circle, тем их больше.`,

  seasonKeys: (s) => `Ключи сезона ${s}`,
  keysRemaining: "осталось ключей",
  renews: (d) => `Обновятся ${d}`,
  quotaTitle: "Ключей за сезон по Circle",
  yourCircle: "ваш Circle",
  keyUsed: "Ключ вручён",
  keyFree: "Ключ свободен",
  ruleTtl: (d) => `Ключ именной и одноразовый, действует ${d} ${ru3(d, "день", "дня", "дней")}.`,
  ruleReturn: "Неиспользованный ключ возвращается к вам.",
  ruleBurn: "Если клуб не примет гостью, ключ сгорает: ваше имя стоит рядом с её именем.",
  ruleSeason: "Ключи не переносятся на следующий сезон.",

  divTitle: "Дивиденды поручителя",
  divLead: (max) => `Баллы идут за путь гостьи в клубе, а не за регистрацию. До ${max} с одной протеже.`,
  toIndex: "к вашему Influence Index",
  milestone: {
    approved: "Принята в клуб",
    firstStamp: "Первый визовый штамп",
    innerCircle: "Inner Circle",
  },
  milestoneNote: {
    approved: "Комитет подтвердил вашу рекомендацию.",
    firstStamp: "Она летит в свой первый тур. За первую протеже — отличие Club Scout.",
    innerCircle: "Она дошла до Inner Circle — лучшее подтверждение вашего чутья.",
  },

  achTitle: "Отличия",
  achNote: {
    "club-scout": "Ваша протеже получила свой первый визовый штамп.",
    patron: `${PATRON_GOAL} протеже приняты в клуб за один сезон.`,
    tastemaker: "Ваша протеже дошла до Inner Circle.",
  },
  earned: "Получено",
  ahead: "Впереди",

  protegesTitle: "Мои протеже",
  broughtYou: "Принесли вам",
  season: (s) => `Сезон ${s}`,
  invitedOn: (d) => `Приглашена ${d}`,
  keyUntil: (d) => `Ключ действует до ${d}`,
  pendingNote: "Анкета у комитета",
  expiredNote: "Ключ вернулся к вам",
  declinedNote: "Ключ сгорел",
  burnedNote: "Клуб снял поручительство — дивиденды аннулированы",
  stage: {
    sealed: "Ключ отправлен",
    pending: "Ожидает модерации",
    approved: "Принята в клуб",
    touring: "Летит в тур",
    inner: "Inner Circle",
    declined: "Не принята",
    expired: "Ключ истёк",
    burned: "Поручительство снято",
  },
  milestoneState: (label, done) => `${label}: ${done ? "да" : "пока нет"}`,
  copyLinkFor: (n) => `Скопировать ссылку для ${n}`,
  emptyTitle: "Протеже пока нет",
  emptyNote: "Ваш первый ключ ждёт выше. Выбирайте не спеша.",

  footer: "Членство в Voyage не продаётся — его передают из рук в руки.",
};

const es: Dict = {
  title: "Extender una invitación",
  lead: "Voyage solo crece por recomendación. Cada llave lleva su nombre junto al de su invitada.",
  hint: (p) => `Cuando su invitada obtenga su primer sello de visado, usted recibirá ${p} en su Influence Index`,
  hintScout: " y la distinción Club Scout.",
  hintEnd: ".",

  envelopeFor: "Para",
  envelopeGuest: "su invitada",
  invitation: "Invitación",
  sponsoredBy: (n) => `Madrina: ${n}`,
  personalKey: "Llave personal",
  validUntil: (d) => `Válida hasta el ${d}`,

  forWhom: "¿Para quién es esta llave?",
  namePlaceholder: "Nombre y apellido de su invitada",
  nameNote: "Su nombre quedará inscrito en la invitación. La llave se abre una sola vez.",
  seal: "Sellar la llave",
  sealing: "Sellando…",
  sealError: "No se pudo sellar la llave. Inténtelo de nuevo.",

  copyKey: "Copiar llave",
  copyLink: "Copiar enlace personal",
  copyInvite: "Copiar texto de la invitación",
  share: "Compartir",
  copied: "Copiado",
  copyFailed: "No se pudo copiar: seleccione el texto a mano",
  another: "Sellar otra llave",
  issuedNote: "Envíela personalmente, en un mensaje suyo y nunca en un chat grupal.",
  srSealed: (code) => `Llave sellada: ${code}`,
  inviteText: ({ guest, patron, code, url, date }) =>
    `${guest}, quiero invitarla a Voyage. Esta llave la entrego personalmente y es solo para usted.\n\nLlave: ${code}\nVálida hasta el ${date}\n${url}\n\n— ${patron}`,

  exhaustedTitle: "Las llaves de esta temporada ya fueron entregadas",
  exhaustedNote: (d) => `Las nuevas llegan el ${d}. Un Circle más alto trae más llaves.`,

  seasonKeys: (s) => `Llaves de la temporada ${s}`,
  keysRemaining: "llaves disponibles",
  renews: (d) => `Se renuevan el ${d}`,
  quotaTitle: "Llaves por temporada según Circle",
  yourCircle: "su Circle",
  keyUsed: "Llave entregada",
  keyFree: "Llave disponible",
  ruleTtl: (d) => `Cada llave es nominal, de un solo uso y válida durante ${d} ${pl(d, "día", "días")}.`,
  ruleReturn: "Una llave sin abrir vuelve a usted.",
  ruleBurn: "Si el club no admite a su invitada, la llave se quema: su nombre va junto al de ella.",
  ruleSeason: "Las llaves no pasan a la siguiente temporada.",

  divTitle: "Dividendos de madrina",
  divLead: (max) =>
    `Los puntos siguen el camino de su invitada en el club, no su registro. Hasta ${max} por cada protegida.`,
  toIndex: "a su Influence Index",
  milestone: {
    approved: "Admitida en el club",
    firstStamp: "Primer sello de visado",
    innerCircle: "Inner Circle",
  },
  milestoneNote: {
    approved: "El comité confirma su recomendación.",
    firstStamp: "Vuela su primera gira. Por su primera protegida, la distinción Club Scout.",
    innerCircle: "Llega a Inner Circle: la mejor prueba de su buen ojo.",
  },

  achTitle: "Distinciones",
  achNote: {
    "club-scout": "Su protegida obtuvo su primer sello de visado.",
    patron: `${PATRON_GOAL} protegidas admitidas en una misma temporada.`,
    tastemaker: "Una protegida suya llegó a Inner Circle.",
  },
  earned: "Obtenida",
  ahead: "Por delante",

  protegesTitle: "Mis protegidas",
  broughtYou: "Le aportaron",
  season: (s) => `Temporada ${s}`,
  invitedOn: (d) => `Invitada el ${d}`,
  keyUntil: (d) => `Llave válida hasta el ${d}`,
  pendingNote: "Su solicitud está con el comité",
  expiredNote: "La llave volvió a usted",
  declinedNote: "La llave se quemó",
  burnedNote: "El club retiró el madrinazgo: sus dividendos quedan anulados",
  stage: {
    sealed: "Llave enviada",
    pending: "En moderación",
    approved: "Admitida",
    touring: "De gira",
    inner: "Inner Circle",
    declined: "No admitida",
    expired: "Llave caducada",
    burned: "Madrinazgo retirado",
  },
  milestoneState: (label, done) => `${label}: ${done ? "sí" : "todavía no"}`,
  copyLinkFor: (n) => `Copiar el enlace para ${n}`,
  emptyTitle: "Aún no hay protegidas",
  emptyNote: "Su primera llave le espera arriba. Elija sin prisa.",

  footer: "La membresía de Voyage no se vende: solo pasa de mano en mano.",
};

const pt: Dict = {
  title: "Estender um convite",
  lead: "O Voyage só cresce por indicação. Cada chave leva o seu nome ao lado do dela.",
  hint: (p) => `Quando sua convidada ganhar o primeiro carimbo de visto, você recebe ${p} no Influence Index`,
  hintScout: " e a distinção Club Scout.",
  hintEnd: ".",

  envelopeFor: "Para",
  envelopeGuest: "sua convidada",
  invitation: "Convite",
  sponsoredBy: (n) => `Madrinha: ${n}`,
  personalKey: "Chave pessoal",
  validUntil: (d) => `Válida até ${d}`,

  forWhom: "Para quem é esta chave?",
  namePlaceholder: "Nome e sobrenome da sua convidada",
  nameNote: "O nome dela será escrito no convite. A chave abre uma única vez.",
  seal: "Selar a chave",
  sealing: "Selando…",
  sealError: "Não foi possível selar a chave. Tente novamente.",

  copyKey: "Copiar chave",
  copyLink: "Copiar link pessoal",
  copyInvite: "Copiar texto do convite",
  share: "Compartilhar",
  copied: "Copiado",
  copyFailed: "Não foi possível copiar — selecione o texto manualmente",
  another: "Selar outra chave",
  issuedNote: "Envie pessoalmente — numa mensagem sua, nunca num grupo.",
  srSealed: (code) => `Chave selada: ${code}`,
  inviteText: ({ guest, patron, code, url, date }) =>
    `${guest}, quero convidar você para o Voyage. Esta chave eu entrego pessoalmente — é só sua.\n\nChave: ${code}\nVálida até ${date}\n${url}\n\n— ${patron}`,

  exhaustedTitle: "As chaves desta temporada já foram entregues",
  exhaustedNote: (d) => `Novas chaves chegam em ${d}. Um Circle mais alto traz mais chaves.`,

  seasonKeys: (s) => `Chaves da temporada ${s}`,
  keysRemaining: "chaves disponíveis",
  renews: (d) => `Renovam em ${d}`,
  quotaTitle: "Chaves por temporada, por Circle",
  yourCircle: "seu Circle",
  keyUsed: "Chave entregue",
  keyFree: "Chave disponível",
  ruleTtl: (d) => `Cada chave é nominal, de uso único e válida por ${d} ${pl(d, "dia", "dias")}.`,
  ruleReturn: "Uma chave não aberta volta para você.",
  ruleBurn: "Se o clube não aceitar sua convidada, a chave queima: seu nome está ao lado do dela.",
  ruleSeason: "As chaves não passam para a próxima temporada.",

  divTitle: "Dividendos de madrinha",
  divLead: (max) => `Os pontos seguem o caminho da sua convidada no clube, não o cadastro. Até ${max} por protegida.`,
  toIndex: "no seu Influence Index",
  milestone: {
    approved: "Aceita no clube",
    firstStamp: "Primeiro carimbo de visto",
    innerCircle: "Inner Circle",
  },
  milestoneNote: {
    approved: "O comitê confirma a sua indicação.",
    firstStamp: "Ela voa a primeira turnê. Pela primeira protegida — a distinção Club Scout.",
    innerCircle: "Ela chega ao Inner Circle — a maior prova do seu olhar.",
  },

  achTitle: "Distinções",
  achNote: {
    "club-scout": "Sua protegida ganhou o primeiro carimbo de visto.",
    patron: `${PATRON_GOAL} protegidas aceitas numa mesma temporada.`,
    tastemaker: "Uma protegida sua chegou ao Inner Circle.",
  },
  earned: "Conquistada",
  ahead: "Pela frente",

  protegesTitle: "Minhas protegidas",
  broughtYou: "Renderam a você",
  season: (s) => `Temporada ${s}`,
  invitedOn: (d) => `Convidada em ${d}`,
  keyUntil: (d) => `Chave válida até ${d}`,
  pendingNote: "A candidatura está com o comitê",
  expiredNote: "A chave voltou para você",
  declinedNote: "A chave queimou",
  burnedNote: "O clube retirou o apadrinhamento — os dividendos foram anulados",
  stage: {
    sealed: "Chave enviada",
    pending: "Aguardando moderação",
    approved: "Aceita no clube",
    touring: "Em turnê",
    inner: "Inner Circle",
    declined: "Não aceita",
    expired: "Chave expirada",
    burned: "Apadrinhamento retirado",
  },
  milestoneState: (label, done) => `${label}: ${done ? "sim" : "ainda não"}`,
  copyLinkFor: (n) => `Copiar o link para ${n}`,
  emptyTitle: "Ainda não há protegidas",
  emptyNote: "Sua primeira chave espera acima. Escolha sem pressa.",

  footer: "A filiação ao Voyage não se vende — só passa de mão em mão.",
};

const T: Record<Lang, Dict> = { en, ru, es, pt };

/* ══════════════════════════════════════════════════════════════════
 * УТИЛИТЫ
 * ══════════════════════════════════════════════════════════════════ */

const LOCALES: Record<Lang, string> = { en: "en-GB", ru: "ru-RU", es: "es-ES", pt: "pt-BR" };

/** Дата в UTC — одинаково на сервере и в браузере (без расхождений гидратации) */
function fmtDate(lang: Lang, iso: string | null | undefined, month: "long" | "short" = "long") {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month, year: "numeric", timeZone: "UTC" })
    .format(d)
    .replace(/\s?г\.$/, "");
}

const plus = (n: number) => `+${fmtPoints(n)}`;

function seasonOf(p: Protege) {
  if (typeof p.season === "number") return p.season;
  const y = new Date(p.invitedAt).getUTCFullYear();
  return Number.isFinite(y) ? y : 0;
}

function stageOf(p: Protege): Stage {
  if (
    p.status === "sealed" ||
    p.status === "pending" ||
    p.status === "declined" ||
    p.status === "expired" ||
    p.status === "burned"
  ) {
    return p.status;
  }
  if (p.milestones.innerCircle) return "inner";
  if (p.status === "touring" || p.milestones.firstStamp) return "touring";
  return "approved";
}

/** Дивиденды за одну протеже: сумма пройденных этапов (или число от сервера) */
function dividendsOf(p: Protege, div: Record<Milestone, number>) {
  if (typeof p.dividends === "number" && Number.isFinite(p.dividends)) return p.dividends;
  if (p.status !== "approved" && p.status !== "touring") return 0;
  return MILESTONES.reduce((s, m) => s + (p.milestones[m] ? div[m] : 0), 0);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}

const circleTitle = (key: CircleKey | null | undefined) => CIRCLES.find((c) => c.key === key)?.title ?? null;

async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* запасной путь ниже */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    Object.assign(ta.style, { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" });
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ══════════════════════════════════════════════════════════════════
 * ХУКИ
 * ══════════════════════════════════════════════════════════════════ */

/** Язык из глобального контекста: { lang } | { language } | { locale } | "ru" */
function useLang(): Lang {
  const ctx: unknown = useLanguage();
  if (ctx && typeof ctx === "object") {
    const c = ctx as Record<string, unknown>;
    return normalizeLang(c.lang ?? c.language ?? c.locale);
  }
  return normalizeLang(ctx);
}

type AuthLike = {
  user?: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null;
  profile?: Record<string, unknown> | null;
};

/** Имя поручительницы: из данных → из профиля → из метаданных → из почты */
function usePatronName(explicit?: string) {
  const auth = useAuth() as unknown as AuthLike | null | undefined;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return (
    str(explicit) ??
    str(auth?.profile?.full_name) ??
    str(auth?.profile?.display_name) ??
    str(auth?.user?.user_metadata?.full_name) ??
    str(auth?.user?.email?.split("@")[0]) ??
    "Voyage"
  );
}

const noopSubscribe = () => () => {};

/** navigator.share — проверяем только в браузере, после гидратации */
function useCanShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

/** Копирование с подтверждением «Скопировано» на кнопке */
function useCopy() {
  const [state, setState] = useState<{ id: string; ok: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(async (id: string, text: string) => {
    const ok = await copyText(text);
    setState({ id, ok });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 2000);
  }, []);
  return { copiedId: state?.ok ? state.id : null, failedId: state && !state.ok ? state.id : null, copy };
}

/* ══════════════════════════════════════════════════════════════════
 * ОБЩИЕ ЭЛЕМЕНТЫ
 * ══════════════════════════════════════════════════════════════════ */

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const EASE = "cubic-bezier(0.22, 0.8, 0.24, 1)";
const SEAL_MS = 1100; // минимальная длительность ритуала «запечатать»
const FLIP_MS = 1000;

/** keyframes и правила для reduced-motion — один раз на страницу */
const INVITE_CSS = `
@keyframes vy-seal-ring { 0% { transform: scale(.7); opacity: .65 } 100% { transform: scale(1.9); opacity: 0 } }
@keyframes vy-shimmer { 0% { transform: translateX(-120%) } 100% { transform: translateX(120%) } }
@keyframes vy-breathe { 0%, 100% { opacity: .45 } 50% { opacity: 1 } }
.vy-ring { animation: vy-seal-ring 900ms ${EASE} both }
.vy-shimmer { animation: vy-shimmer 1400ms ${EASE} 250ms both }
.vy-breathe { animation: vy-breathe 1.6s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .vy-ring, .vy-shimmer, .vy-breathe { animation: none !important }
  .vy-motion { transition: none !important }
}

/* карточка подстраивается под свою ширину, а не под окно (у дашборда есть сайдбар) */
.vy-cardbox { container: vycard / inline-size }
.vy-trio-box { container: vytrio / inline-size }
.vy-trio { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr) }
.vy-ach { display: flex; align-items: flex-start; gap: 1rem }
@container vytrio (min-width: 38rem) {
  .vy-trio { grid-template-columns: repeat(3, minmax(0, 1fr)) }
  .vy-ach { flex-direction: column }
}
.vy-env-name { font-size: 1.5rem; line-height: 1.3 }
.vy-back { gap: .35rem }
.vy-back-title { font-size: 1.875rem; line-height: 1.15 }
.vy-back-name { font-size: 1.5rem; line-height: 1.3 }
.vy-back-code { font-size: 13px; padding: .25rem .75rem }
@container vycard (max-width: 19.5rem) {
  .vy-env-name { font-size: 1.2rem }
  .vy-seal { transform: scale(.8) }
  .vy-back { gap: .2rem }
  .vy-back-title { font-size: 1.4rem }
  .vy-back-name { font-size: 1.15rem }
  .vy-back-code { font-size: 12px; padding: .1rem .6rem }
  .vy-back-label, .vy-back-rule { display: none }
}
`;

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-medium uppercase tracking-[0.32em] text-amber-200/70 ${className}`}>{children}</p>
  );
}

function SectionHead({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={`${cormorant.className} mt-2 text-3xl font-medium leading-tight text-slate-100 sm:text-4xl`}>
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

function Medallion({ icon: Icon, lit, size = "md" }: { icon: LucideIcon; lit: boolean; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-10 w-10" : "h-14 w-14";
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border ${box} ${
        lit ? "border-amber-200/40 text-amber-200" : "border-zinc-700/80 text-zinc-500"
      }`}
      style={
        lit
          ? { background: "radial-gradient(circle at 35% 30%, rgba(253,230,138,0.16), rgba(253,230,138,0.02) 70%)" }
          : undefined
      }
    >
      <span className="absolute inset-[3px] rounded-full border border-current opacity-20" />
      <Icon className={glyph} strokeWidth={1.25} aria-hidden />
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КОНВЕРТ И ПРИГЛАШЕНИЕ — 3D-карточка
 * ══════════════════════════════════════════════════════════════════ */

type Phase = "compose" | "sealing" | "issued";

function WaxSeal({ visible, pressed }: { visible: boolean; pressed: boolean }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2">
      <span className="vy-seal relative block">
        {/* место для печати */}
        <span
          className="vy-motion absolute left-1/2 top-1/2 h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-amber-200/25 transition-opacity duration-500"
          style={{ opacity: visible ? 0 : 1 }}
        />
        {pressed && (
          <span className="vy-ring absolute left-1/2 top-1/2 -ml-8 -mt-8 h-16 w-16 rounded-full border border-amber-200/60" />
        )}
        <span
          className="vy-motion relative flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            transform: visible ? "scale(1) rotate(-8deg)" : "scale(1.55) rotate(-24deg)",
            opacity: visible ? 1 : 0,
            transition: `transform 520ms cubic-bezier(.3,1.5,.5,1), opacity 300ms ease-out`,
            background:
              "radial-gradient(circle at 34% 28%, #fef3c7 0%, #fde68a 18%, #d9b46a 46%, #a07c3a 74%, #6d5226 100%)",
            boxShadow:
              "0 6px 18px rgba(0,0,0,.55), inset 0 -3px 6px rgba(60,40,10,.45), inset 0 2px 3px rgba(255,248,220,.55)",
          }}
        >
          <span className="absolute inset-[5px] rounded-full border border-[#6d5226]/40" />
          <span
            className={`${cormorant.className} relative text-[1.9rem] font-semibold italic leading-none`}
            style={{ color: "#4a3816", textShadow: "0 1px 0 rgba(255,240,200,.45)" }}
          >
            V
          </span>
        </span>
      </span>
    </span>
  );
}

function Sheen() {
  return (
    <span
      aria-hidden
      className="vy-motion pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-500"
      style={{
        opacity: "var(--glare, 0)",
        mixBlendMode: "screen",
        backgroundImage:
          "radial-gradient(circle at var(--mx, 50%) var(--my, 0%), rgba(253,230,138,0.16), transparent 48%), linear-gradient(115deg, transparent 32%, rgba(226,232,240,0.07) 45%, rgba(253,230,138,0.11) 50%, rgba(226,232,240,0.06) 55%, transparent 68%)",
        backgroundSize: "100% 100%, 260% 260%",
        backgroundPosition: "0 0, var(--mx, 50%) var(--my, 50%)",
      }}
    />
  );
}

const FACE: CSSProperties = {
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
};

/** ромбы в углах рамки приглашения: центр ромба — точно в углу */
const CORNERS: CSSProperties[] = [
  { left: 9, top: 9, transform: "translate(-50%, -50%) rotate(45deg)" },
  { right: 9, top: 9, transform: "translate(50%, -50%) rotate(45deg)" },
  { left: 9, bottom: 9, transform: "translate(-50%, 50%) rotate(45deg)" },
  { right: 9, bottom: 9, transform: "translate(50%, 50%) rotate(45deg)" },
];

function InviteCard({
  t,
  lang,
  phase,
  exhausted,
  guestPreview,
  issued,
  patron,
  reduced,
}: {
  t: Dict;
  lang: Lang;
  phase: Phase;
  exhausted: boolean;
  guestPreview: string;
  issued: IssuedKey | null;
  patron: string;
  reduced: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const flipped = phase === "issued" && issued !== null;
  const sealVisible = phase !== "compose" || exhausted;

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === "touch") return;
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--rx", `${((0.5 - y) * 9).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((x - 0.5) * 12).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      el.style.setProperty("--glare", "1");
    });
  };

  const onPointerLeave = () => {
    const el = rootRef.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glare", "0");
  };

  const guest = phase === "compose" ? guestPreview : (issued?.guestName ?? guestPreview);

  return (
    <div
      ref={rootRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative w-full select-none"
      style={{ perspective: "1600px", aspectRatio: "7 / 5" }}
    >
      {/* наклон за курсором */}
      <div
        className="vy-motion absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
          transition: "transform 450ms cubic-bezier(.2,.7,.3,1)",
        }}
      >
        {/* переворот: конверт → приглашение */}
        <div
          className="vy-motion absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${flipped ? 180 : 0}deg)`,
            transition: `transform ${FLIP_MS}ms ${EASE}`,
          }}
        >
          {/* ── лицевая сторона: запечатанный конверт ── */}
          <div
            aria-hidden={flipped}
            className="absolute inset-0 overflow-hidden rounded-2xl border border-amber-200/15"
            style={{
              ...FACE,
              background: "linear-gradient(158deg, #1d1d21 0%, #151518 52%, #0f0f12 100%)",
              boxShadow: "0 30px 60px -30px rgba(0,0,0,.9), 0 0 0 1px rgba(0,0,0,.4)",
              opacity: exhausted && phase === "compose" ? 0.55 : 1,
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
              style={{ backgroundImage: NOISE }}
            />
            {/* сгибы конверта */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path
                d="M0 100 L50 54 L100 100"
                fill="none"
                stroke="rgba(253,230,138,0.08)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <path d="M0 0 L50 58 L100 0 Z" fill="rgba(255,255,255,0.025)" />
              <path
                d="M0 0 L50 58 L100 0"
                fill="none"
                stroke="rgba(253,230,138,0.28)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="pointer-events-none absolute inset-[10px] rounded-xl border border-amber-200/[0.07]" />

            <span className="absolute inset-x-0 top-[9%] flex flex-col items-center gap-1">
              <span className="pl-[0.5em] text-[10px] font-medium uppercase tracking-[0.5em] text-amber-200/70">
                Voyage
              </span>
              <span className={`${cormorant.className} text-xs italic text-amber-200/50`}>Sur invitation</span>
            </span>

            <WaxSeal visible={sealVisible} pressed={phase !== "compose"} />

            {/* блеск по воску в момент печати */}
            {phase === "sealing" && (
              <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                <span
                  className="vy-shimmer absolute inset-y-0 w-1/2"
                  style={{ background: "linear-gradient(100deg, transparent, rgba(253,230,138,.12), transparent)" }}
                />
              </span>
            )}

            <div className="absolute inset-x-5 bottom-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.envelopeFor}</p>
              <p
                className={`${cormorant.className} vy-env-name truncate italic ${
                  guest ? "text-slate-200" : "text-zinc-600"
                }`}
              >
                {guest || t.envelopeGuest}
              </p>
            </div>

            <Sheen />
          </div>

          {/* ── оборот: приглашение с ключом ── */}
          <div
            aria-hidden={!flipped}
            className="absolute inset-0 overflow-hidden rounded-2xl border border-amber-200/25"
            style={{
              ...FACE,
              transform: "rotateY(180deg)",
              background: "linear-gradient(160deg, #1a1a1d 0%, #111114 55%, #0b0b0d 100%)",
              boxShadow: "0 30px 60px -30px rgba(0,0,0,.9)",
            }}
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
              style={{ backgroundImage: NOISE }}
            />
            {/* двойная рамка и угловые ромбы */}
            <span className="pointer-events-none absolute inset-[9px] rounded-xl border border-amber-200/25" />
            <span className="pointer-events-none absolute inset-[13px] rounded-[10px] border border-amber-200/10" />
            {CORNERS.map((pos, i) => (
              <span key={i} className="pointer-events-none absolute h-1.5 w-1.5 bg-amber-200/60" style={pos} />
            ))}

            <div className="vy-back absolute inset-[13px] flex flex-col items-center justify-center px-5 text-center">
              <span className="shrink-0 pl-[0.55em] text-[9px] font-medium uppercase tracking-[0.55em] text-amber-200/70">
                Voyage
              </span>
              <p className={`${cormorant.className} vy-back-title shrink-0 italic text-slate-200`}>{t.invitation}</p>
              <p
                className={`${cormorant.className} vy-back-name max-w-full shrink-0 truncate font-medium text-amber-200`}
              >
                {issued?.guestName ?? ""}
              </p>
              <span className="vy-back-rule my-0.5 flex shrink-0 items-center gap-2 text-amber-200/40" aria-hidden>
                <span className="h-px w-8 bg-current" />
                <span className="h-1 w-1 rotate-45 bg-current" />
                <span className="h-px w-8 bg-current" />
              </span>
              <p className="max-w-full shrink-0 truncate text-[11px] text-slate-400">{t.sponsoredBy(patron)}</p>
              <p className="vy-back-label mt-1 shrink-0 text-[9px] uppercase tracking-[0.3em] text-zinc-500">
                {t.personalKey}
              </p>
              <p className="vy-back-code shrink-0 rounded-md border border-amber-200/20 bg-black/30 font-mono tracking-[0.2em] text-slate-100">
                {issued?.code ?? ""}
              </p>
              <p className="shrink-0 text-[10px] text-zinc-500">
                {issued ? t.validUntil(fmtDate(lang, issued.expiresAt)) : ""}
              </p>
            </div>

            <Sheen />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Кнопки ──────────────────────────────────────────────────────── */

const BTN_SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 text-sm text-slate-200 transition-colors hover:border-amber-200/30 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/50";

function CopyLabel({
  done,
  failed,
  icon: Icon,
  label,
  t,
}: {
  done: boolean;
  failed: boolean;
  icon: LucideIcon;
  label: string;
  t: Dict;
}) {
  const Glyph = done ? Check : Icon;
  return (
    <>
      <Glyph className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
      <span className="truncate">{done ? t.copied : failed ? t.copyFailed : label}</span>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * КЛЮЧИ СЕЗОНА
 * ══════════════════════════════════════════════════════════════════ */

function SeasonKeys({
  t,
  lang,
  season,
  seasonEndsAt,
  total,
  left,
  circle,
  quota,
}: {
  t: Dict;
  lang: Lang;
  season: number;
  seasonEndsAt: string;
  total: number;
  left: number;
  circle: CircleKey;
  quota: Record<CircleKey, number>;
}) {
  const used = Math.max(0, total - left);
  const rules: Array<[LucideIcon, string]> = [
    [KeyRound, t.ruleTtl(KEY_TTL_DAYS)],
    [Undo2, t.ruleReturn],
    [Flame, t.ruleBurn],
    [CalendarDays, t.ruleSeason],
  ];

  return (
    <aside className="flex flex-col gap-7 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 sm:p-7">
      <div>
        <Eyebrow>{t.seasonKeys(season)}</Eyebrow>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`${cormorant.className} text-6xl font-medium leading-none text-amber-200`}>{left}</span>
          <span className={`${cormorant.className} text-2xl text-zinc-500`}>/ {total}</span>
          <span className="ml-1 text-xs uppercase tracking-[0.2em] text-zinc-500">{t.keysRemaining}</span>
        </div>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label={t.seasonKeys(season)}>
          {Array.from({ length: total }, (_, i) => {
            const free = i >= used;
            return (
              <li
                key={i}
                title={free ? t.keyFree : t.keyUsed}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  free ? "border-amber-200/35 bg-amber-200/[0.06] text-amber-200" : "border-zinc-800 text-zinc-600"
                }`}
              >
                <KeyRound className="h-4 w-4" strokeWidth={1.25} aria-hidden />
                <span className="sr-only">{free ? t.keyFree : t.keyUsed}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">{t.renews(fmtDate(lang, seasonEndsAt))}</p>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">{t.quotaTitle}</p>
        <ol className="mt-3 space-y-1.5">
          {CIRCLES.map((c) => {
            const mine = c.key === circle;
            return (
              <li
                key={c.key}
                className={`flex items-baseline gap-2 text-sm ${mine ? "text-amber-200" : "text-zinc-400"}`}
                aria-current={mine ? "true" : undefined}
              >
                <span className="shrink-0">{c.title}</span>
                {mine && (
                  <span className="shrink-0 rounded-full border border-amber-200/30 px-1.5 py-px text-[10px] uppercase tracking-[0.15em]">
                    {t.yourCircle}
                  </span>
                )}
                <span
                  className="min-w-[1rem] flex-1 translate-y-[-3px] border-b border-dotted border-zinc-700"
                  aria-hidden
                />
                <span className="shrink-0 tabular-nums">{quota[c.key]}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <ul className="space-y-3 border-t border-zinc-800/80 pt-6">
        {rules.map(([Icon, text]) => (
          <li key={text} className="flex gap-3 text-[13px] leading-relaxed text-zinc-400">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300/70" strokeWidth={1.25} aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ПРОТЕЖЕ
 * ══════════════════════════════════════════════════════════════════ */

const STAGE_STYLE: Record<Stage, { icon: LucideIcon; cls: string }> = {
  sealed: { icon: Mail, cls: "border-slate-200/20 text-slate-300" },
  pending: { icon: Hourglass, cls: "border-amber-200/20 text-amber-200/80" },
  approved: { icon: DoorOpen, cls: "border-slate-200/25 text-slate-200" },
  touring: { icon: Plane, cls: "border-amber-200/30 text-amber-200" },
  inner: { icon: Crown, cls: "border-amber-200/45 bg-amber-200/[0.08] text-amber-100" },
  declined: { icon: Flame, cls: "border-zinc-800 text-zinc-500" },
  expired: { icon: Undo2, cls: "border-zinc-800 text-zinc-500" },
  burned: { icon: Flame, cls: "border-zinc-800 text-zinc-500" },
};

function StagePill({ stage, t }: { stage: Stage; t: Dict }) {
  const { icon: Icon, cls } = STAGE_STYLE[stage];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      {t.stage[stage]}
    </span>
  );
}

function Monogram({ name, url }: { name: string; url?: string | null }) {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={`${cormorant.className} text-lg text-slate-300`}>{initials(name)}</span>
      )}
    </span>
  );
}

function MilestoneTrail({ p, t }: { p: Protege; t: Dict }) {
  return (
    <span className="flex items-center gap-1.5">
      {MILESTONES.map((m, i) => {
        const done = p.milestones[m];
        const label = t.milestoneState(t.milestone[m], done);
        return (
          <span key={m} className="flex items-center gap-1.5">
            {i > 0 && <span className={`h-px w-3 ${done ? "bg-amber-200/50" : "bg-zinc-800"}`} aria-hidden />}
            <span title={label} className={`h-2 w-2 rotate-45 ${done ? "bg-amber-200" : "border border-zinc-600"}`} />
            <span className="sr-only">{label}</span>
          </span>
        );
      })}
    </span>
  );
}

function ProtegeRow({
  p,
  t,
  lang,
  div,
  copiedId,
  onCopy,
}: {
  p: Protege;
  t: Dict;
  lang: Lang;
  div: Record<Milestone, number>;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const stage = stageOf(p);
  const points = dividendsOf(p, div);
  const circle = stage === "approved" || stage === "touring" || stage === "inner" ? circleTitle(p.circleKey) : null;
  const muted = stage === "expired" || stage === "declined" || stage === "burned";
  const code = p.code;
  const copyId = `row-${p.id}`;

  const note =
    stage === "sealed"
      ? t.keyUntil(fmtDate(lang, p.expiresAt, "short"))
      : stage === "pending"
        ? t.pendingNote
        : stage === "expired"
          ? t.expiredNote
          : stage === "declined"
            ? t.declinedNote
            : stage === "burned"
              ? t.burnedNote
              : t.invitedOn(fmtDate(lang, p.invitedAt, "short"));

  return (
    <li className={`flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-6 ${muted ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-[1_1_13rem] items-center gap-4">
        <Monogram name={p.name} url={p.avatarUrl} />
        <div className="min-w-0">
          <p className={`${cormorant.className} truncate text-xl leading-tight text-slate-100`} title={p.name}>
            {p.name}
          </p>
          <p className="truncate text-xs text-zinc-500">{note}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StagePill stage={stage} t={t} />
        {circle && stage !== "inner" && (
          <span className="whitespace-nowrap rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            {circle}
          </span>
        )}
      </div>

      {!muted && (
        <div className="ml-auto flex w-[16rem] max-w-full flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {stage === "sealed" && code ? (
            <button
              type="button"
              onClick={() => onCopy(copyId, p.inviteUrl ?? inviteUrl(code))}
              aria-label={t.copyLinkFor(p.name)}
              title={t.copyLinkFor(p.name)}
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-zinc-800 px-3 font-mono text-xs tracking-[0.1em] text-slate-300 transition-colors hover:border-amber-200/30 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/50"
            >
              {copiedId === copyId ? (
                <Check className="h-3.5 w-3.5 text-amber-200" strokeWidth={1.5} aria-hidden />
              ) : (
                <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              )}
              <span>{copiedId === copyId ? t.copied : code}</span>
            </button>
          ) : (
            <MilestoneTrail p={p} t={t} />
          )}

          <p
            className={`${cormorant.className} w-20 shrink-0 text-right text-2xl leading-none ${
              points > 0 ? "text-amber-200" : "text-zinc-700"
            }`}
          >
            {points > 0 ? plus(points) : <span aria-hidden>—</span>}
          </p>
        </div>
      )}
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function InviteClient({ data = DEMO_INVITE_DATA, onIssueKey = demoIssueKey }: InviteClientProps) {
  const lang = useLang();
  const t = T[lang];
  const patron = usePatronName(data.patronName);
  const reduced = usePrefersReducedMotion();
  const canShare = useCanShare();
  const { copiedId, failedId, copy } = useCopy();

  const div = useMemo(() => ({ ...DEFAULT_DIVIDENDS, ...data.rules?.dividends }), [data.rules?.dividends]);
  const quota = useMemo(() => ({ ...DEFAULT_INVITE_QUOTA, ...data.rules?.quota }), [data.rules?.quota]);

  const circle: CircleKey = normalizeCircleKey(data.circleKey) ?? "voyager";
  const total = Math.max(0, Math.floor(data.keysTotal ?? quota[circle]));

  /* ключи, выданные в этой вкладке, пока сервер не прислал их в data */
  const [local, setLocal] = useState<Protege[]>([]);
  const known = useMemo(() => new Set(data.proteges.map((p) => p.code).filter(Boolean)), [data.proteges]);
  const pendingLocal = useMemo(() => local.filter((p) => !p.code || !known.has(p.code)), [local, known]);
  const proteges = useMemo(() => [...pendingLocal, ...data.proteges], [pendingLocal, data.proteges]);

  const used = Math.max(0, data.keysUsed) + pendingLocal.length;
  const left = Math.max(0, total - used);

  const [phase, setPhase] = useState<Phase>("compose");
  const [guest, setGuest] = useState("");
  const [issued, setIssued] = useState<IssuedKey | null>(null);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanGuest = guest.trim().replace(/\s+/g, " ");
  const valid = cleanGuest.length >= 2;
  const exhausted = left === 0;

  /* ── отличия ── */
  const achievements = useMemo(() => {
    const got = new Set<AchievementId>(data.achievements ?? []);
    const live = proteges.filter((p) => p.status !== "declined" && p.status !== "expired" && p.status !== "burned");
    if (live.some((p) => p.milestones.firstStamp)) got.add("club-scout");
    if (live.some((p) => p.milestones.innerCircle)) got.add("tastemaker");
    const admittedThisSeason = live.filter((p) => seasonOf(p) === data.season && p.milestones.approved).length;
    if (admittedThisSeason >= PATRON_GOAL) got.add("patron");
    return { got, admittedThisSeason };
  }, [proteges, data.achievements, data.season]);

  const earnedTotal = useMemo(() => proteges.reduce((s, p) => s + dividendsOf(p, div), 0), [proteges, div]);

  /* ── протеже по сезонам, свежие сверху ── */
  const groups = useMemo(() => {
    const by = new Map<number, Protege[]>();
    for (const p of proteges) {
      const s = seasonOf(p);
      by.set(s, [...(by.get(s) ?? []), p]);
    }
    return [...by.entries()]
      .sort(([a], [b]) => b - a)
      .map(([season, list]) => ({
        season,
        list: [...list].sort((a, b) => Date.parse(b.invitedAt) - Date.parse(a.invitedAt)),
      }));
  }, [proteges]);

  /* ── запечатать ключ ── */
  const seal = async () => {
    if (!valid || phase !== "compose" || exhausted) return;
    setError(false);
    setPhase("sealing");
    try {
      const [key] = await Promise.all([onIssueKey(cleanGuest), wait(reduced ? 0 : SEAL_MS)]);
      const name = key.guestName?.trim() || cleanGuest;
      setIssued({ ...key, guestName: name });
      setLocal((prev) => [
        {
          id: `local-${key.code}`,
          code: key.code,
          inviteUrl: key.url,
          name,
          invitedAt: new Date().toISOString(),
          expiresAt: key.expiresAt,
          season: data.season,
          status: "sealed",
          milestones: NO_MILESTONES,
        },
        ...prev,
      ]);
      setPhase("issued");
    } catch {
      setError(true);
      setPhase("compose");
    }
  };

  const focusInput = useRef(false);
  useEffect(() => {
    if (phase === "compose" && focusInput.current) {
      focusInput.current = false;
      inputRef.current?.focus();
    }
  }, [phase]);

  const another = () => {
    focusInput.current = true;
    setPhase("compose");
    setGuest("");
    setError(false);
  };

  const inviteText = issued
    ? t.inviteText({
        guest: issued.guestName,
        patron,
        code: issued.code,
        url: issued.url,
        date: fmtDate(lang, issued.expiresAt),
      })
    : "";

  const share = async () => {
    if (!issued) return;
    try {
      await navigator.share({ title: "Voyage", text: inviteText });
    } catch {
      /* закрыли окно — ничего не делаем */
    }
  };

  const hasScout = achievements.got.has("club-scout");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 antialiased">
      <style>{INVITE_CSS}</style>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-8 sm:py-14">
        {/* ── шапка ── */}
        <header className="max-w-3xl">
          <Eyebrow>Voyage · Patronage</Eyebrow>
          <h1 className={`${cormorant.className} mt-3 text-4xl font-medium leading-[1.05] text-slate-100 sm:text-5xl`}>
            {t.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">{t.lead}</p>
          <p className="mt-5 flex gap-3 border-l border-amber-200/30 pl-4 text-[15px] leading-relaxed text-slate-300">
            <span>{t.hint(plus(div.firstStamp)) + (hasScout ? t.hintEnd : t.hintScout)}</span>
          </p>
        </header>

        {/* ── ключ и квота ── */}
        <section
          className="grid items-start gap-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))" }}
        >
          <div className="flex flex-col gap-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 p-5 sm:p-8">
            <div className="vy-cardbox mx-auto w-full max-w-[28rem]">
              <InviteCard
                t={t}
                lang={lang}
                phase={phase}
                exhausted={exhausted}
                guestPreview={cleanGuest}
                issued={issued}
                patron={patron}
                reduced={reduced}
              />
            </div>

            <p className="sr-only" aria-live="polite">
              {phase === "issued" && issued ? t.srSealed(issued.code) : ""}
            </p>

            {phase === "issued" && issued ? (
              <div className="mx-auto flex w-full max-w-[28rem] flex-col gap-3">
                <div className="flex h-12 items-center gap-3 rounded-xl border border-amber-200/20 bg-black/30 pl-4 pr-1.5">
                  <KeyRound className="h-4 w-4 shrink-0 text-amber-200/70" strokeWidth={1.25} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-mono text-sm tracking-[0.2em] text-slate-100">
                    {issued.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy("key", issued.code)}
                    title={t.copyKey}
                    aria-label={t.copyKey}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/50"
                  >
                    {copiedId === "key" ? (
                      <Check className="h-4 w-4 text-amber-200" strokeWidth={1.5} aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => copy("link", issued.url)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-200 px-5 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                >
                  <CopyLabel
                    done={copiedId === "link"}
                    failed={failedId === "link"}
                    icon={Link2}
                    label={t.copyLink}
                    t={t}
                  />
                </button>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copy("text", inviteText)}
                    className={`${BTN_SECONDARY} min-w-0 flex-[1_1_12rem]`}
                  >
                    <CopyLabel
                      done={copiedId === "text"}
                      failed={failedId === "text"}
                      icon={Copy}
                      label={t.copyInvite}
                      t={t}
                    />
                  </button>
                  {canShare && (
                    <button type="button" onClick={share} className={`${BTN_SECONDARY} flex-[1_1_8rem]`}>
                      <Share2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                      {t.share}
                    </button>
                  )}
                </div>

                <p className="text-center text-xs leading-relaxed text-zinc-500">{t.issuedNote}</p>

                {left > 0 ? (
                  <button
                    type="button"
                    onClick={another}
                    className="mx-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:text-amber-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-200/50"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.25} aria-hidden />
                    {t.another}
                  </button>
                ) : (
                  <p className="text-center text-xs text-zinc-500">
                    {t.exhaustedNote(fmtDate(lang, data.seasonEndsAt))}
                  </p>
                )}
              </div>
            ) : exhausted ? (
              <div className="mx-auto w-full max-w-[28rem] text-center">
                <p className={`${cormorant.className} text-2xl text-slate-200`}>{t.exhaustedTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  {t.exhaustedNote(fmtDate(lang, data.seasonEndsAt))}
                </p>
              </div>
            ) : (
              <form
                className="mx-auto w-full max-w-[28rem]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void seal();
                }}
              >
                <label htmlFor="vy-guest" className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                  {t.forWhom}
                </label>
                <input
                  ref={inputRef}
                  id="vy-guest"
                  value={guest}
                  onChange={(e) => {
                    setGuest(e.target.value);
                    if (error) setError(false);
                  }}
                  disabled={phase === "sealing"}
                  maxLength={60}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t.namePlaceholder}
                  aria-describedby="vy-guest-note"
                  className="mt-2 h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 text-[15px] text-slate-100 transition-colors placeholder:text-zinc-600 focus:border-amber-200/40 focus:outline-none focus:ring-1 focus:ring-amber-200/30 disabled:opacity-60"
                />
                <p id="vy-guest-note" className="mt-2 text-xs leading-relaxed text-zinc-500">
                  {t.nameNote}
                </p>
                <button
                  type="submit"
                  disabled={!valid || phase === "sealing"}
                  aria-busy={phase === "sealing"}
                  className={`mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                    phase === "sealing"
                      ? "cursor-wait border-transparent bg-amber-200/80 text-zinc-950"
                      : valid
                        ? "border-transparent bg-amber-200 text-zinc-950 hover:bg-amber-100"
                        : "cursor-not-allowed border-amber-200/20 bg-transparent text-amber-200/40"
                  }`}
                >
                  <Stamp
                    className={`h-4 w-4 ${phase === "sealing" ? "vy-breathe" : ""}`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {phase === "sealing" ? t.sealing : t.seal}
                </button>
                {error && (
                  <p role="alert" className="mt-3 text-center text-sm text-amber-200/90">
                    {t.sealError}
                  </p>
                )}
              </form>
            )}
          </div>

          <SeasonKeys
            t={t}
            lang={lang}
            season={data.season}
            seasonEndsAt={data.seasonEndsAt}
            total={total}
            left={left}
            circle={circle}
            quota={quota}
          />
        </section>

        {/* ── дивиденды ── */}
        <section className="vy-trio-box space-y-6">
          <SectionHead eyebrow="Dividendes" title={t.divTitle} />
          <p className="max-w-2xl text-[15px] leading-relaxed text-zinc-400">
            {t.divLead(fmtPoints(dividendMax(div)))}
          </p>
          <ol className="vy-trio">
            {MILESTONES.map((m, i) => (
              <li key={m} className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 p-6">
                <div className="flex items-center justify-between">
                  <Medallion icon={[DoorOpen, Stamp, Crown][i]} lit size="sm" />
                  <span className={`${cormorant.className} text-lg italic text-zinc-600`}>{["I", "II", "III"][i]}</span>
                </div>
                <div>
                  <p className={`${cormorant.className} text-4xl font-medium leading-none text-amber-200`}>
                    {plus(div[m])}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{t.toIndex}</p>
                </div>
                <div>
                  <p className="text-[15px] text-slate-200">{t.milestone[m]}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{t.milestoneNote[m]}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── отличия ── */}
        <section className="vy-trio-box space-y-6">
          <SectionHead eyebrow="Distinctions" title={t.achTitle} />
          <ul className="vy-trio">
            {(
              [
                ["club-scout", "Club Scout", Telescope],
                ["patron", "Patron", Feather],
                ["tastemaker", "Tastemaker", Gem],
              ] as const
            ).map(([id, name, icon]) => {
              const got = achievements.got.has(id);
              const progress = id === "patron" && !got ? Math.min(achievements.admittedThisSeason, PATRON_GOAL) : null;
              return (
                <li
                  key={id}
                  className={`vy-ach rounded-2xl border p-6 ${
                    got ? "border-amber-200/20 bg-amber-200/[0.03]" : "border-zinc-800/80 bg-zinc-900/20"
                  }`}
                >
                  <Medallion icon={icon} lit={got} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`${cormorant.className} text-2xl leading-tight ${got ? "text-amber-100" : "text-slate-300"}`}
                    >
                      {name}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-500">{t.achNote[id]}</p>
                    {got ? (
                      <p className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-amber-200/80">
                        <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                        {t.earned}
                      </p>
                    ) : progress !== null ? (
                      <div className="mt-3 flex items-center gap-3">
                        <span className="relative h-px flex-1 bg-zinc-800">
                          <span
                            className="absolute inset-y-0 left-0 bg-amber-200/70"
                            style={{ width: `${(progress / PATRON_GOAL) * 100}%` }}
                          />
                        </span>
                        <span className="text-xs tabular-nums text-zinc-400">
                          {progress} / {PATRON_GOAL}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-zinc-600">{t.ahead}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── мои протеже ── */}
        <section className="space-y-6">
          <SectionHead
            eyebrow="Protégées"
            title={t.protegesTitle}
            aside={
              earnedTotal > 0 ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">{t.broughtYou}</p>
                  <p className={`${cormorant.className} text-3xl leading-tight text-amber-200`}>
                    {plus(earnedTotal)}
                    <span className="ml-2 align-middle font-sans text-xs tracking-[0.18em] text-zinc-500">
                      Influence Index
                    </span>
                  </p>
                </div>
              ) : undefined
            }
          />

          {proteges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-14 text-center">
              <span className="mx-auto flex w-fit">
                <Medallion icon={KeyRound} lit={false} />
              </span>
              <p className={`${cormorant.className} mt-4 text-2xl text-slate-200`}>{t.emptyTitle}</p>
              <p className="mt-2 text-sm text-zinc-500">{t.emptyNote}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/20">
              {groups.map(({ season, list }, gi) => (
                <div key={season} className={gi > 0 ? "border-t border-zinc-800/80" : ""}>
                  {groups.length > 1 && (
                    <p className="bg-zinc-900/40 px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] text-zinc-500 sm:px-6">
                      {t.season(season)}
                    </p>
                  )}
                  <ul className="divide-y divide-zinc-800/80">
                    {list.map((p) => (
                      <ProtegeRow key={p.id} p={p} t={t} lang={lang} div={div} copiedId={copiedId} onCopy={copy} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-zinc-900 pt-8 text-center">
          <p className={`${cormorant.className} text-lg italic text-zinc-500`}>{t.footer}</p>
        </footer>
      </div>
    </div>
  );
}
