"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · COMMAND (ШТАБ) — app/(dashboard)/partner/page.tsx
 *
 * Главный экран менеджера — всё, что требует решения сегодня:
 *
 *   Header     приветствие, Ключ и прогресс до следующего, Pulse (Show Rate)
 *   KPI        кастинги, вылеты за 72 ч, ответы «Готова», оценка
 *   Alerts     опционы, неподписанные контракты, документы, срывы, отклики
 *   Castings   слепой шорт-лист: свежесть Live Snap и Trusted у ответивших
 *   Manifest   вылеты на 72 часа + печать Digital Contract у каждого тура
 *   Radar      Blacklist · новые анкеты (Live Snap, Trusted) · отзывы Ключей
 *
 * Данные: _lib/useCommandData — демо или RPC partner_command()
 * (переключатель NEXT_PUBLIC_PARTNER_DATA=live). Сигналы доверия —
 * _components/TrustSignals, их же ставим в Deal Room и кастинги.
 *
 * Относительное время считается только на клиенте (useNow): на сервере
 * сроки показываются прочерком, поэтому гидрация проходит без расхождений.
 * ──────────────────────────────────────────────────────────────────── */

import { useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Hourglass,
  KeyRound,
  Lock,
  MessagesSquare,
  PenLine,
  Plane,
  Plus,
  Quote,
  Radar as RadarIcon,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  WifiOff,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import { DAY, HOUR, MIN, UNITS, fmtDur, useNow, type Units } from "./_lib/clock";
import type {
  AlertItem,
  AlertKind,
  BlacklistItem,
  CastingItem,
  CommandData,
  FlightItem,
  FlightStatus,
  KeyTier,
  ManagerSnapshot,
  ProjectKey,
  ReviewItem,
  ReviewTag,
  VerifiedItem,
} from "./_lib/command";
import { useCommandData } from "./_lib/useCommandData";
import { ROUTES } from "./_lib/routes";
import { cityLabel } from "./_lib/cities";
import { notifyTour, type NotifyResult } from "./_lib/actions";
import { TelegramAction } from "./_components/TelegramAction";
import { PartnerGuide } from "./_components/PartnerGuide";
import {
  ContractSeal,
  LiveSnapBadge,
  SNAP_RING,
  Stars,
  TrustBadge,
  isFreshSnap,
  snapState,
} from "./_components/TrustSignals";
import { cormorant } from "@/app/components/profile/fonts";

/* ══════════════════════════════════════════════════════════════════
 * ПЕРЕВОДЫ
 * ══════════════════════════════════════════════════════════════════ */

type Dict = {
  locale: string;
  eyebrow: string;
  demo: string;
  greet: { neutral: string; morning: string; day: string; evening: string; night: string };
  subtitle: string;
  key: { label: string; toNext: (n: number, next: string) => string; ratingGate: string; top: string };
  pulse: { label: string; caption: string; foot: (flown: number, total: number) => string; empty: string };
  kpi: { castings: string; departures: string; ready: string; rating: string };
  quick: { eyebrow: string; items: Record<QuickKey, { label: string; hint: string }> };
  in: (d: string) => string;
  ago: (d: string) => string;
  left: (d: string) => string;
  projects: Record<ProjectKey, string>;
  state: {
    loading: string;
    retry: string;
    stale: (time: string) => string;
    error: { forbidden: string; missing: string; network: string; unknown: string };
    errorHint: { forbidden: string; missing: string; network: string; unknown: string };
  };
  alerts: {
    eyebrow: string;
    title: string;
    clear: string;
    dismiss: string;
    text: {
      option: (code: string, what: string) => string;
      contract: (signed: number | null, required: number | null, what: string) => string;
      docs: (n: number, what: string) => string;
      replacement: (what: string) => string;
      responses: (n: number, what: string) => string;
    };
    contractHint: string;
    action: Record<AlertKind, string>;
    remindSign: string;
  };
  castings: {
    eyebrow: string;
    title: string;
    create: string;
    all: string;
    open: string;
    stage: { open: string; shortlist: string };
    closing: string;
    ready: (n: number, slots: number) => string;
    fresh: (n: number) => string;
    closesIn: (d: string) => string;
    blind: string;
    days: (n: number) => string;
    snaps: (fresh: number, total: number) => string;
    trusted: (n: number, total: number) => string;
    avatar: (code: string, snap: string, trusted: boolean) => string;
    avatarOpen: (name: string, code: string, snap: string, trusted: boolean) => string;
    handshakes: (n: number) => string;
    noSnap: string;
  };
  manifest: {
    eyebrow: string;
    title: string;
    all: string;
    now: string;
    empty: string;
    status: Record<FlightStatus, string>;
    departsIn: (d: string) => string;
    crew: (n: number) => string;
    docs: (ready: number, total: number) => string;
    replacement: string;
    docsOk: string;
    docsMissing: string;
    room: string;
  };
  radar: {
    eyebrow: string;
    title: string;
    live: string;
    clean: string;
    dirty: string;
    blacklist: string;
    allBlacklist: string;
    reason: Record<BlacklistItem["reason"], string>;
    status: { confirmed: string; appeal: string };
    verified: string;
    allVerified: string;
    verifiedAgo: (d: string) => string;
    early: (tier: string, d: string) => string;
    hidden: string;
    openProfile: string;
    cm: string;
    reviews: string;
    allReviews: string;
    reviewsEmpty: string;
    from: (tier: string) => string;
    tags: Record<ReviewTag, string>;
  };
};

/** Русские формы: 1 тур · 2 тура · 5 туров */
function ru(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const one = (n: number, singular: string, plural: string) => (n === 1 ? singular : plural);

const T: Record<Lang, Dict> = {
  EN: {
    locale: "en-GB",
    eyebrow: "Command Center",
    demo: "Demo data",
    greet: { neutral: "Welcome back", morning: "Good morning", day: "Good afternoon", evening: "Good evening", night: "Good night" },
    subtitle: "Your tour control desk: castings, departures and safety on one screen.",
    key: {
      label: "Rank",
      toNext: (n, next) => `${n} ${one(n, "tour", "tours")} to ${next}`,
      ratingGate: "Needs a resident rating of 4.5+",
      top: "Highest key",
    },
    pulse: {
      label: "Pulse · Show Rate",
      caption: "of confirmed participants flew",
      foot: (f, t) => `${f} of ${t} · last 12 months`,
      empty: "Appears after your first completed tour",
    },
    kpi: { castings: "Active castings", departures: "Departures · 72h", ready: "“Ready” responses", rating: "Resident rating" },
    quick: {
      eyebrow: "Quick access · Command",
      items: { castings: { label: "Castings", hint: "Open calls and “Ready” replies" }, manifest: { label: "Manifest", hint: "Tours, crews, deal rooms" }, pulse: { label: "Pulse", hint: "Show rate and reviews" }, blacklist: { label: "Blacklist", hint: "Reasons, reports, appeals" }, keys: { label: "Keys", hint: "Your partner tier" }, settings: { label: "Notifications", hint: "Telegram work alerts" } },
    },
    in: (d) => `in ${d}`,
    ago: (d) => `${d} ago`,
    left: (d) => `${d} left`,
    projects: { shoot: "shoot", show: "show", campaign: "campaign", event: "event" },
    state: {
      loading: "Loading your desk…",
      retry: "Retry",
      stale: (time) => `Couldn’t refresh — showing data from ${time}`,
      error: {
        forbidden: "Command is for club managers",
        missing: "The database isn’t updated yet",
        network: "No connection to the server",
        unknown: "Couldn’t load your desk",
      },
      errorHint: {
        forbidden: "Your account doesn’t have the manager role. Contact the club administrator.",
        missing: "Apply the partner_command migration in Supabase, then reload.",
        network: "Check your connection — the desk will retry automatically.",
        unknown: "Try again in a minute. If it repeats, send the error to the admin.",
      },
    },
    alerts: {
      eyebrow: "Alerts",
      title: "Needs attention",
      clear: "All clear — no decisions waiting on you.",
      dismiss: "Dismiss",
      text: {
        option: (c, w) => `Option expiring: ${c} · ${w}`,
        contract: (s, r, w) =>
          r === null ? `No contract yet · ${w}` : `Contract not signed: ${s ?? 0} of ${r} · ${w}`,
        docs: (n, w) => `${n} ${one(n, "participant hasn’t", "participants haven’t")} uploaded documents · ${w}`,
        replacement: (w) => `Drop-out on “${w}” — replacement found`,
        responses: (n, w) => `${n} new ${one(n, "response", "responses")} to casting “${w}”`,
      },
      contractHint: "Don’t pay for tickets until everyone has signed.",
      action: { option: "Confirm", contract: "Open contract", docs: "Remind", replacement: "Review", responses: "Open casting" },
      remindSign: "Remind to sign",
    },
    castings: {
      eyebrow: "Castings",
      title: "Active castings",
      create: "New casting",
      all: "All castings",
      open: "Open",
      stage: { open: "Open", shortlist: "Shortlist" },
      closing: "Closing soon",
      ready: (n, s) => `${n} ready · ${s} ${one(s, "spot", "spots")}`,
      fresh: (n) => `+${n} new`,
      closesIn: (d) => `Closes in ${d}`,
      blind: "Blind casting — name and profile unlock after the handshake",
      days: (n) => `${n} ${one(n, "day", "days")}`,
      snaps: (f, t) => `Live Snap ≤ 24h · ${f}/${t}`,
      trusted: (n, t) => `Trusted · ${n}/${t}`,
      avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — open candidate card`,
      avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — open profile`,
      handshakes: (n) => `Handshake · ${n}`,
      noSnap: "no Live Snap",
    },
    manifest: {
      eyebrow: "Manifest",
      title: "Departures · 72 hours",
      all: "Full manifest",
      now: "Now",
      empty: "No departures in the next 72 hours.",
      status: { confirmed: "Confirmed", contract: "Awaiting signatures", docs: "Awaiting documents", replacement: "Drop-out → Replacement" },
      departsIn: (d) => `departs in ${d}`,
      crew: (n) => `${n} ${one(n, "participant", "participants")}`,
      docs: (a, b) => `documents ${a}/${b}`,
      replacement: "Replacement confirmed:",
      docsOk: "documents verified",
      docsMissing: "awaiting documents",
      room: "Deal Room",
    },
    radar: {
      eyebrow: "Radar",
      title: "Radar",
      live: "Live",
      clean: "Your line-ups are clean — none of your participants is blacklisted.",
      dirty: "Someone in your line-up was just blacklisted — check your tours.",
      blacklist: "Blacklist",
      allBlacklist: "View all",
      reason: { noShow: "No-show on a confirmed tour", fakePhotos: "Fake photos", fraud: "Deception / rules breach" },
      status: { confirmed: "Confirmed", appeal: "Under appeal" },
      verified: "New verified",
      allVerified: "All profiles",
      verifiedAgo: (d) => `Verified ${d} ago`,
      early: (tier, d) => `${tier} early access · opens in ${d}`,
      hidden: "Hidden profile",
      openProfile: "Open profile",
      cm: "cm",
      reviews: "Reviews from Keys",
      allReviews: "All reviews",
      reviewsEmpty: "No new reviews yet — they appear after completed tours.",
      from: (tier) => `from ${tier}`,
      tags: {
        punctual: "Punctual",
        professional: "Professional",
        matchesSnaps: "Matches her snaps",
        communicative: "Responsive",
        teamPlayer: "Team player",
      },
    },
  },

  RU: {
    locale: "ru-RU",
    eyebrow: "Command · Штаб",
    demo: "Демо-данные",
    greet: { neutral: "С возвращением", morning: "Доброе утро", day: "Добрый день", evening: "Добрый вечер", night: "Доброй ночи" },
    subtitle: "Пульт ваших туров: кастинги, вылеты и безопасность — на одном экране.",
    key: {
      label: "Ранг",
      toNext: (n, next) => `${n} ${ru(n, "тур", "тура", "туров")} до ${next}`,
      ratingGate: "Нужна оценка резиденток от 4,5",
      top: "Высший ключ",
    },
    pulse: {
      label: "Pulse · Show Rate",
      caption: "подтверждённых участниц долетели",
      foot: (f, t) => `${f} из ${t} за 12 месяцев`,
      empty: "Появится после первого закрытого тура",
    },
    kpi: { castings: "Активные кастинги", departures: "Вылеты · 72 ч", ready: "Ответы «Готова»", rating: "Оценка резиденток" },
    quick: {
      eyebrow: "Быстрый доступ · Штаб",
      items: { castings: { label: "Кастинги", hint: "Открытые наборы и ответы «Готова»" }, manifest: { label: "Манифест", hint: "Туры, составы, комнаты сделки" }, pulse: { label: "Пульс", hint: "Явка и отзывы" }, blacklist: { label: "Чёрный список", hint: "Причины, заявки, апелляции" }, keys: { label: "Ключи", hint: "Ваш уровень партнёра" }, settings: { label: "Оповещения", hint: "Рабочие уведомления в Telegram" } },
    },
    in: (d) => `через ${d}`,
    ago: (d) => `${d} назад`,
    left: (d) => `осталось ${d}`,
    projects: { shoot: "съёмка", show: "показ", campaign: "кампейн", event: "ивент" },
    state: {
      loading: "Загружаем пульт…",
      retry: "Повторить",
      stale: (time) => `Не удалось обновить — данные на ${time}`,
      error: {
        forbidden: "Штаб доступен только менеджерам клуба",
        missing: "База ещё не обновлена",
        network: "Нет связи с сервером",
        unknown: "Не удалось загрузить пульт",
      },
      errorHint: {
        forbidden: "У вашего аккаунта нет роли менеджера. Напишите администратору клуба.",
        missing: "Примените миграцию partner_command в Supabase и обновите страницу.",
        network: "Проверьте интернет — пульт повторит попытку сам.",
        unknown: "Попробуйте через минуту. Если повторится — отправьте ошибку администратору.",
      },
    },
    alerts: {
      eyebrow: "Alerts",
      title: "Требует внимания",
      clear: "Всё под контролем: решений от вас сейчас не требуется.",
      dismiss: "Скрыть",
      text: {
        option: (c, w) => `Истекает опцион: ${c} · ${w}`,
        contract: (s, r, w) =>
          r === null ? `Контракт не создан · ${w}` : `Контракт не подписан: ${s ?? 0} из ${r} · ${w}`,
        docs: (n, w) =>
          `${n} ${ru(n, "участница не загрузила", "участницы не загрузили", "участниц не загрузили")} документы · ${w}`,
        replacement: (w) => `Срыв в туре «${w}» — замена подобрана`,
        responses: (n, w) => `${n} ${ru(n, "новый отклик", "новых отклика", "новых откликов")} на кастинг «${w}»`,
      },
      contractHint: "Не оплачивайте билеты, пока не подписали все.",
      action: { option: "Подтвердить", contract: "Открыть контракт", docs: "Напомнить", replacement: "Проверить", responses: "Открыть кастинг" },
      remindSign: "Напомнить о подписи",
    },
    castings: {
      eyebrow: "Castings",
      title: "Активные кастинги",
      create: "Новый кастинг",
      all: "Все кастинги",
      open: "Открыть",
      stage: { open: "Открыт", shortlist: "Шорт-лист" },
      closing: "Скоро закрытие",
      ready: (n, s) => `${n} «Готова» · ${s} ${ru(s, "место", "места", "мест")}`,
      fresh: (n) => `+${n} ${ru(n, "новый", "новых", "новых")}`,
      closesIn: (d) => `Закрытие через ${d}`,
      blind: "Слепой отбор — имя и профиль откроются после рукопожатия",
      days: (n) => `${n} ${ru(n, "день", "дня", "дней")}`,
      snaps: (f, t) => `Live Snap ≤ 24 ч · ${f}/${t}`,
      trusted: (n, t) => `Trusted · ${n}/${t}`,
      avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — открыть карточку кандидатки`,
      avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — открыть профиль`,
      handshakes: (n) => `Рукопожатие · ${n}`,
      noSnap: "нет Live Snap",
    },
    manifest: {
      eyebrow: "Manifest",
      title: "Вылеты · 72 часа",
      all: "Весь манифест",
      now: "Сейчас",
      empty: "В ближайшие 72 часа вылетов нет.",
      status: { confirmed: "Подтверждено", contract: "Ждём подписи", docs: "Ждём документы", replacement: "Срыв → Замена" },
      departsIn: (d) => `вылет через ${d}`,
      crew: (n) => `${n} ${ru(n, "участница", "участницы", "участниц")}`,
      docs: (a, b) => `документы ${a}/${b}`,
      replacement: "Замена подтвердила участие:",
      docsOk: "документы проверены",
      docsMissing: "ждём документы",
      room: "Комната тура",
    },
    radar: {
      eyebrow: "Radar",
      title: "Радар",
      live: "Live",
      clean: "Ваши составы чисты — никого из ваших участниц нет в Blacklist.",
      dirty: "Участница из вашего состава попала в Blacklist — проверьте туры.",
      blacklist: "Blacklist",
      allBlacklist: "Весь список",
      reason: { noShow: "Срыв подтверждённого тура", fakePhotos: "Подделка фото", fraud: "Обман / нарушение устава" },
      status: { confirmed: "Подтверждено", appeal: "На апелляции" },
      verified: "Новые анкеты",
      allVerified: "Все анкеты",
      verifiedAgo: (d) => `Verified ${d} назад`,
      early: (tier, d) => `Ранний доступ ${tier} · откроется через ${d}`,
      hidden: "Анкета скрыта",
      openProfile: "Открыть профиль",
      cm: "см",
      reviews: "Отзывы Ключей",
      allReviews: "Все отзывы",
      reviewsEmpty: "Новых отзывов пока нет — они появляются после закрытых туров.",
      from: (tier) => `от ${tier}`,
      tags: {
        punctual: "Пунктуальна",
        professional: "Профессиональна",
        matchesSnaps: "Как на снапах",
        communicative: "На связи",
        teamPlayer: "Командная",
      },
    },
  },

  ES: {
    locale: "es-ES",
    eyebrow: "Command · Cuartel",
    demo: "Datos de demostración",
    greet: { neutral: "Hola de nuevo", morning: "Buenos días", day: "Buenas tardes", evening: "Buenas noches", night: "Buenas noches" },
    subtitle: "Tu centro de control: castings, salidas y seguridad en una sola pantalla.",
    key: {
      label: "Rango",
      toNext: (n, next) => `${n} ${one(n, "tour", "tours")} para ${next}`,
      ratingGate: "Necesitas una valoración de 4,5+",
      top: "Llave máxima",
    },
    pulse: {
      label: "Pulse · Show Rate",
      caption: "de las participantes confirmadas viajaron",
      foot: (f, t) => `${f} de ${t} · últimos 12 meses`,
      empty: "Aparece tras tu primer tour cerrado",
    },
    kpi: { castings: "Castings activos", departures: "Salidas · 72 h", ready: "Respuestas «Lista»", rating: "Valoración de residentes" },
    quick: {
      eyebrow: "Acceso rápido · Cuartel",
      items: { castings: { label: "Castings", hint: "Convocatorias y respuestas «Lista»" }, manifest: { label: "Manifiesto", hint: "Tours, equipos, salas de acuerdo" }, pulse: { label: "Pulso", hint: "Asistencia y reseñas" }, blacklist: { label: "Lista negra", hint: "Motivos, reportes, apelaciones" }, keys: { label: "Llaves", hint: "Tu nivel de socio" }, settings: { label: "Avisos", hint: "Alertas de trabajo en Telegram" } },
    },
    in: (d) => `en ${d}`,
    ago: (d) => `hace ${d}`,
    left: (d) => `quedan ${d}`,
    projects: { shoot: "sesión", show: "desfile", campaign: "campaña", event: "evento" },
    state: {
      loading: "Cargando tu panel…",
      retry: "Reintentar",
      stale: (time) => `No se pudo actualizar — datos de las ${time}`,
      error: {
        forbidden: "El cuartel es solo para gerentes del club",
        missing: "La base de datos aún no está actualizada",
        network: "Sin conexión con el servidor",
        unknown: "No se pudo cargar el panel",
      },
      errorHint: {
        forbidden: "Tu cuenta no tiene el rol de gerente. Escribe al administrador del club.",
        missing: "Aplica la migración partner_command en Supabase y recarga la página.",
        network: "Revisa tu conexión: el panel lo reintentará solo.",
        unknown: "Inténtalo en un minuto. Si se repite, envía el error al administrador.",
      },
    },
    alerts: {
      eyebrow: "Alerts",
      title: "Requiere atención",
      clear: "Todo bajo control: no hay decisiones pendientes.",
      dismiss: "Ocultar",
      text: {
        option: (c, w) => `Vence la opción: ${c} · ${w}`,
        contract: (s, r, w) => (r === null ? `Sin contrato · ${w}` : `Contrato sin firmar: ${s ?? 0} de ${r} · ${w}`),
        docs: (n, w) => `${n} ${one(n, "participante no ha subido", "participantes no han subido")} documentos · ${w}`,
        replacement: (w) => `Baja en «${w}»: reemplazo encontrado`,
        responses: (n, w) => `${n} ${one(n, "nueva respuesta", "nuevas respuestas")} al casting «${w}»`,
      },
      contractHint: "No pagues los billetes hasta que todos firmen.",
      action: { option: "Confirmar", contract: "Abrir contrato", docs: "Recordar", replacement: "Revisar", responses: "Abrir casting" },
      remindSign: "Recordar la firma",
    },
    castings: {
      eyebrow: "Castings",
      title: "Castings activos",
      create: "Nuevo casting",
      all: "Todos los castings",
      open: "Abrir",
      stage: { open: "Abierto", shortlist: "Preselección" },
      closing: "Cierra pronto",
      ready: (n, s) => `${n} «Lista» · ${s} ${one(s, "plaza", "plazas")}`,
      fresh: (n) => `+${n} ${one(n, "nueva", "nuevas")}`,
      closesIn: (d) => `Cierra en ${d}`,
      blind: "Casting ciego: nombre y perfil se revelan tras el acuerdo",
      days: (n) => `${n} ${one(n, "día", "días")}`,
      snaps: (f, t) => `Live Snap ≤ 24 h · ${f}/${t}`,
      trusted: (n, t) => `Trusted · ${n}/${t}`,
      avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — abrir ficha de candidata`,
      avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — abrir perfil`,
      handshakes: (n) => `Acuerdo · ${n}`,
      noSnap: "sin Live Snap",
    },
    manifest: {
      eyebrow: "Manifest",
      title: "Salidas · 72 horas",
      all: "Manifiesto completo",
      now: "Ahora",
      empty: "No hay salidas en las próximas 72 horas.",
      status: { confirmed: "Confirmado", contract: "Faltan firmas", docs: "Faltan documentos", replacement: "Baja → Reemplazo" },
      departsIn: (d) => `sale en ${d}`,
      crew: (n) => `${n} ${one(n, "participante", "participantes")}`,
      docs: (a, b) => `documentos ${a}/${b}`,
      replacement: "Reemplazo confirmado:",
      docsOk: "documentos verificados",
      docsMissing: "faltan documentos",
      room: "Sala del tour",
    },
    radar: {
      eyebrow: "Radar",
      title: "Radar",
      live: "Live",
      clean: "Tus equipos están limpios: ninguna de tus participantes está en la Blacklist.",
      dirty: "Una participante de tu equipo entró en la Blacklist: revisa tus tours.",
      blacklist: "Blacklist",
      allBlacklist: "Ver todo",
      reason: { noShow: "No se presentó a un tour confirmado", fakePhotos: "Fotos falsas", fraud: "Engaño / violación de normas" },
      status: { confirmed: "Confirmado", appeal: "En apelación" },
      verified: "Nuevos verificados",
      allVerified: "Ver todos",
      verifiedAgo: (d) => `Verificado hace ${d}`,
      early: (tier, d) => `Acceso anticipado ${tier} · se abre en ${d}`,
      hidden: "Perfil oculto",
      openProfile: "Abrir perfil",
      cm: "cm",
      reviews: "Reseñas de Llaves",
      allReviews: "Ver todas",
      reviewsEmpty: "Aún no hay reseñas nuevas: aparecen tras los tours cerrados.",
      from: (tier) => `de ${tier}`,
      tags: {
        punctual: "Puntual",
        professional: "Profesional",
        matchesSnaps: "Igual que en los snaps",
        communicative: "Responde rápido",
        teamPlayer: "Buen equipo",
      },
    },
  },

  PT: {
    locale: "pt-BR",
    eyebrow: "Command · Quartel",
    demo: "Dados de demonstração",
    greet: { neutral: "Olá de novo", morning: "Bom dia", day: "Boa tarde", evening: "Boa noite", night: "Boa noite" },
    subtitle: "Seu painel de controle: castings, partidas e segurança numa só tela.",
    key: {
      label: "Nível",
      toNext: (n, next) => `${n} ${one(n, "tour", "tours")} para ${next}`,
      ratingGate: "Precisa de avaliação 4,5+",
      top: "Chave máxima",
    },
    pulse: {
      label: "Pulse · Show Rate",
      caption: "das participantes confirmadas embarcaram",
      foot: (f, t) => `${f} de ${t} · últimos 12 meses`,
      empty: "Aparece após o primeiro tour concluído",
    },
    kpi: { castings: "Castings ativos", departures: "Partidas · 72 h", ready: "Respostas «Pronta»", rating: "Avaliação das residentes" },
    quick: {
      eyebrow: "Acesso rápido · Quartel",
      items: { castings: { label: "Castings", hint: "Convocatórias e respostas «Pronta»" }, manifest: { label: "Manifesto", hint: "Tours, equipes, salas de acordo" }, pulse: { label: "Pulso", hint: "Comparecimento e avaliações" }, blacklist: { label: "Lista negra", hint: "Motivos, denúncias, recursos" }, keys: { label: "Chaves", hint: "Seu nível de parceiro" }, settings: { label: "Avisos", hint: "Alertas de trabalho no Telegram" } },
    },
    in: (d) => `em ${d}`,
    ago: (d) => `há ${d}`,
    left: (d) => `faltam ${d}`,
    projects: { shoot: "ensaio", show: "desfile", campaign: "campanha", event: "evento" },
    state: {
      loading: "Carregando seu painel…",
      retry: "Tentar de novo",
      stale: (time) => `Não foi possível atualizar — dados das ${time}`,
      error: {
        forbidden: "O quartel é só para gerentes do clube",
        missing: "O banco de dados ainda não foi atualizado",
        network: "Sem conexão com o servidor",
        unknown: "Não foi possível carregar o painel",
      },
      errorHint: {
        forbidden: "Sua conta não tem a função de gerente. Fale com o administrador do clube.",
        missing: "Aplique a migração partner_command no Supabase e recarregue a página.",
        network: "Verifique sua conexão — o painel tentará de novo sozinho.",
        unknown: "Tente em um minuto. Se repetir, envie o erro ao administrador.",
      },
    },
    alerts: {
      eyebrow: "Alerts",
      title: "Requer atenção",
      clear: "Tudo sob controle: nenhuma decisão pendente.",
      dismiss: "Ocultar",
      text: {
        option: (c, w) => `Opção expirando: ${c} · ${w}`,
        contract: (s, r, w) => (r === null ? `Sem contrato · ${w}` : `Contrato não assinado: ${s ?? 0} de ${r} · ${w}`),
        docs: (n, w) => `${n} ${one(n, "participante não enviou", "participantes não enviaram")} documentos · ${w}`,
        replacement: (w) => `Desistência em «${w}» — substituta encontrada`,
        responses: (n, w) => `${n} ${one(n, "nova resposta", "novas respostas")} no casting «${w}»`,
      },
      contractHint: "Não pague as passagens até todos assinarem.",
      action: { option: "Confirmar", contract: "Abrir contrato", docs: "Lembrar", replacement: "Revisar", responses: "Abrir casting" },
      remindSign: "Lembrar da assinatura",
    },
    castings: {
      eyebrow: "Castings",
      title: "Castings ativos",
      create: "Novo casting",
      all: "Todos os castings",
      open: "Abrir",
      stage: { open: "Aberto", shortlist: "Pré-seleção" },
      closing: "Fecha em breve",
      ready: (n, s) => `${n} «Pronta» · ${s} ${one(s, "vaga", "vagas")}`,
      fresh: (n) => `+${n} ${one(n, "nova", "novas")}`,
      closesIn: (d) => `Fecha em ${d}`,
      blind: "Casting às cegas: nome e perfil liberados após o acordo",
      days: (n) => `${n} ${one(n, "dia", "dias")}`,
      snaps: (f, t) => `Live Snap ≤ 24 h · ${f}/${t}`,
      trusted: (n, t) => `Trusted · ${n}/${t}`,
      avatar: (c, s, tr) => `${c} · ${s}${tr ? " · Trusted" : ""} — abrir ficha da candidata`,
      avatarOpen: (n, c, s, tr) => `${n} (${c}) · ${s}${tr ? " · Trusted" : ""} — abrir perfil`,
      handshakes: (n) => `Acordo · ${n}`,
      noSnap: "sem Live Snap",
    },
    manifest: {
      eyebrow: "Manifest",
      title: "Partidas · 72 horas",
      all: "Manifesto completo",
      now: "Agora",
      empty: "Nenhuma partida nas próximas 72 horas.",
      status: { confirmed: "Confirmado", contract: "Aguardando assinaturas", docs: "Aguardando documentos", replacement: "Desistência → Substituta" },
      departsIn: (d) => `parte em ${d}`,
      crew: (n) => `${n} ${one(n, "participante", "participantes")}`,
      docs: (a, b) => `documentos ${a}/${b}`,
      replacement: "Substituta confirmada:",
      docsOk: "documentos verificados",
      docsMissing: "aguardando documentos",
      room: "Sala do tour",
    },
    radar: {
      eyebrow: "Radar",
      title: "Radar",
      live: "Live",
      clean: "Suas equipes estão limpas: nenhuma das suas participantes está na Blacklist.",
      dirty: "Uma participante da sua equipe entrou na Blacklist — confira seus tours.",
      blacklist: "Blacklist",
      allBlacklist: "Ver tudo",
      reason: { noShow: "Faltou a um tour confirmado", fakePhotos: "Fotos falsas", fraud: "Fraude / violação das regras" },
      status: { confirmed: "Confirmado", appeal: "Em recurso" },
      verified: "Novos verificados",
      allVerified: "Ver todos",
      verifiedAgo: (d) => `Verificado há ${d}`,
      early: (tier, d) => `Acesso antecipado ${tier} · abre em ${d}`,
      hidden: "Perfil oculto",
      openProfile: "Abrir perfil",
      cm: "cm",
      reviews: "Avaliações das Chaves",
      allReviews: "Ver todas",
      reviewsEmpty: "Ainda sem avaliações novas — elas aparecem após tours concluídos.",
      from: (tier) => `de ${tier}`,
      tags: {
        punctual: "Pontual",
        professional: "Profissional",
        matchesSnaps: "Igual aos snaps",
        communicative: "Responde rápido",
        teamPlayer: "Trabalha em equipe",
      },
    },
  },
};

/* ══════════════════════════════════════════════════════════════════
 * ФОРМАТИРОВАНИЕ
 * ══════════════════════════════════════════════════════════════════ */

function makeFmt(t: Dict, u: Units, now: number, lang: Lang) {
  const ready = now > 0;
  const span = (ms: number) => fmtDur(ms / MIN, u);
  return {
    ready,
    now,
    units: u,
    until: (at: number) => (ready ? span(at - now) : "—"),
    since: (at: number) => (ready ? span(now - at) : "—"),
    ago: (at: number) => (ready ? t.ago(span(now - at)) : "—"),
    left: (at: number) => (ready ? t.left(span(at - now)) : "—"),
    date: (at: number, o: Intl.DateTimeFormatOptions) =>
      ready ? new Intl.DateTimeFormat(t.locale, o).format(at) : "—",
    range: (a: number, b: number) => {
      if (!ready) return "—";
      const df = new Intl.DateTimeFormat(t.locale, { day: "numeric", month: "short" });
      return typeof df.formatRange === "function" ? df.formatRange(a, b) : `${df.format(a)} – ${df.format(b)}`;
    },
    num: (n: number, digits = 0) =>
      new Intl.NumberFormat(t.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
    city: (raw: string | null) => cityLabel(raw, lang),
  };
}
type Fmt = ReturnType<typeof makeFmt>;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Имя-заглушка AuthContext, когда full_name пуст */
const AUTH_FALLBACK_NAME = "Резидент";
type AuthUser = NonNullable<ReturnType<typeof useAuth>["user"]>;
function firstName(user: AuthUser | null) {
  const full = user?.fullName?.trim();
  if (full && full !== AUTH_FALLBACK_NAME) return full.split(/\s+/)[0];
  return user?.email?.split("@")[0] ?? "";
}

/* ══════════════════════════════════════════════════════════════════
 * ВИЗУАЛЬНЫЕ ТОКЕНЫ
 * ══════════════════════════════════════════════════════════════════ */

type Tone = "gold" | "emerald" | "amber" | "rose" | "zinc";

const PILL: Record<Tone, string> = {
  gold: "border-amber-200/30 bg-amber-200/10 text-amber-100",
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  rose: "border-rose-400/30 bg-rose-500/10 text-rose-200",
  zinc: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
};
const ROW: Record<Tone, string> = {
  gold: "border-amber-200/15 bg-amber-200/[0.03]",
  emerald: "border-emerald-400/15 bg-emerald-400/[0.03]",
  amber: "border-amber-400/20 bg-amber-400/[0.04]",
  rose: "border-rose-400/25 bg-rose-500/[0.06]",
  zinc: "border-zinc-800 bg-zinc-900/40",
};
const BAR: Record<Tone, string> = {
  gold: "bg-amber-200/70",
  emerald: "bg-emerald-400/70",
  amber: "bg-amber-400/80",
  rose: "bg-rose-400",
  zinc: "bg-zinc-600",
};
const ICON_RING: Record<Tone, string> = {
  gold: "border-amber-200/25 bg-amber-200/10 text-amber-200",
  emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  rose: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  zinc: "border-zinc-700 bg-zinc-800 text-zinc-300",
};
const DOT: Record<Tone, string> = {
  gold: "bg-amber-200 ring-amber-200/15",
  emerald: "bg-emerald-300 ring-emerald-400/15",
  amber: "bg-amber-300 ring-amber-400/15",
  rose: "bg-rose-300 ring-rose-400/20",
  zinc: "bg-zinc-400 ring-zinc-500/20",
};

const ALERT_META: Record<AlertKind, { tone: Tone; icon: LucideIcon; rank: number }> = {
  option: { tone: "rose", icon: Hourglass, rank: 0 },
  contract: { tone: "rose", icon: PenLine, rank: 1 },
  docs: { tone: "amber", icon: FileText, rank: 2 },
  replacement: { tone: "amber", icon: RefreshCw, rank: 3 },
  responses: { tone: "gold", icon: Sparkles, rank: 4 },
};
// Красный — только срыв; «ждём» (подписи, документы) — янтарный, как печать контракта
const FLIGHT_TONE: Record<FlightStatus, Tone> = {
  confirmed: "emerald",
  contract: "amber",
  docs: "amber",
  replacement: "rose",
};

const TIER_LABEL: Record<KeyTier, string> = { silver: "Silver Key", gold: "Gold Key", platinum: "Platinum Key" };
const TIER_TEXT: Record<KeyTier, string> = {
  silver: "from-zinc-100 via-zinc-300 to-zinc-500",
  gold: "from-amber-100 via-amber-200 to-amber-500",
  platinum: "from-zinc-50 via-sky-100 to-zinc-300",
};
const BLIND_AVATAR = [
  "from-amber-200/40 to-zinc-800",
  "from-zinc-400/40 to-zinc-800",
  "from-amber-500/30 to-zinc-900",
  "from-rose-200/25 to-zinc-800",
];

const BTN_GOLD =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-200 px-4 text-xs font-medium tracking-wide text-zinc-950 shadow-[0_0_24px_-8px_rgba(253,230,138,0.6)] transition hover:bg-amber-100 active:scale-[0.98] sm:min-h-9";
const BTN_GHOST =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-4 text-xs tracking-wide text-zinc-200 transition hover:border-amber-200/40 hover:text-amber-100 active:scale-[0.98] disabled:pointer-events-none disabled:border-emerald-400/25 disabled:bg-emerald-400/[0.06] disabled:text-emerald-200 sm:min-h-9";
const LINK_SUBTLE =
  "inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-amber-200 sm:min-h-0";

/* ══════════════════════════════════════════════════════════════════
 * АТОМЫ
 * ══════════════════════════════════════════════════════════════════ */

function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  icon: Icon,
  count,
  action,
}: {
  eyebrow: string;
  title: string;
  icon: LucideIcon;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          <Icon className="size-3.5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
          {eyebrow}
        </p>
        <h2 className={`${cormorant.className} mt-1.5 flex items-center gap-2.5 text-2xl font-medium text-zinc-50 md:text-[1.7rem]`}>
          <span className="truncate">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/10 px-1.5 font-sans text-[11px] font-medium text-amber-100">
              {count}
            </span>
          )}
        </h2>
      </div>
      {action}
    </div>
  );
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${PILL[tone]}`}
    >
      {children}
    </span>
  );
}

/** Сводный сигнал в карточке кастинга: «Live Snap ≤ 24 ч · 5/7» */
function SignalChip({ tone, icon: Icon, children }: { tone: Tone; icon: LucideIcon; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${PILL[tone]}`}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {children}
    </span>
  );
}

function LiveDot({ label }: { label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-emerald-300/80">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full rounded-full bg-emerald-400/60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      {label}
    </span>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-400">
      <Icon className="size-5 shrink-0 text-emerald-300/80" strokeWidth={1.5} aria-hidden />
      {text}
    </div>
  );
}

function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-48 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-amber-500/[0.07] blur-[120px]" />
      <div className="absolute -right-40 top-[38rem] h-96 w-96 rounded-full bg-amber-200/[0.04] blur-[100px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_60%)]" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * HEADER: приветствие · Ключ · Pulse
 * ══════════════════════════════════════════════════════════════════ */

function CommandHeader({
  t,
  fmt,
  manager,
  pending,
  demo,
}: {
  t: Dict;
  fmt: Fmt;
  manager: ManagerSnapshot | null;
  /** Первая загрузка — вместо Ключа и Pulse мерцающие заглушки */
  pending: boolean;
  demo: boolean;
}) {
  const { user, loading } = useAuth();
  const name = firstName(user);
  const hour = fmt.ready ? new Date(fmt.now).getHours() : null;
  const greeting =
    hour === null
      ? t.greet.neutral
      : hour < 5
        ? t.greet.night
        : hour < 12
          ? t.greet.morning
          : hour < 18
            ? t.greet.day
            : t.greet.evening;

  return (
    // Раскладка по ширине контента, а не экрана: карточки встают рядом
    // с приветствием, только когда им хватает места (сайдбар съедает 288 px)
    <header className="flex flex-wrap items-end gap-x-10 gap-y-6">
      <div className="min-w-0 flex-[1_1_30rem]">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-amber-200/70">
            <span aria-hidden className="h-px w-8 bg-gradient-to-r from-amber-200/0 to-amber-200/60" />
            {t.eyebrow}
          </p>
          {demo && (
            <span className="rounded-full border border-zinc-700/80 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
              {t.demo}
            </span>
          )}
        </div>

        <h1 className={`${cormorant.className} mt-4 text-[2.5rem] font-medium leading-[1.05] text-zinc-50 md:text-6xl`}>
          {greeting}
          {name ? (
            <>
              ,{" "}
              <span className="bg-gradient-to-r from-amber-100 via-amber-200 to-amber-500 bg-clip-text text-transparent">
                {name}
              </span>
            </>
          ) : (
            loading && (
              <span aria-hidden className="ml-3 inline-block h-9 w-40 animate-pulse rounded-lg bg-zinc-800/60 align-middle" />
            )
          )}
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">{t.subtitle}</p>
        <p className="mt-1.5 text-xs text-zinc-500 first-letter:uppercase">
          {fmt.date(fmt.now, { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {(manager || pending) && (
        <div className="flex min-w-0 flex-[1_1_34rem] flex-wrap gap-3">
          {manager ? (
            <>
              <KeyCard t={t} manager={manager} />
              <PulseCard t={t} manager={manager} />
            </>
          ) : (
            <>
              <div className="h-[92px] min-w-0 flex-[1_1_15rem] animate-pulse rounded-2xl border border-zinc-800/80 bg-zinc-900/40" />
              <div className="h-[92px] min-w-0 flex-[1_1_17rem] animate-pulse rounded-2xl border border-zinc-800/80 bg-zinc-900/40" />
            </>
          )}
        </div>
      )}
    </header>
  );
}

function KeyCard({ t, manager }: { t: Dict; manager: ManagerSnapshot }) {
  const next = manager.nextTier;
  const target = manager.toursForNext;
  const left = target !== null ? Math.max(0, target - manager.toursDone) : 0;
  const progress = next && target ? clamp(manager.toursDone / target, 0, 1) : 1;
  // Туров хватает, но Ключ не вырос — держит оценка резиденток
  const caption = !next ? t.key.top : left > 0 ? t.key.toNext(left, TIER_LABEL[next]) : t.key.ratingGate;

  return (
    <Link
      href={ROUTES.keys}
      className="group relative flex min-w-0 flex-[1_1_15rem] items-center gap-4 overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-200/[0.07] via-zinc-900/60 to-zinc-950/80 p-4 backdrop-blur-xl transition-colors hover:border-amber-200/35"
    >
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-amber-300/10 blur-2xl" />
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-zinc-950/60 shadow-[0_0_24px_-6px_rgba(253,230,138,0.45)]">
        <KeyRound className="size-5 text-amber-200" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.key.label}</p>
        <p
          className={`${cormorant.className} bg-gradient-to-r ${TIER_TEXT[manager.tier]} bg-clip-text text-2xl font-semibold leading-tight text-transparent`}
        >
          {TIER_LABEL[manager.tier]}
        </p>
        <div
          role="progressbar"
          aria-label={caption}
          aria-valuemin={0}
          aria-valuemax={target ?? 1}
          aria-valuenow={target ? Math.min(manager.toursDone, target) : 1}
          className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-200 transition-[width] duration-700"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-1.5 truncate text-[11px] text-zinc-400">{caption}</p>
      </div>
    </Link>
  );
}

function PulseCard({ t, manager }: { t: Dict; manager: ManagerSnapshot }) {
  const gradientId = `pulse-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rate = manager.confirmed > 0 ? Math.round((manager.flown / manager.confirmed) * 100) : null;
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <Link
      href={ROUTES.pulse}
      className="group flex min-w-0 flex-[1_1_17rem] items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 backdrop-blur-xl transition-colors hover:border-amber-200/30"
    >
      <div className="relative size-16 shrink-0">
        <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgb(39 39 42)" strokeWidth="4" />
          {rate !== null && (
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - rate / 100)}
              className="transition-[stroke-dashoffset] duration-700"
            />
          )}
        </svg>
        <span className={`${cormorant.className} absolute inset-0 flex items-center justify-center text-lg font-semibold text-zinc-50`}>
          {rate !== null ? `${rate}%` : "—"}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{t.pulse.label}</p>
        <p className="mt-1 text-sm leading-snug text-zinc-200">{t.pulse.caption}</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          {rate !== null ? t.pulse.foot(manager.flown, manager.confirmed) : t.pulse.empty}
        </p>
      </div>
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * KPI
 * ══════════════════════════════════════════════════════════════════ */

function KpiStrip({ items }: { items: { label: string; value: string; icon: LucideIcon }[] }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
        >
          <Icon className="absolute right-3.5 top-3.5 size-4 text-zinc-600" strokeWidth={1.5} aria-hidden />
          <p className={`${cormorant.className} text-3xl font-medium leading-none text-zinc-50 md:text-4xl`}>{value}</p>
          <p className="mt-2 text-[10px] uppercase leading-snug tracking-[0.2em] text-zinc-500">{label}</p>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * БЫСТРЫЙ ДОСТУП: разделы Штаба одной строкой
 * ══════════════════════════════════════════════════════════════════ */

type QuickKey = "castings" | "manifest" | "pulse" | "blacklist" | "keys" | "settings";

const QUICK: { key: QuickKey; href: string; icon: LucideIcon }[] = [
  { key: "castings", href: ROUTES.castings, icon: Sparkles },
  { key: "manifest", href: ROUTES.manifest, icon: Plane },
  { key: "pulse", href: ROUTES.pulse, icon: RadarIcon },
  { key: "blacklist", href: ROUTES.blacklist, icon: ShieldAlert },
  { key: "keys", href: ROUTES.keys, icon: KeyRound },
  { key: "settings", href: ROUTES.settings, icon: Bell },
];

function QuickAccess({ t }: { t: Dict }) {
  return (
    <nav aria-label={t.quick.eyebrow} className="mt-6">
      <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-amber-200/60">{t.quick.eyebrow}</p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="group flex min-h-16 items-start gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 px-3.5 py-3 transition-colors hover:border-amber-200/30 hover:bg-amber-200/[0.04]"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm text-zinc-100 group-hover:text-amber-50">{t.quick.items[key].label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{t.quick.items[key].hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * ALERTS: требует внимания
 * ══════════════════════════════════════════════════════════════════ */

function alertText(a: AlertItem, t: Dict, fmt: Fmt) {
  const what = `${fmt.city(a.city)} · ${t.projects[a.project]}`;
  switch (a.kind) {
    case "option":
      return t.alerts.text.option(a.code ?? "", what);
    case "contract":
      return t.alerts.text.contract(a.signed ?? null, a.required ?? null, what);
    case "docs":
      return t.alerts.text.docs(a.count ?? 0, what);
    case "replacement":
      return t.alerts.text.replacement(what);
    case "responses":
      return t.alerts.text.responses(a.count ?? 0, what);
  }
}

function alertHref(a: AlertItem) {
  switch (a.kind) {
    case "option":
    case "responses":
      return a.castingId ? ROUTES.casting(a.castingId) : ROUTES.castings;
    case "contract":
      return a.tourId ? ROUTES.dealRoom(a.tourId) : ROUTES.manifest;
    default:
      return a.tourId ? ROUTES.tour(a.tourId) : ROUTES.manifest;
  }
}

/** Демо: чем ответит очередь Telegram (в live — ответ сервера) */
const DEMO_NOTIFY: Record<"docs" | "contract", NotifyResult> = {
  docs: { queued: 1, missing: ["Ana R."], throttled: 0 },
  contract: { queued: 3, missing: [], throttled: 0 },
};

function AlertsPanel({ t, fmt, alerts }: { t: Dict; fmt: Fmt; alerts: AlertItem[] }) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  const visible = alerts
    .filter((a) => !dismissed.has(a.id))
    .sort((a, b) => ALERT_META[a.kind].rank - ALERT_META[b.kind].rank || a.at - b.at);

  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.alerts.eyebrow} title={t.alerts.title} icon={Bell} count={visible.length} />

      {visible.length === 0 ? (
        <EmptyState icon={ShieldCheck} text={t.alerts.clear} />
      ) : (
        <ul className="mt-5 space-y-2.5">
          {visible.map((a) => {
            const meta = ALERT_META[a.kind];
            const Icon = meta.icon;
            const ahead = a.kind === "option" || a.kind === "docs" || a.kind === "contract";
            const urgent = a.kind === "option" && fmt.ready && a.at - fmt.now < 3 * HOUR;
            const tourId = a.tourId;

            return (
              <li
                key={a.id}
                className={`relative flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-xl border p-4 ${ROW[meta.tone]}`}
              >
                <span aria-hidden className={`absolute inset-y-3 left-0 w-0.5 rounded-full ${BAR[meta.tone]}`} />

                <div className="flex min-w-0 flex-[1_1_16rem] items-start gap-3">
                  <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border ${ICON_RING[meta.tone]}`}>
                    <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-zinc-100">{alertText(a, t, fmt)}</p>
                    <p className={`mt-1 flex items-center gap-1.5 text-xs ${urgent ? "text-rose-300" : "text-zinc-500"}`}>
                      <Clock className={`size-3 shrink-0 ${urgent ? "motion-safe:animate-pulse" : ""}`} aria-hidden />
                      {ahead ? fmt.left(a.at) : fmt.ago(a.at)}
                    </p>
                    {a.kind === "contract" && (
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-200/90">
                        <ShieldAlert className="size-3 shrink-0" aria-hidden />
                        {t.alerts.contractHint}
                      </p>
                    )}
                  </div>
                </div>

                <div className="ml-auto flex flex-wrap items-start justify-end gap-1.5">
                  {/* Напоминания уходят в Telegram через бота — с загрузкой и итогом отправки */}
                  {a.kind === "docs" && tourId && (
                    <TelegramAction
                      label={t.alerts.action.docs}
                      run={() => notifyTour(tourId, "docs_reminder", undefined, DEMO_NOTIFY.docs)}
                    />
                  )}
                  {a.kind === "contract" && tourId && a.required !== null && (
                    <TelegramAction
                      label={t.alerts.remindSign}
                      run={() => notifyTour(tourId, "contract_reminder", undefined, DEMO_NOTIFY.contract)}
                    />
                  )}
                  {a.kind !== "docs" && (
                    <Link href={alertHref(a)} className={a.kind === "option" || a.kind === "contract" ? BTN_GOLD : BTN_GHOST}>
                      {t.alerts.action[a.kind]}
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  )}
                  <button
                    type="button"
                    aria-label={t.alerts.dismiss}
                    title={t.alerts.dismiss}
                    onClick={() => setDismissed((prev) => new Set(prev).add(a.id))}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 sm:size-9"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * CASTINGS: активные кастинги
 * ══════════════════════════════════════════════════════════════════ */

function CastingsSection({ t, fmt, castings }: { t: Dict; fmt: Fmt; castings: CastingItem[] }) {
  return (
    <section>
      <SectionHeader
        eyebrow={t.castings.eyebrow}
        title={t.castings.title}
        icon={Sparkles}
        count={castings.length}
        action={
          <Link href={ROUTES.newCasting} className={BTN_GOLD} aria-label={t.castings.create}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t.castings.create}</span>
          </Link>
        }
      />

      {/* auto-fill: колонок столько, сколько влезает карточек ≥ 17rem */}
      <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
        {castings.map((c) => (
          <CastingCard key={c.id} c={c} t={t} fmt={fmt} />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <Link href={ROUTES.castings} className={LINK_SUBTLE}>
          {t.castings.all}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

const SHOWN_AVATARS = 6;

/**
 * Карточка кастинга. Вся карточка ведёт в кастинг (прозрачная ссылка-подложка),
 * а аватары поверх — свои ссылки: <a> внутри <a> в HTML нельзя.
 *   после рукопожатия → профиль участницы
 *   до рукопожатия    → слепая карточка кандидатки внутри кастинга
 */
function CastingCard({ c, t, fmt }: { c: CastingItem; t: Dict; fmt: Fmt }) {
  const ready = c.responders.length;
  const closingSoon = fmt.ready && c.closesAt - fmt.now < 6 * HOUR;
  const fill = clamp(ready / c.slots, 0, 1);
  const days = Math.round((c.endsAt - c.startsAt) / DAY) + 1;
  // открытые профили — первыми
  const ordered = [...c.responders].sort((a, b) => Number(b.handshake) - Number(a.handshake));
  const shown = ordered.slice(0, SHOWN_AVATARS);
  const extra = Math.max(0, ready - shown.length);
  const freshSnaps = c.responders.filter((r) => isFreshSnap(r.snapAt, fmt.now)).length;
  const trusted = c.responders.filter((r) => r.trusted).length;
  const handshakes = c.responders.filter((r) => r.handshake && r.residentId).length;
  const title = `${fmt.city(c.city)} · ${t.projects[c.project]}`;

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-colors duration-300 hover:border-amber-200/30">
      <Link
        href={ROUTES.casting(c.id)}
        aria-label={title}
        className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200/60"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-amber-300/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] uppercase tracking-[0.26em] text-zinc-500">
            {t.projects[c.project]} · {t.castings.days(days)}
          </p>
          <h3 className={`${cormorant.className} mt-1 truncate text-[1.7rem] font-medium leading-tight text-zinc-50`}>
            {fmt.city(c.city)}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400">{fmt.range(c.startsAt, c.endsAt)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Pill tone={closingSoon ? "amber" : c.stage === "shortlist" ? "gold" : "emerald"}>
            {closingSoon ? t.castings.closing : t.castings.stage[c.stage]}
          </Pill>
          {c.fresh > 0 && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">
              {t.castings.fresh(c.fresh)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs text-zinc-300">{t.castings.ready(ready, c.slots)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-200 transition-[width] duration-700"
            style={{ width: `${fill * 100}%` }}
          />
        </div>
      </div>

      {/* Шорт-лист: кольцо — свежесть Live Snap, звезда — Trusted.
          Инициалы — рукопожатие состоялось, профиль открыт; замок — слепой код */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2 py-0.5 pl-0.5">
          {shown.map((r, i) => {
            const snap = snapState(r.snapAt, fmt.now);
            const snapLabel = r.snapAt === null ? t.castings.noSnap : `Live Snap ${fmt.ready ? fmt.since(r.snapAt) : ""}`.trim();
            const open = r.handshake && !!r.residentId && !!r.name;
            const label = open
              ? t.castings.avatarOpen(r.name ?? "", r.code, snapLabel, r.trusted)
              : t.castings.avatar(r.code, snapLabel, r.trusted);
            return (
              <Link
                key={r.code}
                href={open && r.residentId ? ROUTES.resident(r.residentId) : ROUTES.castingCandidate(c.id, r.code)}
                title={label}
                aria-label={label}
                className={`relative z-[2] flex size-8 items-center justify-center rounded-full border-2 border-zinc-900 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                  open
                    ? "bg-gradient-to-br from-amber-200/40 to-zinc-800"
                    : `bg-gradient-to-br ${BLIND_AVATAR[i % BLIND_AVATAR.length]}`
                } ${SNAP_RING[snap]}`}
              >
                {open ? (
                  <span className={`${cormorant.className} text-[13px] font-semibold leading-none text-amber-50`}>
                    {initials(r.name ?? "")}
                  </span>
                ) : (
                  <Lock className="size-3 text-zinc-200/60" strokeWidth={1.75} aria-hidden />
                )}
                {r.trusted && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-amber-200 ring-2 ring-zinc-900"
                  >
                    <Star className="size-2 fill-zinc-950 text-zinc-950" />
                  </span>
                )}
              </Link>
            );
          })}
          {extra > 0 && (
            <span className="flex size-8 items-center justify-center rounded-full border-2 border-zinc-900 bg-zinc-800 text-[10px] font-medium text-zinc-300">
              +{extra}
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-zinc-500">{t.castings.blind}</p>
      </div>

      {ready > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SignalChip tone={freshSnaps > 0 ? "emerald" : "zinc"} icon={Camera}>
            {t.castings.snaps(freshSnaps, ready)}
          </SignalChip>
          <SignalChip tone={trusted > 0 ? "gold" : "zinc"} icon={ShieldCheck}>
            {t.castings.trusted(trusted, ready)}
          </SignalChip>
          {handshakes > 0 && (
            <SignalChip tone="emerald" icon={BadgeCheck}>
              {t.castings.handshakes(handshakes)}
            </SignalChip>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-800/80 pt-4 text-xs">
        <span className={`flex min-w-0 items-center gap-1.5 ${closingSoon ? "text-amber-200" : "text-zinc-400"}`}>
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{fmt.ready ? t.castings.closesIn(fmt.until(c.closesAt)) : "—"}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-amber-200/90 transition-transform duration-300 group-hover:translate-x-0.5">
          {t.castings.open}
          <ChevronRight className="size-3.5" aria-hidden />
        </span>
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * MANIFEST: вылеты на 72 часа
 * ══════════════════════════════════════════════════════════════════ */

const TRACK_HOURS = 72;

function ManifestPanel({ t, fmt, flights }: { t: Dict; fmt: Fmt; flights: FlightItem[] }) {
  const sorted = [...flights].sort((a, b) => a.departsAt - b.departsAt);

  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader
        eyebrow={t.manifest.eyebrow}
        title={t.manifest.title}
        icon={Plane}
        action={
          <Link href={ROUTES.manifest} className={LINK_SUBTLE}>
            {t.manifest.all}
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState icon={Plane} text={t.manifest.empty} />
      ) : (
        <>
          <ManifestTrack t={t} fmt={fmt} flights={sorted} />
          <ol className="mt-5 space-y-3">
            {sorted.map((f) => (
              <FlightRow key={f.id} f={f} t={t} fmt={fmt} />
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}

/** Шкала «сейчас → +72 ч» с отметками вылетов (только ≥ md) */
function ManifestTrack({ t, fmt, flights }: { t: Dict; fmt: Fmt; flights: FlightItem[] }) {
  const ticks = [0, 24, 48, 72];
  return (
    <div aria-hidden className="relative mt-8 hidden h-14 md:block">
      <div className="absolute inset-x-0 top-7 h-px bg-gradient-to-r from-amber-200/70 via-zinc-700 to-zinc-800" />

      {ticks.map((h, i) => (
        <div
          key={h}
          className={`absolute top-7 flex flex-col ${
            i === 0 ? "items-start" : i === ticks.length - 1 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center"
          }`}
          style={{ left: `${(h / TRACK_HOURS) * 100}%` }}
        >
          <span className={`h-2 w-px ${i === 0 ? "bg-amber-200/70" : "bg-zinc-600"}`} />
          <span
            className={`mt-1.5 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] ${i === 0 ? "text-amber-200/80" : "text-zinc-500"}`}
          >
            {h === 0 ? t.manifest.now : `+${h}${fmt.units.sep}${fmt.units.h}`}
          </span>
        </div>
      ))}

      {fmt.ready &&
        flights.map((f) => {
          const pct = clamp(((f.departsAt - fmt.now) / (TRACK_HOURS * HOUR)) * 100, 2, 98);
          const tone = FLIGHT_TONE[f.status];
          return (
            <div key={f.id} className="absolute top-7" style={{ left: `${pct}%` }}>
              <span
                className={`absolute left-0 top-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ${DOT[tone]}`}
              />
              <span className="absolute bottom-3 left-0 -translate-x-1/2 whitespace-nowrap rounded-full border border-zinc-700/80 bg-zinc-950/90 px-2 py-0.5 font-mono text-[10px] tracking-wider text-zinc-200">
                {f.iata ?? fmt.city(f.city).slice(0, 3).toUpperCase()}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function FlightRow({ f, t, fmt }: { f: FlightItem; t: Dict; fmt: Fmt }) {
  const docsReady = f.crew.filter((c) => c.docs).length;

  return (
    <li className="rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-4 transition-colors hover:border-zinc-700">
      {/* верх: время вылета · статус */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className={`${cormorant.className} text-xl font-medium leading-tight text-zinc-50 first-letter:uppercase`}>
            {fmt.date(f.departsAt, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-[11px] text-zinc-500">{fmt.ready ? t.manifest.departsIn(fmt.until(f.departsAt)) : "—"}</p>
        </div>
        <Pill tone={FLIGHT_TONE[f.status]}>{t.manifest.status[f.status]}</Pill>
      </div>

      {/* середина: рейс и состав · Комната тура */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-[1_1_15rem]">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-100">
            {f.iata && <span className="font-mono text-[11px] tracking-wider text-amber-200/90">{f.iata}</span>}
            <Link href={ROUTES.tour(f.id)} className="truncate transition-colors hover:text-amber-100">
              {fmt.city(f.city)} · {t.projects[f.project]}
            </Link>
            {f.flightNo && <span className="text-[11px] text-zinc-500">{f.flightNo}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* состав: имя — ссылка на профиль, цвет — документы */}
            {f.crew.map((c, i) => {
              const cls = `inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-[11px] transition ${
                c.docs
                  ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100 hover:border-emerald-300/60"
                  : "border-amber-400/30 bg-amber-400/[0.07] text-amber-100 hover:border-amber-300/60"
              }`;
              const body = (
                <>
                  {c.docs ? <Check className="size-3 shrink-0" aria-hidden /> : <FileText className="size-3 shrink-0" aria-hidden />}
                  <span className="truncate">{c.name}</span>
                </>
              );
              const hint = c.docs ? t.manifest.docsOk : t.manifest.docsMissing;
              return c.id ? (
                <Link key={c.id} href={ROUTES.resident(c.id)} title={`${c.name} · ${hint}`} className={cls}>
                  {body}
                </Link>
              ) : (
                <span key={`${c.name}-${i}`} title={hint} className={cls}>
                  {body}
                </span>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {t.manifest.crew(f.crew.length)} · {t.manifest.docs(docsReady, f.crew.length)}
          </p>
          {f.replacement && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-rose-200/90">
              <RefreshCw className="size-3 shrink-0" aria-hidden />
              {t.manifest.replacement}
              {f.replacementId ? (
                <Link href={ROUTES.resident(f.replacementId)} className="font-medium text-rose-100 underline-offset-4 hover:underline">
                  {f.replacement}
                </Link>
              ) : (
                <span className="font-medium text-rose-100">{f.replacement}</span>
              )}
            </p>
          )}
        </div>

        <Link href={ROUTES.dealRoom(f.id)} className={`${BTN_GHOST} ml-auto`}>
          <MessagesSquare className="size-3.5" aria-hidden />
          {t.manifest.room}
        </Link>
      </div>

      {/* низ: Digital Contract */}
      <div className="mt-3">
        <ContractSeal contract={f.contract} />
      </div>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * RADAR: Blacklist · новые анкеты · отзывы Ключей
 * ══════════════════════════════════════════════════════════════════ */

function RadarSubHeader({ icon: Icon, title, href, link }: { icon: LucideIcon; title: string; href: string; link: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300">
        <Icon className="size-3.5 shrink-0 text-amber-200/70" strokeWidth={1.5} aria-hidden />
        <span className="truncate">{title}</span>
      </p>
      <Link href={href} className={LINK_SUBTLE}>
        {link}
        <ChevronRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}

function RadarDivider() {
  return <div aria-hidden className="my-5 h-px bg-gradient-to-r from-transparent via-zinc-700/70 to-transparent" />;
}

function RadarPanel({ t, fmt, data }: { t: Dict; fmt: Fmt; data: CommandData }) {
  return (
    <Panel className="p-5 md:p-6">
      <SectionHeader eyebrow={t.radar.eyebrow} title={t.radar.title} icon={RadarIcon} action={<LiveDot label={t.radar.live} />} />

      {data.clean ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" strokeWidth={1.5} aria-hidden />
          <p className="text-xs leading-relaxed text-emerald-100/90">{t.radar.clean}</p>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-400/30 bg-rose-500/[0.08] p-3.5">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-rose-300" strokeWidth={1.5} aria-hidden />
          <p className="text-xs leading-relaxed text-rose-100/90">{t.radar.dirty}</p>
        </div>
      )}

      {/* Blacklist */}
      <div className="mt-6">
        <RadarSubHeader icon={ShieldAlert} title={t.radar.blacklist} href={ROUTES.blacklist} link={t.radar.allBlacklist} />
        <ul className="mt-2 divide-y divide-zinc-800/70">
          {data.blacklist.map((b) => {
            const body = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 font-mono text-[11px] tracking-wider text-zinc-500">{b.code}</span>
                    {b.name && (
                      <span className="truncate text-xs text-zinc-200 underline-offset-4 group-hover:text-amber-100 group-hover:underline">
                        {b.name}
                      </span>
                    )}
                  </p>
                  <Pill tone={b.status === "appeal" ? "amber" : "rose"}>{t.radar.status[b.status]}</Pill>
                </div>
                <p className="mt-1 text-sm leading-snug text-zinc-200">{t.radar.reason[b.reason]}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{fmt.ago(b.at)}</p>
              </>
            );
            // Профиль открыт, если с ней было рукопожатие (владелец и админ видят всех)
            return (
              <li key={b.id} className="py-1">
                {b.residentId ? (
                  <Link
                    href={ROUTES.resident(b.residentId)}
                    title={t.radar.openProfile}
                    className="group -mx-2 block rounded-lg px-2 py-2 transition-colors hover:bg-zinc-900/60"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <RadarDivider />

      {/* Новые анкеты: Live Snap + Trusted */}
      <div>
        <RadarSubHeader icon={BadgeCheck} title={t.radar.verified} href={ROUTES.residents} link={t.radar.allVerified} />
        <ul className="mt-2 space-y-1.5">
          {data.verified.map((v, i) => (
            <VerifiedRow key={v.id ?? `locked-${i}`} v={v} t={t} fmt={fmt} />
          ))}
        </ul>
      </div>

      <RadarDivider />

      {/* Отзывы Ключей */}
      <div>
        <RadarSubHeader icon={Quote} title={t.radar.reviews} href={ROUTES.pulse} link={t.radar.allReviews} />
        {data.reviews.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">{t.radar.reviewsEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {data.reviews.map((r) => (
              <ReviewCard key={r.id} r={r} t={t} fmt={fmt} />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

function VerifiedRow({ v, t, fmt }: { v: VerifiedItem; t: Dict; fmt: Fmt }) {
  // Без id и имени БД отдаёт анкету, пока она в раннем доступе старшего Ключа
  const locked = !v.id || !v.name || (v.earlyOpensAt !== null && (!fmt.ready || v.earlyOpensAt > fmt.now));
  const name = v.name;

  const body = (
    <>
      <span
        className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border ${
          locked ? "border-zinc-700 bg-zinc-800/80" : "border-amber-200/30 bg-gradient-to-br from-amber-200/25 to-zinc-800"
        }`}
      >
        {locked || !name ? (
          <Lock className="size-4 text-zinc-400" strokeWidth={1.5} aria-hidden />
        ) : (
          <span className={`${cormorant.className} text-base font-semibold text-amber-100`}>{initials(name)}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate text-sm ${locked ? "text-zinc-400" : "text-zinc-100"}`}>
            {locked || !name ? t.radar.hidden : name}
          </p>
          <p className="shrink-0 text-[11px] text-zinc-500">
            {fmt.city(v.city)}
            {v.height !== null && ` · ${v.height} ${t.radar.cm}`}
          </p>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <LiveSnapBadge at={v.snapAt} now={fmt.now} />
          {!locked && <TrustBadge trust={v.trust} />}
        </div>
        {locked && v.earlyOpensAt !== null ? (
          <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-amber-200/80">
            <KeyRound className="mt-px size-3 shrink-0" aria-hidden />
            <span>{t.radar.early(TIER_LABEL.platinum, fmt.until(v.earlyOpensAt))}</span>
          </p>
        ) : (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-300/80">
            <BadgeCheck className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{t.radar.verifiedAgo(fmt.since(v.at))}</span>
          </p>
        )}
      </div>
    </>
  );

  return (
    <li>
      {locked || !v.id ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-zinc-800 p-3">{body}</div>
      ) : (
        <Link
          href={ROUTES.resident(v.id)}
          className="flex items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-zinc-800 hover:bg-zinc-900/60"
        >
          {body}
        </Link>
      )}
    </li>
  );
}

function ReviewCard({ r, t, fmt }: { r: ReviewItem; t: Dict; fmt: Fmt }) {
  return (
    <li className="rounded-xl border border-amber-200/10 bg-gradient-to-br from-amber-200/[0.05] via-zinc-900/30 to-transparent p-3.5">
      <div className="flex items-center justify-between gap-2">
        <Stars rating={r.rating} />
        <span className="text-[11px] text-zinc-500">{fmt.ago(r.at)}</span>
      </div>

      {r.quote && (
        <p className={`${cormorant.className} mt-2 text-[15px] leading-snug text-zinc-100`}>«{r.quote}»</p>
      )}

      {r.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {r.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-zinc-800 bg-zinc-900/70 px-2 py-0.5 text-[10px] text-zinc-300">
              {t.radar.tags[tag]}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className="min-w-0 truncate text-[11px] text-zinc-400">
          {r.residentId ? (
            <Link href={ROUTES.resident(r.residentId)} className="text-zinc-200 transition-colors hover:text-amber-100">
              {r.resident}
            </Link>
          ) : (
            <span className="text-zinc-200">{r.resident}</span>
          )}
          {" · "}
          {fmt.city(r.city)} · {t.radar.from(TIER_LABEL[r.authorTier])}
        </p>
        {r.trust.trusted && <TrustBadge trust={r.trust} />}
      </div>
    </li>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СОСТОЯНИЯ: загрузка · ошибка
 * ══════════════════════════════════════════════════════════════════ */

function CommandSkeleton({ t }: { t: Dict }) {
  const block = "animate-pulse rounded-2xl border border-zinc-800/80 bg-zinc-900/40";
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t.state.loading}</span>
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-[92px] ${block}`} />
        ))}
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-8">
          <div className={`h-72 ${block}`} />
          <div className={`h-80 ${block}`} />
        </div>
        <div className={`h-[34rem] ${block}`} />
      </div>
    </div>
  );
}

function ErrorPanel({ t, reason, onRetry }: { t: Dict; reason: keyof Dict["state"]["error"]; onRetry: () => void }) {
  const Icon = reason === "network" ? WifiOff : ShieldAlert;
  return (
    <Panel className="mt-8 p-6 md:p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${ICON_RING.rose}`}>
          <Icon className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`${cormorant.className} text-2xl font-medium text-zinc-50`}>{t.state.error[reason]}</h2>
          <p className="mt-1 text-sm text-zinc-400">{t.state.errorHint[reason]}</p>
        </div>
        {reason !== "forbidden" && (
          <button type="button" onClick={onRetry} className={BTN_GOLD}>
            <RotateCw className="size-3.5" aria-hidden />
            {t.state.retry}
          </button>
        )}
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * СТРАНИЦА
 * ══════════════════════════════════════════════════════════════════ */

export default function PartnerCommandPage() {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const now = useNow();
  const fmt = useMemo(() => makeFmt(t, UNITS[lang] ?? UNITS.EN, now, lang), [t, lang, now]);
  const { source, data, loading, refreshing, error, refresh } = useCommandData();

  // вылеты в окне 72 ч (на сервере время неизвестно — показываем все)
  const flights = useMemo(
    () =>
      data
        ? fmt.ready
          ? data.flights.filter((f) => f.departsAt > fmt.now && f.departsAt - fmt.now <= TRACK_HOURS * HOUR)
          : data.flights
        : [],
    [data, fmt],
  );

  const kpis = data
    ? [
        { label: t.kpi.castings, value: fmt.num(data.castings.length), icon: Sparkles },
        { label: t.kpi.departures, value: fmt.num(flights.length), icon: Plane },
        { label: t.kpi.ready, value: fmt.num(data.castings.reduce((s, c) => s + c.responders.length, 0)), icon: Users },
        {
          label: t.kpi.rating,
          value: data.manager.rating !== null ? fmt.num(data.manager.rating, 1) : "—",
          icon: Star,
        },
      ]
    : [];

  return (
    <div className="relative isolate min-h-full overflow-x-clip bg-zinc-950 text-zinc-100">
      <Ambient />

      <div className="mx-auto w-full max-w-[90rem] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pt-10 lg:px-10">
        <CommandHeader t={t} fmt={fmt} manager={data?.manager ?? null} pending={loading} demo={source === "mock"} />

        {/* Обновление не удалось, но данные есть — показываем их и предупреждаем */}
        {data && error && (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-100">
            <WifiOff className="size-4 shrink-0 text-amber-300" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0 flex-1">
              {t.state.stale(fmt.date(data.generatedAt, { hour: "2-digit", minute: "2-digit" }))}
            </span>
            <button type="button" onClick={refresh} disabled={refreshing} className={BTN_GHOST}>
              <RotateCw className={`size-3.5 ${refreshing ? "motion-safe:animate-spin" : ""}`} aria-hidden />
              {t.state.retry}
            </button>
          </div>
        )}

        {!data && loading && <CommandSkeleton t={t} />}
        {!data && !loading && error && <ErrorPanel t={t} reason={error.reason} onRetry={refresh} />}

        {data && (
          <>
            <KpiStrip items={kpis} />
            <QuickAccess t={t} />
            <PartnerGuide page="command" />

            {/* ≥ xl Радар — колонкой справа, ниже — после манифеста */}
            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="min-w-0 space-y-8">
                <AlertsPanel t={t} fmt={fmt} alerts={data.alerts} />
                <CastingsSection t={t} fmt={fmt} castings={data.castings} />
                <ManifestPanel t={t} fmt={fmt} flights={flights} />
              </div>

              <aside className="min-w-0">
                <RadarPanel t={t} fmt={fmt} data={data} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
