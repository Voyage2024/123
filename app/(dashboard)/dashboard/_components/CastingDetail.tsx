"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЗИДЕНТКА — подробности кастинга
 * app/(dashboard)/dashboard/_components/CastingDetail.tsx
 * Страница: app/(dashboard)/dashboard/castings/[id]/page.tsx
 *
 * Резидентка открывает кастинг из ленты (вся карточка — ссылка, плюс
 * кнопка «Подробнее»), спокойно читает все условия и только потом
 * отвечает «Готова в тур».
 *
 * Данные — fetchCastingDetail (_lib/castingFeed.ts): та же RPC
 * partner_resident_feed(), что и у ленты. Отсюда три гарантии:
 *   · видимость = правилам ленты (сегмент, одобрение, бан, Blacklist,
 *     личное приглашение, её активные отклики) — ничего нового;
 *   · условия — из строки partner_castings, а не из шаблона тура:
 *     правки менеджера видны сразу (страница всегда читает базу заново);
 *   · Blind Selection: о менеджере — только репутация (Ключ, оценка,
 *     число туров), имя — лишь у тура клуба (VOYAGE Management).
 *     Ни имени, ни контактов резидентки страница никуда не отправляет.
 *
 * Отклик и отзыв — те же функции, что в ленте (_lib/actions.ts:
 * applyToCasting, withdrawResponse, declineInvite, setOpenToTours);
 * права проверяет база (partner_me_can_respond, RLS).
 *
 * Менеджер, admin и owner отсюда уходят на свою страницу кастинга
 * /partner/castings/[id] — там их права (RLS partner_castings).
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BedDouble,
  CalendarDays,
  Check,
  Clock,
  Coins,
  FileCheck2,
  Globe2,
  Hourglass,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  MapPin,
  Plane,
  Ruler,
  ScrollText,
  SearchX,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { STAFF_ROLES } from "@/lib/rbac";
import { DAY } from "@/app/(dashboard)/partner/_lib/clock";
import type { Payer } from "@/app/(dashboard)/partner/_lib/command";
import { usePartnerFormat } from "@/app/(dashboard)/partner/_lib/format";
import { PILL, TIER_LABEL, TIER_TEXT, cormorant, type Tone } from "@/app/(dashboard)/partner/_components/PartnerUI";
import {
  fetchCastingDetail,
  isCastingId,
  type CastingDetailData,
  type CastingStatus,
  type FeedCasting,
  type ResidentProfile,
} from "@/app/(dashboard)/dashboard/_lib/castingFeed";
import { applyToCasting, declineInvite, setOpenToTours, withdrawResponse } from "@/app/(dashboard)/dashboard/_lib/actions";
import {
  ApplyStub,
  CASTING_FEED_COPY,
  OpenToToursSwitch,
  Requirement,
  hasReply,
  type CastingFailure,
  type Fit,
  type Pending,
  type Response,
} from "@/app/(dashboard)/dashboard/_components/CastingFeed";
import CastingAccessBanner, { hardBlocker, lockedLabel } from "@/app/(dashboard)/dashboard/_components/CastingAccessBanner";
import KycLevelBadge from "@/app/components/profile/KycLevelBadge";
import { kycCopy, toKycLevel } from "@/lib/kyc-levels";
import { countryFlag, countryName } from "@/lib/countries";
import { pickI18n, pickedLang } from "@/lib/casting-i18n";

const LIST_HREF = "/dashboard/castings";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

/** Статус для резидентки: статус кастинга + срок приёма откликов */
/** stopped — без миграции статуса: срок не истёк, допуск есть, а база отклик не пускает (отбор / набор закрыт) */
type State = CastingStatus | "deadline" | "stopped";

type Dict = {
  back: string;
  loading: string;
  loadError: string;
  retry: string;
  redirecting: string;
  unavailable: { title: string; text: string; reasons: string[] };
  sections: { main: string; money: string; requirements: string; description: string; manager: string; response: string };
  main: {
    destination: string;
    tour: string;
    noTour: string;
    starts: string;
    ends: string;
    duration: string;
    slots: string;
    deadline: string;
    status: string;
  };
  days: (n: number) => string;
  slots: (n: number) => string;
  state: Record<State, string>;
  stateTone: Record<State, Tone>;
  money: { fee: string; feeOpen: string; currency: string; currencyOpen: string; flight: string; hotel: string };
  payer: Record<Payer, string>;
  req: {
    height: string;
    heightNone: string;
    heightValue: (cm: number) => string;
    languages: string;
    languagesNone: string;
    passport: string;
    passportText: string;
    country: (name: string) => string;
    kyc: string;
    documents: string;
    documentsBasic: string;
    fit: Record<Fit, string>;
  };
  desc: {
    brief: string;
    briefNone: string;
    original: (code: string) => string;
    tourRequirements: string;
    tourConditions: string;
    tourAbout: string;
    fromTour: string;
    extra: string;
  };
  manager: { label: string; isNew: string; club: string };
  closedText: Record<Exclude<State, "open">, string>;
  sent: string;
  withdrawn: string;
  blind: string;
  accessTitle: string;
};

const T: Record<Lang, Dict> = {
  RU: {
    back: "Все кастинги",
    loading: "Загружаем условия кастинга…",
    loadError: "Не удалось загрузить кастинг. Проверьте соединение и попробуйте ещё раз.",
    retry: "Повторить",
    redirecting: "Открываем кастинг в кабинете менеджера…",
    unavailable: {
      title: "Кастинг недоступен",
      text: "Этот кастинг сейчас нельзя открыть. Возможные причины:",
      reasons: [
        "приём откликов завершён или кастинг закрыт менеджером;",
        "кастинг удалён или перенесён в архив;",
        "кастинг объявлен для другого сегмента клуба;",
        "ссылка неполная или с ошибкой.",
      ],
    },
    sections: {
      main: "Основная информация",
      money: "Финансовые условия",
      requirements: "Требования",
      description: "Описание",
      manager: "Организатор",
      response: "Ваш отклик",
    },
    main: {
      destination: "Направление и город",
      tour: "Тур из каталога",
      noTour: "Без привязки к туру",
      starts: "Начало",
      ends: "Окончание",
      duration: "Продолжительность",
      slots: "Мест в составе",
      deadline: "Отклики до",
      status: "Статус",
    },
    days: (n) => `${n} ${ruDays(n)}`,
    slots: (n) => `${n}`,
    state: {
      open: "Приём откликов открыт",
      shortlist: "Идёт отбор",
      closed: "Набор закрыт",
      cancelled: "Кастинг отменён",
      archived: "В архиве",
      deadline: "Приём откликов завершён",
      stopped: "Новые отклики не принимаются",
    },
    stateTone: { open: "emerald", shortlist: "gold", closed: "zinc", cancelled: "rose", archived: "zinc", deadline: "zinc", stopped: "gold" },
    money: {
      fee: "Гонорар",
      feeOpen: "Обсуждается",
      currency: "Валюта",
      currencyOpen: "Уточняется вместе с гонораром",
      flight: "Перелёт",
      hotel: "Проживание",
    },
    payer: { manager: "Оплачивает менеджер", participant: "Оплачиваете вы", split: "Пополам" },
    req: {
      height: "Минимальный рост",
      heightNone: "Без требований",
      heightValue: (cm) => `от ${cm} см`,
      languages: "Языки",
      languagesNone: "Без требований",
      passport: "Паспорт и виза",
      passportText:
        "Отдельных требований к паспорту и визе в кастинге не указано. Если они есть, менеджер пишет их в описании ниже. Проверьте срок действия загранпаспорта на даты поездки.",
      country: (name) => `Страна поездки: ${name}`,
      kyc: "Уровень KYC",
      documents: "Документы",
      documentsBasic: "Достаточно профиля хотя бы с одним фото.",
      fit: { ok: "подходит", miss: "не совпадает · откликнуться можно", unknown: "не указано в профиле" },
    },
    desc: {
      brief: "Описание кастинга",
      briefNone: "Менеджер не добавил описание. Все условия — в блоках выше.",
      original: (code) => `Оригинал на ${code}`,
      tourRequirements: "Требования к участнице",
      tourConditions: "Базовые условия",
      tourAbout: "О туре",
      fromTour: "из описания тура",
      extra: "Дополнительно",
    },
    manager: { label: "Менеджер клуба", isNew: "новый", club: "Официальный тур клуба" },
    closedText: {
      shortlist: "Менеджер уже отбирает участниц, новые отклики не принимаются.",
      closed: "Состав набран, новые отклики не принимаются.",
      cancelled: "Кастинг отменён. Следите за новыми — они придут в Telegram.",
      archived: "Кастинг перенесён в архив и больше не принимает отклики.",
      deadline: "Срок приёма откликов истёк.",
      stopped: "Менеджер уже отбирает участниц или состав набран — новые отклики не принимаются.",
    },
    sent: "Отклик отправлен. Менеджер видит его без вашего имени и контактов — они откроются только после рукопожатия.",
    withdrawn: "Отклик отозван. Пока кастинг открыт, можно откликнуться снова.",
    blind:
      "Слепой отбор: до рукопожатия менеджер не видит ваше имя и контакты, а вы — его. Пока менеджер не ответил, отклик можно отозвать без последствий.",
    accessTitle: "Что нужно для отклика",
  },
  EN: {
    back: "All castings",
    loading: "Loading the casting terms…",
    loadError: "Couldn’t load the casting. Check your connection and try again.",
    retry: "Try again",
    redirecting: "Opening the casting in the manager workspace…",
    unavailable: {
      title: "Casting unavailable",
      text: "This casting can’t be opened right now. Possible reasons:",
      reasons: [
        "replies are closed or the manager closed the casting;",
        "the casting was deleted or archived;",
        "the casting is for another club segment;",
        "the link is incomplete or mistyped.",
      ],
    },
    sections: {
      main: "Key details",
      money: "Financial terms",
      requirements: "Requirements",
      description: "Description",
      manager: "Organizer",
      response: "Your reply",
    },
    main: {
      destination: "Destination & city",
      tour: "Catalog tour",
      noTour: "Not linked to a tour",
      starts: "Starts",
      ends: "Ends",
      duration: "Duration",
      slots: "Spots in the crew",
      deadline: "Replies until",
      status: "Status",
    },
    days: (n) => `${n} ${n === 1 ? "day" : "days"}`,
    slots: (n) => `${n}`,
    state: {
      open: "Open for replies",
      shortlist: "Selection in progress",
      closed: "Crew complete",
      cancelled: "Casting cancelled",
      archived: "Archived",
      deadline: "Replies closed",
      stopped: "No new replies accepted",
    },
    stateTone: { open: "emerald", shortlist: "gold", closed: "zinc", cancelled: "rose", archived: "zinc", deadline: "zinc", stopped: "gold" },
    money: {
      fee: "Fee",
      feeOpen: "Negotiable",
      currency: "Currency",
      currencyOpen: "Agreed together with the fee",
      flight: "Flight",
      hotel: "Accommodation",
    },
    payer: { manager: "Paid by the manager", participant: "Paid by you", split: "Split" },
    req: {
      height: "Minimum height",
      heightNone: "No requirement",
      heightValue: (cm) => `from ${cm} cm`,
      languages: "Languages",
      languagesNone: "No requirement",
      passport: "Passport & visa",
      passportText:
        "The casting lists no separate passport or visa requirements. If there are any, the manager writes them in the description below. Check that your passport is valid for the travel dates.",
      country: (name) => `Destination country: ${name}`,
      kyc: "KYC level",
      documents: "Documents",
      documentsBasic: "A profile with at least one photo is enough.",
      fit: { ok: "matches", miss: "doesn’t match · you can still reply", unknown: "not in your profile" },
    },
    desc: {
      brief: "Casting description",
      briefNone: "The manager added no description. All terms are in the sections above.",
      original: (code) => `Original in ${code}`,
      tourRequirements: "Participant requirements",
      tourConditions: "Basic conditions",
      tourAbout: "About the tour",
      fromTour: "from the tour description",
      extra: "Additional information",
    },
    manager: { label: "Club manager", isNew: "new", club: "Official club tour" },
    closedText: {
      shortlist: "The manager is already selecting participants; new replies aren’t accepted.",
      closed: "The crew is complete; new replies aren’t accepted.",
      cancelled: "The casting was cancelled. New ones will arrive in Telegram.",
      archived: "The casting was archived and no longer accepts replies.",
      deadline: "The reply deadline has passed.",
      stopped: "The manager is already selecting or the crew is complete — new replies aren’t accepted.",
    },
    sent: "Reply sent. The manager sees it without your name and contacts — they open only after the handshake.",
    withdrawn: "Reply withdrawn. While the casting is open you can reply again.",
    blind:
      "Blind selection: until the handshake the manager doesn’t see your name or contacts, and you don’t see theirs. Until the manager responds you can withdraw at no cost.",
    accessTitle: "What you need to reply",
  },
  ES: {
    back: "Todos los castings",
    loading: "Cargando las condiciones del casting…",
    loadError: "No se pudo cargar el casting. Revisa la conexión e inténtalo de nuevo.",
    retry: "Reintentar",
    redirecting: "Abriendo el casting en el panel del gerente…",
    unavailable: {
      title: "Casting no disponible",
      text: "Este casting no se puede abrir ahora. Posibles motivos:",
      reasons: [
        "las respuestas están cerradas o el gerente cerró el casting;",
        "el casting fue eliminado o archivado;",
        "el casting es para otro segmento del club;",
        "el enlace está incompleto o tiene un error.",
      ],
    },
    sections: {
      main: "Información principal",
      money: "Condiciones económicas",
      requirements: "Requisitos",
      description: "Descripción",
      manager: "Organizador",
      response: "Tu respuesta",
    },
    main: {
      destination: "Destino y ciudad",
      tour: "Tour del catálogo",
      noTour: "Sin tour vinculado",
      starts: "Inicio",
      ends: "Fin",
      duration: "Duración",
      slots: "Plazas en el equipo",
      deadline: "Respuestas hasta",
      status: "Estado",
    },
    days: (n) => `${n} ${n === 1 ? "día" : "días"}`,
    slots: (n) => `${n}`,
    state: {
      open: "Abierto a respuestas",
      shortlist: "Selección en curso",
      closed: "Equipo completo",
      cancelled: "Casting cancelado",
      archived: "Archivado",
      deadline: "Respuestas cerradas",
      stopped: "No se aceptan nuevas respuestas",
    },
    stateTone: { open: "emerald", shortlist: "gold", closed: "zinc", cancelled: "rose", archived: "zinc", deadline: "zinc", stopped: "gold" },
    money: {
      fee: "Honorarios",
      feeOpen: "A negociar",
      currency: "Moneda",
      currencyOpen: "Se acuerda junto con los honorarios",
      flight: "Vuelo",
      hotel: "Alojamiento",
    },
    payer: { manager: "Lo paga el gerente", participant: "Lo pagas tú", split: "A medias" },
    req: {
      height: "Estatura mínima",
      heightNone: "Sin requisito",
      heightValue: (cm) => `desde ${cm} cm`,
      languages: "Idiomas",
      languagesNone: "Sin requisito",
      passport: "Pasaporte y visado",
      passportText:
        "El casting no indica requisitos aparte de pasaporte o visado. Si los hay, el gerente los escribe en la descripción. Comprueba que tu pasaporte sea válido para las fechas del viaje.",
      country: (name) => `País de destino: ${name}`,
      kyc: "Nivel KYC",
      documents: "Documentos",
      documentsBasic: "Basta un perfil con al menos una foto.",
      fit: { ok: "coincide", miss: "no coincide · puedes responder", unknown: "no está en tu perfil" },
    },
    desc: {
      brief: "Descripción del casting",
      briefNone: "El gerente no añadió descripción. Todas las condiciones están arriba.",
      original: (code) => `Original en ${code}`,
      tourRequirements: "Requisitos para la participante",
      tourConditions: "Condiciones básicas",
      tourAbout: "Sobre el tour",
      fromTour: "de la descripción del tour",
      extra: "Información adicional",
    },
    manager: { label: "Gerente del club", isNew: "nuevo", club: "Tour oficial del club" },
    closedText: {
      shortlist: "El gerente ya está seleccionando; no se aceptan nuevas respuestas.",
      closed: "El equipo está completo; no se aceptan nuevas respuestas.",
      cancelled: "El casting se canceló. Los nuevos llegarán por Telegram.",
      archived: "El casting está archivado y ya no acepta respuestas.",
      deadline: "El plazo de respuestas terminó.",
      stopped: "El gerente ya está seleccionando o el equipo está completo: no se aceptan nuevas respuestas.",
    },
    sent: "Respuesta enviada. El gerente la ve sin tu nombre ni contactos: se abren solo tras el apretón de manos.",
    withdrawn: "Respuesta retirada. Mientras el casting esté abierto puedes responder de nuevo.",
    blind:
      "Selección a ciegas: hasta el apretón de manos el gerente no ve tu nombre ni tus contactos, ni tú los suyos. Mientras no responda, puedes retirar tu respuesta sin consecuencias.",
    accessTitle: "Qué necesitas para responder",
  },
  PT: {
    back: "Todos os castings",
    loading: "Carregando as condições do casting…",
    loadError: "Não foi possível carregar o casting. Verifique a conexão e tente de novo.",
    retry: "Tentar de novo",
    redirecting: "Abrindo o casting no painel do gerente…",
    unavailable: {
      title: "Casting indisponível",
      text: "Este casting não pode ser aberto agora. Motivos possíveis:",
      reasons: [
        "as respostas foram encerradas ou o gerente fechou o casting;",
        "o casting foi excluído ou arquivado;",
        "o casting é para outro segmento do clube;",
        "o link está incompleto ou com erro.",
      ],
    },
    sections: {
      main: "Informações principais",
      money: "Condições financeiras",
      requirements: "Requisitos",
      description: "Descrição",
      manager: "Organizador",
      response: "Sua resposta",
    },
    main: {
      destination: "Destino e cidade",
      tour: "Tour do catálogo",
      noTour: "Sem tour vinculado",
      starts: "Início",
      ends: "Fim",
      duration: "Duração",
      slots: "Vagas na equipe",
      deadline: "Respostas até",
      status: "Status",
    },
    days: (n) => `${n} ${n === 1 ? "dia" : "dias"}`,
    slots: (n) => `${n}`,
    state: {
      open: "Aberto a respostas",
      shortlist: "Seleção em andamento",
      closed: "Equipe completa",
      cancelled: "Casting cancelado",
      archived: "Arquivado",
      deadline: "Respostas encerradas",
      stopped: "Novas respostas não são aceitas",
    },
    stateTone: { open: "emerald", shortlist: "gold", closed: "zinc", cancelled: "rose", archived: "zinc", deadline: "zinc", stopped: "gold" },
    money: {
      fee: "Cachê",
      feeOpen: "A combinar",
      currency: "Moeda",
      currencyOpen: "Combinada junto com o cachê",
      flight: "Voo",
      hotel: "Hospedagem",
    },
    payer: { manager: "Pago pelo gerente", participant: "Pago por você", split: "Dividido" },
    req: {
      height: "Altura mínima",
      heightNone: "Sem exigência",
      heightValue: (cm) => `a partir de ${cm} cm`,
      languages: "Idiomas",
      languagesNone: "Sem exigência",
      passport: "Passaporte e visto",
      passportText:
        "O casting não lista exigências separadas de passaporte ou visto. Se houver, o gerente as escreve na descrição. Confira se o passaporte é válido para as datas da viagem.",
      country: (name) => `País de destino: ${name}`,
      kyc: "Nível KYC",
      documents: "Documentos",
      documentsBasic: "Basta um perfil com pelo menos uma foto.",
      fit: { ok: "confere", miss: "não confere · pode responder", unknown: "não está no seu perfil" },
    },
    desc: {
      brief: "Descrição do casting",
      briefNone: "O gerente não adicionou descrição. Todas as condições estão acima.",
      original: (code) => `Original em ${code}`,
      tourRequirements: "Requisitos para a participante",
      tourConditions: "Condições básicas",
      tourAbout: "Sobre o tour",
      fromTour: "da descrição do tour",
      extra: "Informações adicionais",
    },
    manager: { label: "Gerente do clube", isNew: "novo", club: "Tour oficial do clube" },
    closedText: {
      shortlist: "O gerente já está selecionando; novas respostas não são aceitas.",
      closed: "A equipe está completa; novas respostas não são aceitas.",
      cancelled: "O casting foi cancelado. Os novos chegam pelo Telegram.",
      archived: "O casting foi arquivado e não aceita mais respostas.",
      deadline: "O prazo de respostas terminou.",
      stopped: "O gerente já está selecionando ou a equipe está completa — novas respostas não são aceitas.",
    },
    sent: "Resposta enviada. O gerente a vê sem seu nome e contatos — eles abrem só após o aperto de mão.",
    withdrawn: "Resposta retirada. Enquanto o casting estiver aberto, dá para responder de novo.",
    blind:
      "Seleção às cegas: até o aperto de mão o gerente não vê seu nome nem seus contatos, e você não vê os dele. Enquanto ele não responder, dá para retirar a resposta sem consequências.",
    accessTitle: "O que falta para responder",
  },
};

function ruDays(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "дня";
  return "дней";
}

/** «EN» → «английский» на языке интерфейса */
function languageName(code: string, lang: Lang): string {
  try {
    const dn = new Intl.DisplayNames([lang.toLowerCase()], { type: "language" });
    return dn.of(code.toLowerCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * Статус для резидентки. С миграцией 20261126090000 — точный (partner_castings.status).
 * Без неё — из срока и can_respond: если срок не истёк, KYC и тумблер в порядке
 * (или есть приглашение), а база отклик не пускает — значит кастинг уже не 'open'.
 */
export function castingState(c: FeedCasting, me: ResidentProfile, now: number): State {
  if (c.status && c.status !== "open") return c.status;
  if (c.closesAt <= now) return "deadline";
  if (c.status === null && !c.canRespond && ((c.kycOk && me.openToTours) || c.invite)) return "stopped";
  return "open";
}

/* ══════════════════════════════════════════════════════════════════
 * МЕЛКИЕ БЛОКИ
 * ══════════════════════════════════════════════════════════════════ */

const GLASS =
  "rounded-[1.4rem] border border-zinc-800/80 bg-gradient-to-b from-zinc-900/60 to-zinc-950/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] backdrop-blur-xl";

function Section({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${GLASS} p-5 sm:p-6`}>
      <h2 id={id} className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-amber-100/70">
        <Icon className="size-3.5 text-amber-200/80" strokeWidth={1.75} aria-hidden />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ icon: Icon, label, children, wide = false }: { icon: LucideIcon; label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 bg-zinc-950/80 px-4 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-zinc-500">
        <Icon className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1 break-words text-sm leading-snug text-zinc-100">{children}</dd>
    </div>
  );
}

function FactGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-800/70 bg-zinc-800/70 sm:grid-cols-2">
      {children}
    </dl>
  );
}

function Prose({ title, hint, children }: { title: string; hint?: string | null; children: string }) {
  return (
    <div className="border-t border-zinc-800/70 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
        {title}
        {hint && <span className="ml-2 normal-case tracking-normal text-zinc-600">· {hint}</span>}
      </h3>
      <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-200">{children}</p>
    </div>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href={LIST_HREF}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-900/50 px-4 text-xs tracking-wide text-zinc-300 backdrop-blur-xl transition hover:border-amber-200/40 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 sm:min-h-9"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {label}
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: CastingDetailData };

export default function CastingDetail({ castingId }: { castingId: string }) {
  const { lang } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const staff = !!role && STAFF_ROLES.includes(role);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Менеджер / admin / owner — на свою страницу кастинга (их права — там)
  useEffect(() => {
    if (staff) router.replace(isCastingId(castingId) ? `/partner/castings/${castingId}` : "/partner/castings");
  }, [staff, castingId, router]);

  useEffect(() => {
    if (authLoading || staff) return;
    let alive = true;
    fetchCastingDetail(castingId)
      .then((data) => alive && setLoad({ kind: "ready", data }))
      .catch((e: unknown) => {
        console.error("[casting] detail:", e);
        if (alive) setLoad({ kind: "error" });
      });
    return () => {
      alive = false;
    };
  }, [castingId, authLoading, staff, attempt]);

  /** Тихо перечитать после отклика / тумблера: экран не мигает */
  const refresh = useCallback(async () => {
    try {
      const data = await fetchCastingDetail(castingId);
      setLoad({ kind: "ready", data });
    } catch (e: unknown) {
      console.error("[casting] refresh:", e);
    }
  }, [castingId]);

  const top = (
    <div className="mb-6">
      <BackLink label={t.back} />
    </div>
  );

  if (staff) {
    return (
      <div>
        {top}
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />
          {t.redirecting}
        </p>
      </div>
    );
  }

  if (load.kind === "loading") {
    return (
      <div aria-busy>
        {top}
        <div className={`${GLASS} flex items-center gap-3 p-6 text-sm text-zinc-400`}>
          <Loader2 className="size-4 text-amber-200 motion-safe:animate-spin" aria-hidden />
          {t.loading}
        </div>
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div>
        {top}
        <div role="alert" className={`${GLASS} p-6`}>
          <p className="flex items-start gap-2 text-sm text-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t.loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoad({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-zinc-700/80 bg-zinc-900/60 px-4 text-xs text-zinc-200 transition hover:border-amber-200/40 hover:text-amber-100 sm:min-h-9"
          >
            {t.retry}
          </button>
        </div>
      </div>
    );
  }

  const { feed, casting } = load.data;

  // Анкета на проверке / бан / Blacklist — кастингов нет совсем: объясняем, что делать
  if (hardBlocker(feed.me)) {
    return (
      <div>
        {top}
        <CastingAccessBanner me={feed.me} open={feed.me.openToTours} lang={lang} onProfileSaved={() => void refresh()} />
      </div>
    );
  }

  if (!casting) return <Unavailable t={t} top={top} />;

  // key — только id: после тихого перечитывания подтверждение «Отклик отправлен» не пропадает
  return <DetailBody key={casting.id} data={load.data} casting={casting} onRefresh={refresh} />;
}

function Unavailable({ t, top }: { t: Dict; top: ReactNode }) {
  return (
    <div>
      {top}
      <div className={`${GLASS} p-6 sm:p-8`}>
        <span className="flex size-11 items-center justify-center rounded-full border border-amber-200/25 bg-amber-200/10 text-amber-200">
          <SearchX className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <h1 className={`${cormorant.className} mt-4 text-3xl font-medium text-zinc-50`}>{t.unavailable.title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t.unavailable.text}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
          {t.unavailable.reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="text-amber-200/60">·</span>
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <BackLink label={t.back} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ТЕЛО СТРАНИЦЫ
 * ══════════════════════════════════════════════════════════════════ */

function DetailBody({
  data,
  casting: c,
  onRefresh,
}: {
  data: CastingDetailData;
  casting: FeedCasting;
  onRefresh: () => Promise<void>;
}) {
  const { lang, c: cm, fmt } = usePartnerFormat();
  const t = T[lang] ?? T.EN;
  const f = CASTING_FEED_COPY[lang] ?? CASTING_FEED_COPY.EN;
  const [me, setMe] = useState<ResidentProfile>(data.feed.me);
  const [open, setOpen] = useState(data.feed.me.openToTours);
  const [openBusy, setOpenBusy] = useState(false);
  const [response, setResponse] = useState<Response>(c.response);
  const [pending, setPending] = useState<Pending | null>(null);
  const [failure, setFailure] = useState<CastingFailure | null>(null);
  const [notice, setNotice] = useState<"sent" | "withdrawn" | null>(null);
  const [declined, setDeclined] = useState(false);

  // Свежие данные из базы (после отклика / тумблера) — переносим в состояние экрана
  const [syncedAt, setSyncedAt] = useState(data.feed.generatedAt);
  if (syncedAt !== data.feed.generatedAt) {
    setSyncedAt(data.feed.generatedAt);
    setResponse(c.response);
    setMe(data.feed.me);
    setOpen(data.feed.me.openToTours);
  }

  const title = pickI18n(c.title, lang, c.sourceLang);
  const brief = pickI18n(c.briefI18n, lang, c.sourceLang) ?? c.note;
  const briefLang = pickedLang(c.briefI18n, lang, c.sourceLang);
  const tour = c.catalogTour;
  const tourTitle = tour ? pickI18n(tour.title, lang) : null;
  const tourRequirements = tour ? pickI18n(tour.requirements, lang) : null;
  const tourConditions = tour ? pickI18n(tour.conditions, lang) : null;
  const tourAbout = pickI18n(data.tourDescription, lang);
  const country = tour?.countryCode ? countryName(tour.countryCode, lang.toLowerCase()) : "";
  const flag = tour?.countryCode ? countryFlag(tour.countryCode) : "";
  const city = fmt.city(c.city);
  const days = Math.round((c.endsAt - c.startsAt) / DAY) + 1;
  const now = fmt.ready ? fmt.now : Date.now();
  const state = castingState(c, me, now);
  const replied = hasReply(response);
  const invited = !!c.invite && !declined;
  const kyc = kycCopy(lang);
  const minKyc = toKycLevel(c.minKyc, 3);

  const heightFit: Fit = c.heightMin === null ? "ok" : me.height === null ? "unknown" : me.height >= c.heightMin ? "ok" : "miss";
  const langFit: Fit =
    c.languages.length === 0
      ? "ok"
      : me.languages.length === 0
        ? "unknown"
        : c.languages.every((l) => me.languages.includes(l))
          ? "ok"
          : "miss";

  /* ── отклик: те же функции, что в ленте ── */
  const run = async (kind: Pending, call: () => Promise<{ ok: true } | { ok: false; reason: CastingFailure }>, done: () => void) => {
    if (pending) return;
    setFailure(null);
    setNotice(null);
    setPending(kind);
    const res = await call();
    setPending(null);
    if (res.ok) {
      done();
      void onRefresh(); // свежий статус и can_respond из базы
    } else setFailure(res.reason);
  };

  const handleApply = () =>
    run("apply", () => applyToCasting(c.id), () => {
      setResponse({ status: "ready", at: Date.now(), optionUntil: null });
      setNotice("sent");
    });
  const handleWithdraw = () =>
    run("withdraw", () => withdrawResponse(c.id), () => {
      setResponse({ status: "withdrawn", at: Date.now(), optionUntil: null });
      setNotice("withdrawn");
    });
  const handleDecline = () => run("decline", () => declineInvite(c.id), () => setDeclined(true));

  const handleOpen = async (next: boolean) => {
    setOpen(next);
    setOpenBusy(true);
    const res = await setOpenToTours(next);
    if (!res.ok) setOpen(!next);
    else await onRefresh();
    setOpenBusy(false);
  };

  // Закрыт / отбор / отменён — кнопка заблокирована с объяснением (если откликов нет)
  const closedText = state !== "open" && !replied ? t.closedText[state] : null;
  // Открыт, но база не пустит (KYC / тумблер) — подпись из баннера доступа
  const locked = !closedText && !replied && !c.canRespond ? lockedLabel(me, open, lang, c) : null;

  const payerLine = (p: Payer) => t.payer[p];

  return (
    <article aria-labelledby="casting-title">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <BackLink label={t.back} />
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] tracking-wide ${PILL[t.stateTone[state]]}`}>
          {state === "open" ? <Sparkles className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />}
          {t.state[state]}
        </span>
      </div>

      {/* ── шапка ── */}
      <header className={`${GLASS} relative overflow-hidden bg-gradient-to-br from-amber-200/[0.09] via-zinc-900/60 to-zinc-950/90 p-6 sm:p-8`}>
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-amber-200/10 blur-3xl" />
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          {cm.projects[c.project]} · {t.days(days)}
        </p>
        {tourTitle && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-amber-100/70">
            <Plane className="size-3" strokeWidth={1.75} aria-hidden />
            {tourTitle}
          </p>
        )}
        <h1 id="casting-title" className={`${cormorant.className} mt-2 break-words text-[2.4rem] font-medium leading-[1.02] text-zinc-50 sm:text-[3.2rem]`}>
          {title ?? city}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-300">
          <MapPin className="size-3.5 text-amber-200/70" aria-hidden />
          {[city, country].filter(Boolean).join(", ")}
          {flag && <span aria-hidden>{flag}</span>}
          <span aria-hidden className="text-zinc-700">·</span>
          {fmt.range(c.startsAt, c.endsAt)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <KycLevelBadge
            level={c.minKyc}
            lang={lang}
            tone={c.kycOk || invited ? "ok" : "miss"}
            title={`${kyc.needed(c.minKyc)} · ${kyc.youHave(me.kycLevel)}`}
          />
          {c.fee && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${PILL.gold}`}>
              <Banknote className="size-3" aria-hidden />
              {fmt.money(c.fee.amount, c.fee.currency)}
            </span>
          )}
        </div>

        {invited && !replied && (
          <div className="mt-5 rounded-xl border border-amber-200/40 bg-amber-200/[0.08] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
              <Sparkles className="size-3.5" aria-hidden />
              {f.invited}
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-200">{c.invite?.message ?? f.invitedText}</p>
            <button
              type="button"
              onClick={() => void handleDecline()}
              disabled={pending !== null}
              className="mt-1 inline-flex min-h-11 items-center text-xs text-zinc-400 underline-offset-4 transition hover:text-zinc-200 hover:underline disabled:opacity-50 sm:min-h-8"
            >
              {pending === "decline" ? "…" : f.decline}
            </button>
          </div>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {/* ── основная информация ── */}
          <Section id="casting-main" icon={Ticket} title={t.sections.main}>
            <FactGrid>
              <Fact icon={MapPin} label={t.main.destination}>
                {[city, country].filter(Boolean).join(", ")} {flag && <span aria-hidden>{flag}</span>}
              </Fact>
              <Fact icon={Plane} label={t.main.tour}>
                {tourTitle ?? <span className="text-zinc-500">{t.main.noTour}</span>}
              </Fact>
              <Fact icon={CalendarDays} label={t.main.starts}>
                {fmt.date(c.startsAt, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </Fact>
              <Fact icon={CalendarDays} label={t.main.ends}>
                {fmt.date(c.endsAt, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </Fact>
              <Fact icon={Hourglass} label={t.main.duration}>
                {t.days(days)}
              </Fact>
              <Fact icon={Users} label={t.main.slots}>
                {t.slots(c.slots)}
              </Fact>
              <Fact icon={Clock} label={t.main.deadline}>
                {fmt.date(c.closesAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                {state === "open" && <span className="ml-1 text-xs text-zinc-500">· {fmt.until(c.closesAt)}</span>}
              </Fact>
              <Fact icon={ShieldCheck} label={t.main.status}>
                {t.state[state]}
              </Fact>
            </FactGrid>
          </Section>

          {/* ── деньги ── */}
          <Section id="casting-money" icon={Coins} title={t.sections.money}>
            <FactGrid>
              <Fact icon={Banknote} label={t.money.fee}>
                {c.fee ? (
                  <span className={`${cormorant.className} text-2xl leading-none text-amber-100`}>{fmt.money(c.fee.amount, c.fee.currency)}</span>
                ) : (
                  t.money.feeOpen
                )}
              </Fact>
              <Fact icon={Coins} label={t.money.currency}>
                {c.fee ? c.fee.currency : <span className="text-zinc-500">{t.money.currencyOpen}</span>}
              </Fact>
              <Fact icon={Plane} label={t.money.flight}>
                {payerLine(c.flightPaidBy)}
              </Fact>
              <Fact icon={BedDouble} label={t.money.hotel}>
                {payerLine(c.hotelPaidBy)}
              </Fact>
            </FactGrid>
          </Section>

          {/* ── требования ── */}
          <Section id="casting-requirements" icon={ScrollText} title={t.sections.requirements}>
            <FactGrid>
              <Fact icon={Ruler} label={t.req.height}>
                {c.heightMin === null ? (
                  t.req.heightNone
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <Requirement icon={Ruler} text={t.req.heightValue(c.heightMin)} fit={heightFit} />
                    <span className="text-[11px] text-zinc-500">{t.req.fit[heightFit]}</span>
                  </span>
                )}
              </Fact>
              <Fact icon={Languages} label={t.req.languages}>
                {c.languages.length === 0 ? (
                  t.req.languagesNone
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <Requirement icon={Languages} text={c.languages.map((l) => languageName(l, lang)).join(" · ")} fit={langFit} />
                    <span className="text-[11px] text-zinc-500">{t.req.fit[langFit]}</span>
                  </span>
                )}
              </Fact>
              <Fact icon={Globe2} label={t.req.passport} wide>
                <span className="block text-zinc-300">{t.req.passportText}</span>
                {country && <span className="mt-1 block text-xs text-zinc-500">{t.req.country(`${country} ${flag}`.trim())}</span>}
              </Fact>
              <Fact icon={ShieldCheck} label={t.req.kyc}>
                <span className="flex flex-col items-start gap-1.5">
                  <KycLevelBadge level={c.minKyc} lang={lang} tone={c.kycOk || invited ? "ok" : "miss"} />
                  <span className="text-[11px] text-zinc-500">{kyc.youHave(me.kycLevel)}</span>
                </span>
              </Fact>
              <Fact icon={FileCheck2} label={t.req.documents}>
                {minKyc === 0 ? (
                  t.req.documentsBasic
                ) : (
                  <ul className="space-y-1">
                    {([1, 2, 3] as const)
                      .filter((l) => l <= minKyc)
                      .map((l) => (
                        <li key={l} className="flex items-start gap-1.5 text-sm">
                          {me.kycLevel >= l ? (
                            <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-300" aria-hidden />
                          ) : (
                            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-amber-200/60" />
                          )}
                          <span>
                            {kyc.levels[l].name}
                            <span className="block text-[11px] leading-snug text-zinc-500">{kyc.levels[l].resident}</span>
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </Fact>
            </FactGrid>
          </Section>

          {/* ── описание ── */}
          <Section id="casting-description" icon={ScrollText} title={t.sections.description}>
            <div className="space-y-4">
              {brief ? (
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">{t.desc.brief}</h3>
                  <p className={`${cormorant.className} mt-2 whitespace-pre-line break-words text-[19px] leading-snug text-zinc-100`}>{brief}</p>
                  {briefLang && briefLang !== lang && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-600">{t.desc.original(briefLang)}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{t.desc.briefNone}</p>
              )}
              {tourRequirements && (
                <Prose title={t.desc.tourRequirements} hint={t.desc.fromTour}>
                  {tourRequirements}
                </Prose>
              )}
              {tourConditions && (
                <Prose title={t.desc.tourConditions} hint={t.desc.fromTour}>
                  {tourConditions}
                </Prose>
              )}
              {tourAbout && (
                <Prose title={t.desc.tourAbout} hint={tourTitle}>
                  {tourAbout}
                </Prose>
              )}
            </div>
          </Section>

          {/* ── организатор: только репутация (Blind Selection) ── */}
          <Section id="casting-manager" icon={KeyRound} title={t.sections.manager}>
            {c.organizer.official && (
              <div className="mb-3 rounded-xl border border-amber-200/25 bg-amber-200/[0.05] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-amber-100/70">{t.manager.club}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-100">
                  {c.organizer.name ?? "VOYAGE Management"}
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-amber-200/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                    <BadgeCheck className="size-3" aria-hidden />
                    Official Club
                  </span>
                </p>
              </div>
            )}
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              {t.manager.label}
              {!c.organizer.official && c.organizer.badge === "verified" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.14em] text-emerald-100">
                  <BadgeCheck className="size-3" aria-hidden />
                  Verified
                </span>
              )}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-400">
              <KeyRound className="size-3.5 shrink-0 text-amber-200/70" aria-hidden />
              <span className={`bg-gradient-to-r ${TIER_TEXT[c.manager.tier]} bg-clip-text font-medium text-transparent`}>
                {TIER_LABEL[c.manager.tier]}
              </span>
              <span aria-hidden className="text-zinc-700">·</span>
              {c.manager.rating !== null ? (
                <span className="inline-flex items-center gap-1 text-zinc-300">
                  <Star className="size-3 fill-amber-200 text-amber-200" aria-hidden />
                  {fmt.num(c.manager.rating, 1)}
                </span>
              ) : (
                <span className="text-zinc-500">{t.manager.isNew}</span>
              )}
              <span aria-hidden className="text-zinc-700">·</span>
              <span>{f.tours(c.manager.tours)}</span>
            </p>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-amber-200/60" strokeWidth={1.5} aria-hidden />
              {t.blind}
            </p>
          </Section>
        </div>

        {/* ── отклик: на десктопе — липкая колонка, на телефоне — после условий ── */}
        <aside id="casting-response-box" aria-labelledby="casting-response" className="scroll-mt-24 lg:sticky lg:top-24">
          <div className={`${GLASS} p-5`}>
            <h2 id="casting-response" className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-amber-100/70">
              <Plane className="size-3.5 text-amber-200/80" strokeWidth={1.75} aria-hidden />
              {t.sections.response}
            </h2>
            {state === "open" && response?.status !== "option" && response?.status !== "selected" && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                <Clock className="size-3.5 shrink-0" aria-hidden />
                {f.closesIn(fmt.until(c.closesAt))}
              </p>
            )}
            <div className="mt-4" aria-live="polite">
              {closedText ? (
                <div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-4 text-center text-sm text-zinc-400"
                  >
                    <Lock className="size-4 shrink-0 text-zinc-500" aria-hidden />
                    {f.apply}
                  </button>
                  <p className="mt-2 text-center text-xs leading-snug text-zinc-400">{closedText}</p>
                </div>
              ) : (
                <ApplyStub
                  response={response}
                  pending={pending}
                  failure={failure}
                  locked={locked}
                  onApply={() => void handleApply()}
                  onWithdraw={() => void handleWithdraw()}
                  t={f}
                  fmt={fmt}
                />
              )}
              {notice && (
                <p
                  role="status"
                  className={`mt-3 flex items-start gap-1.5 rounded-xl border px-3 py-2 text-xs leading-snug ${
                    notice === "sent" ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-100" : "border-zinc-700/80 bg-zinc-900/60 text-zinc-300"
                  }`}
                >
                  {notice === "sent" ? <Check className="mt-px size-3.5 shrink-0" aria-hidden /> : <Lock className="mt-px size-3.5 shrink-0" aria-hidden />}
                  {notice === "sent" ? t.sent : t.withdrawn}
                </p>
              )}
            </div>
            <div className="mt-5 border-t border-zinc-800/70 pt-4">
              <BackLink label={t.back} />
            </div>
          </div>
        </aside>
      </div>

      {/* ── телефон: панель внизу экрана ведёт к блоку отклика, пока его не видно ── */}
      <a
        href="#casting-response-box"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex min-h-12 items-center justify-between gap-3 rounded-full border border-amber-200/30 bg-zinc-950/85 px-5 text-sm text-amber-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:hidden"
      >
        <span className="truncate">{replied ? f.applied : closedText ? t.state[state] : locked ?? f.apply}</span>
        <span className="shrink-0 text-xs text-zinc-400">{t.sections.response} ↓</span>
      </a>

      {/* ── что мешает отклику: тот же баннер и тумблер, что в ленте ── */}
      {locked && (
        <section id="casting-access" aria-label={t.accessTitle} className="mt-6 scroll-mt-24 space-y-4">
          {!open && <OpenToToursSwitch value={open} busy={openBusy} onChange={(v) => void handleOpen(v)} t={f} />}
          <CastingAccessBanner
            me={me}
            open={open}
            lang={lang}
            onProfileSaved={(v) => setMe((cur) => ({ ...cur, height: v.height, languages: v.languages }))}
          />
        </section>
      )}
    </article>
  );
}

