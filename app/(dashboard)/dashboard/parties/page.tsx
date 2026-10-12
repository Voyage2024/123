"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { submitEventApplication } from "@/app/actions/event-applications";
import { motion } from "framer-motion";
import { Check, Clock, GlassWater, Loader2, MapPin } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

// -----------------------------------------------------
// Types
// -----------------------------------------------------

type Lang = "EN" | "RU" | "ES" | "PT";

type GlobalEvent = {
  id: string;
  title: string;
  region: string;
  description: string | null;
  conditions: string | null;
  is_active: boolean;
  created_at: string;
};

type ApplicationStatus = "pending" | "approved" | "rejected";

type EventApplication = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
};

type Dict = (typeof T)[Lang];

type PartyCardProps = {
  event: GlobalEvent;
  userId: string;
  lang: Lang;
  t: Dict;
};

// -----------------------------------------------------
// Constants
// -----------------------------------------------------

const APPLICATION_FIELDS = "id,status,created_at,updated_at";
const EVENT_FIELDS =
  "id,title,region,description,conditions,is_active,created_at";
const SUPPORTED_LANGS: Lang[] = ["EN", "RU", "ES", "PT"];
const EASE = [0.22, 1, 0.36, 1] as const;

// -----------------------------------------------------
// Localization
// -----------------------------------------------------

const T = {
  EN: {
    title: "Private Events",
    subtitle: "Exclusive gatherings available to club residents.",
    activeEvents: "Active events",
    privateEvent: "Private event",
    empty: "There are no active events at the moment.",
    loading: "Loading...",
    authRequired: "Authorization is required to submit an application.",
    loadError: "Unable to load events.",
    apply: "Apply",
    activeApplication: "Application active",
    approved: "Approved",
    rejectedWait: "Rejected",
    availableFrom: "You can apply again from",
    conditions: "Conditions",
    details: "Details",
    created: "Added",
    applying: "Sending...",
    applicationError: "Unable to submit the application.",
    applicationSent: "Application sent.",
    mapLocation: "Open regional map",
    errors: {
      unauthenticated: "Please sign in to apply.", profile_missing: "Your profile could not be found. Contact support.",
      resident_only: "Applications are available to resident accounts only.", profile_not_approved: "Your profile has not passed Face Control yet.",
      banned: "Applications are unavailable while the account is restricted.", event_not_found: "This event is no longer available.",
      event_closed: "This event is closed.", application_closed: "The application period has ended.", kyc_required: "Insufficient KYC level. This event requires KYC{{level}}.",
      segment_not_eligible: "This event is reserved for another resident segment.", already_applied: "You already have an active application for this event.",
      rejection_cooldown: "A new application is available after the rejection cooldown.", event_full: "There are no places left for this event.", server_error: "A technical error occurred. Please try again later.",
    },
  },
  RU: {
    title: "Закрытые мероприятия",
    subtitle: "Эксклюзивные мероприятия, доступные резидентам клуба.",
    activeEvents: "Актуальные мероприятия",
    privateEvent: "Закрытое мероприятие",
    empty: "Сейчас активных мероприятий нет.",
    loading: "Загрузка...",
    authRequired: "Для подачи заявки необходимо авторизоваться.",
    loadError: "Не удалось загрузить мероприятия.",
    apply: "Подать заявку",
    activeApplication: "Заявка активна",
    approved: "Одобрено",
    rejectedWait: "Отказ",
    availableFrom: "Повторная заявка доступна с",
    conditions: "Условия",
    details: "Описание",
    created: "Добавлено",
    applying: "Отправка...",
    applicationError: "Не удалось отправить заявку.",
    applicationSent: "Заявка отправлена.",
    mapLocation: "Открыть карту региона",
    errors: {
      unauthenticated: "Войдите в аккаунт, чтобы подать заявку.", profile_missing: "Профиль не найден. Обратитесь в поддержку.",
      resident_only: "Подавать заявки могут только резиденты.", profile_not_approved: "Ваш профиль ещё не прошёл Face Control.",
      banned: "Во время ограничения аккаунта подавать заявки нельзя.", event_not_found: "Мероприятие больше недоступно.",
      event_closed: "Мероприятие закрыто.", application_closed: "Приём заявок завершён.", kyc_required: "Недостаточный уровень KYC. Для мероприятия нужен KYC{{level}}.",
      segment_not_eligible: "Мероприятие доступно для другого сегмента резидентов.", already_applied: "У вас уже есть активная заявка на это мероприятие.",
      rejection_cooldown: "Повторная заявка будет доступна после окончания периода ожидания.", event_full: "Свободных мест на мероприятие не осталось.", server_error: "Произошла техническая ошибка. Попробуйте позже.",
    },
  },
  ES: {
    title: "Eventos privados",
    subtitle: "Eventos exclusivos disponibles para los residentes del club.",
    activeEvents: "Eventos activos",
    privateEvent: "Evento privado",
    empty: "No hay eventos activos en este momento.",
    loading: "Cargando...",
    authRequired: "Debes iniciar sesión para enviar una solicitud.",
    loadError: "No se pudieron cargar los eventos.",
    apply: "Solicitar acceso",
    activeApplication: "Solicitud activa",
    approved: "Aprobada",
    rejectedWait: "Rechazada",
    availableFrom: "Podrás volver a solicitar desde el",
    conditions: "Condiciones",
    details: "Descripción",
    created: "Añadido",
    applying: "Enviando...",
    applicationError: "No se pudo enviar la solicitud.",
    applicationSent: "Solicitud enviada.",
    mapLocation: "Abrir mapa regional",
    errors: {
      unauthenticated: "Inicia sesión para solicitar acceso.", profile_missing: "No se encontró tu perfil. Contacta con soporte.",
      resident_only: "Solo las cuentas de residentes pueden solicitar acceso.", profile_not_approved: "Tu perfil aún no ha superado Face Control.",
      banned: "No puedes enviar solicitudes mientras la cuenta esté restringida.", event_not_found: "El evento ya no está disponible.",
      event_closed: "El evento está cerrado.", application_closed: "El plazo de solicitudes ha terminado.", kyc_required: "Nivel KYC insuficiente. Este evento requiere KYC{{level}}.",
      segment_not_eligible: "Este evento está reservado para otro segmento de residentes.", already_applied: "Ya tienes una solicitud activa para este evento.",
      rejection_cooldown: "Podrás volver a solicitar acceso cuando termine el periodo de espera.", event_full: "No quedan plazas para este evento.", server_error: "Ocurrió un error técnico. Inténtalo más tarde.",
    },
  },
  PT: {
    title: "Eventos privados",
    subtitle: "Eventos exclusivos disponíveis para residentes do clube.",
    activeEvents: "Eventos ativos",
    privateEvent: "Evento privado",
    empty: "Não há eventos ativos no momento.",
    loading: "Carregando...",
    authRequired: "É necessário estar autenticado para enviar uma solicitação.",
    loadError: "Não foi possível carregar os eventos.",
    apply: "Solicitar acesso",
    activeApplication: "Solicitação ativa",
    approved: "Aprovada",
    rejectedWait: "Recusada",
    availableFrom: "Nova solicitação disponível a partir de",
    conditions: "Condições",
    details: "Descrição",
    created: "Adicionado",
    applying: "Enviando...",
    applicationError: "Não foi possível enviar a solicitação.",
    applicationSent: "Solicitação enviada.",
    mapLocation: "Abrir mapa regional",
    errors: {
      unauthenticated: "Entre na conta para solicitar acesso.", profile_missing: "Seu perfil não foi encontrado. Fale com o suporte.",
      resident_only: "Somente contas de residentes podem solicitar acesso.", profile_not_approved: "Seu perfil ainda não passou pelo Face Control.",
      banned: "Não é possível enviar solicitações enquanto a conta estiver restrita.", event_not_found: "Este evento não está mais disponível.",
      event_closed: "Este evento está fechado.", application_closed: "O prazo de inscrição terminou.", kyc_required: "Nível KYC insuficiente. Este evento exige KYC{{level}}.",
      segment_not_eligible: "Este evento é reservado para outro segmento de residentes.", already_applied: "Você já tem uma solicitação ativa para este evento.",
      rejection_cooldown: "Uma nova solicitação ficará disponível após o período de espera.", event_full: "Não há mais vagas para este evento.", server_error: "Ocorreu um erro técnico. Tente novamente mais tarde.",
    },
  },
} satisfies Record<Lang, Record<string, unknown>>;

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

function normalizeLang(value: unknown): Lang {
  const v = String(value || "").toUpperCase();
  return SUPPORTED_LANGS.includes(v as Lang) ? (v as Lang) : "EN";
}

function mapHrefForRegion(region: string): string {
  const value = region.toLowerCase();
  if (/america|united states|usa|canada|mexico|сша|америк|канада|мексик/.test(value)) return "/destinations/americas";
  if (/asia|pacific|vietnam|thailand|indonesia|bali|cambodia|singapore|asia-pacific|азия|вьетнам|таиланд|индонез|камбодж|сингапур/.test(value)) return "/destinations/asia-pacific";
  if (/middle east|mena|dubai|uae|emirates|saudi|qatar|oman|ближн|оаэ|дубай|сауд|катар|оман/.test(value)) return "/destinations/middle-east";
  if (/europe|france|paris|spain|italy|germany|uk|london|европ|франц|париж|испан|итал|герман|лондон/.test(value)) return "/destinations/europe";
  return "/dashboard/map";
}

function getLocale(lang: Lang) {
  switch (lang) {
    case "RU":
      return "ru-RU";
    case "ES":
      return "es-ES";
    case "PT":
      return "pt-BR";
    default:
      return "en-US";
  }
}

function formatDate(value: string | Date, lang: Lang) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(getLocale(lang), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Дата, с которой снова можно подать заявку (updated_at + 1 месяц). */
function getCooldownUnlockDate(updatedAt: string): Date | null {
  const rejectedAt = new Date(updatedAt);
  if (Number.isNaN(rejectedAt.getTime())) return null;

  const unlock = new Date(rejectedAt);
  unlock.setMonth(unlock.getMonth() + 1);
  return unlock;
}

// -----------------------------------------------------
// Skeleton
// -----------------------------------------------------

function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-800/50 ${className}`}
    />
  );
}

function PartyCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-xl"
      aria-hidden
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1.2fr)_minmax(260px,1fr)_190px]">
        <div className="p-6 lg:p-7">
          <SkeletonLine className="mb-5 h-3 w-28" />
          <SkeletonLine className="mb-3 h-8 w-3/4" />
          <SkeletonLine className="h-4 w-32" />
        </div>

        <div className="space-y-3 border-t border-zinc-800/40 p-6 lg:border-l lg:border-t-0 lg:p-7">
          <SkeletonLine className="h-3 w-20" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-5/6" />
          <SkeletonLine className="h-4 w-2/3" />
        </div>

        <div className="flex items-center border-t border-zinc-800/40 p-6 lg:border-l lg:border-t-0 lg:p-7">
          <SkeletonLine className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </motion.div>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <PartyCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

// -----------------------------------------------------
// Party Card
// -----------------------------------------------------

function PartyCard({ event, userId, lang, t }: PartyCardProps) {
  const [application, setApplication] = useState<EventApplication | null>(
    null
  );
  const [checkingApplication, setCheckingApplication] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const formattedCreated = useMemo(
    () => formatDate(event.created_at, lang),
    [event.created_at, lang]
  );

  // ---------------------------------------------------
  // Load latest application for this event
  // ---------------------------------------------------

  const fetchApplication = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("event_applications")
      .select(APPLICATION_FIELDS)
      .eq("event_id", event.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data: data as EventApplication | null, fetchError };
  }, [event.id, userId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setCheckingApplication(true);
      setError("");

      const { data, fetchError } = await fetchApplication();
      if (!mounted) return;

      if (fetchError) {
        console.error("Event application check error:", fetchError);
        setError(t.applicationError);
        setApplication(null);
      } else {
        setApplication(data);
      }

      setCheckingApplication(false);
    })();

    return () => {
      mounted = false;
    };
  }, [fetchApplication, t.applicationError]);

  // ---------------------------------------------------
  // Derived state
  // ---------------------------------------------------

  const status = application?.status;
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isActiveApplication = isPending || isApproved;

  const unlockDate =
    status === "rejected" && application
      ? getCooldownUnlockDate(application.updated_at)
      : null;

  const cooldownActive = !!unlockDate && new Date() < unlockDate;

  const canApply =
    !checkingApplication &&
    !submitting &&
    (!application || (status === "rejected" && !cooldownActive));

  const buttonLabel = checkingApplication
    ? t.loading
    : submitting
      ? t.applying
      : isApproved
        ? t.approved
        : isPending
          ? t.activeApplication
          : cooldownActive
            ? t.rejectedWait
            : t.apply;

  // ---------------------------------------------------
  // Submit
  // ---------------------------------------------------

  const handleApply = async () => {
    if (!canApply) return;

    setSubmitting(true);
    setError("");
    setSuccess(false);

    const result = await submitEventApplication(event.id);

    if (!result.ok) {
      const reasonKey = result.reason as keyof typeof t.errors;
      let message = t.errors[reasonKey] ?? t.applicationError;
      if (result.reason === "kyc_required") {
        message = message.replace("{{level}}", String(result.requiredLevel ?? 2));
      }
      if (result.reason === "rejection_cooldown" && result.availableAt) {
        message = `${message} ${formatDate(new Date(result.availableAt), lang)}`;
      }
      if (["already_applied", "rejection_cooldown"].includes(result.reason)) {
        const { data: fresh } = await fetchApplication();
        if (fresh) setApplication(fresh);
      }
      setError(message);
      setSubmitting(false);
      return;
    }

    setApplication(result.application as EventApplication);
    setSuccess(true);
    setSubmitting(false);
  };

  // ---------------------------------------------------
  // Render
  // ---------------------------------------------------

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="
        group overflow-hidden rounded-2xl
        border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-xl
        transition-all duration-300
        hover:border-amber-200/20 hover:bg-zinc-900/55
      "
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1.2fr)_minmax(260px,1fr)_190px]">
        {/* Event */}
        <div className="relative p-6 lg:p-7">
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-amber-200/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="mb-4 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-200/70">
            <GlassWater className="h-3.5 w-3.5" />
            {t.privateEvent}
          </div>

          <h2
            className="mb-3 text-3xl font-medium leading-tight text-zinc-100"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {event.title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-400">
            <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-amber-200/70" />{event.region}</span>
            <Link href={mapHrefForRegion(event.region)} className="inline-flex items-center gap-1.5 text-xs text-amber-200/75 underline decoration-amber-200/20 underline-offset-4 transition hover:text-amber-100 hover:decoration-amber-200/60">
              <MapPin className="h-3.5 w-3.5" />{t.mapLocation}
            </Link>
          </div>
        </div>

        {/* Description / Conditions */}
        <div className="border-t border-zinc-800/40 p-6 lg:border-l lg:border-t-0 lg:p-7">
          <div className="space-y-5">
            {event.description && (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  {t.details}
                </p>
                <p className="whitespace-pre-line text-sm leading-6 text-zinc-300">
                  {event.description}
                </p>
              </div>
            )}

            {event.conditions && (
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                  {t.conditions}
                </p>
                <p className="whitespace-pre-line text-sm leading-6 text-zinc-300">
                  {event.conditions}
                </p>
              </div>
            )}

            {formattedCreated && (
              <div className="pt-1 text-xs text-zinc-600">
                {t.created}: {formattedCreated}
              </div>
            )}
          </div>
        </div>

        {/* Application */}
        <div className="flex flex-col justify-center border-t border-zinc-800/40 p-6 lg:border-l lg:border-t-0 lg:p-7">
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            aria-busy={checkingApplication || submitting}
            className={`
              inline-flex min-h-12 w-full items-center justify-center gap-2
              rounded-xl border px-4 py-3 text-sm font-medium
              transition-all duration-300
              ${
                canApply
                  ? `
                    border-amber-200/30 bg-amber-200/[0.06] text-amber-100
                    hover:border-amber-200/50 hover:bg-amber-200/[0.10]
                    hover:shadow-[0_0_30px_rgba(253,230,138,0.06)]
                  `
                  : isApproved
                    ? "cursor-default border-amber-200/20 bg-amber-200/[0.04] text-amber-200/80"
                    : "cursor-not-allowed border-zinc-800/60 bg-zinc-950/30 text-zinc-500"
              }
            `}
          >
            {checkingApplication || submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isActiveApplication ? (
              <Check className="h-4 w-4" />
            ) : cooldownActive ? (
              <Clock className="h-4 w-4" />
            ) : null}

            <span>{buttonLabel}</span>
          </button>

          {cooldownActive && unlockDate && (
            <p className="mt-3 text-center text-xs text-zinc-600">
              {t.availableFrom} {formatDate(unlockDate, lang)}
            </p>
          )}

          {success && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-xs text-amber-200/70"
            >
              {t.applicationSent}
            </motion.p>
          )}

          {error && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-xs text-zinc-500"
            >
              {error}
            </motion.p>
          )}
        </div>
      </div>
    </motion.article>
  );
}

// -----------------------------------------------------
// Main Page
// -----------------------------------------------------

export default function PartiesPage() {
  const { user, loading: authLoading } = useAuth();
  const { lang: rawLang } = useLanguage();

  const lang = normalizeLang(rawLang);
  const t = T[lang];

  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------
  // Load active events
  // ---------------------------------------------------

  useEffect(() => {
    let mounted = true;

    (async () => {
      setEventsLoading(true);
      setError("");

      const { data, error: eventsError } = await supabase
        .from("global_events")
        .select(EVENT_FIELDS)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (eventsError) {
        console.error("Global events error:", eventsError);
        setEvents([]);
        setError("load");
      } else {
        setEvents((data || []) as GlobalEvent[]);
      }

      setEventsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const isLoading = eventsLoading || authLoading;

  // ---------------------------------------------------
  // Content
  // ---------------------------------------------------

  let content: ReactNode;

  if (isLoading) {
    content = <EventsSkeleton />;
  } else if (error) {
    content = (
      <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/20 px-6 py-12 text-center">
        <p className="text-sm text-zinc-500">{t.loadError}</p>
      </div>
    );
  } else if (events.length === 0) {
    content = (
      <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/20 px-6 py-16 text-center">
        <GlassWater className="mx-auto mb-4 h-8 w-8 text-amber-200/30" />
        <p className="text-sm text-zinc-500">{t.empty}</p>
      </div>
    );
  } else if (!user) {
    content = (
      <div className="rounded-2xl border border-zinc-800/40 bg-zinc-900/20 px-6 py-16 text-center">
        <p className="text-sm text-zinc-500">{t.authRequired}</p>
      </div>
    );
  } else {
    content = (
      <div className="space-y-4">
        {events.map((event) => (
          <PartyCard
            key={event.id}
            event={event}
            userId={user.id}
            lang={lang}
            t={t}
          />
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 pb-8 pt-2 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 border-b border-zinc-800/40 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.25em] text-amber-200/60">
              <GlassWater className="h-3.5 w-3.5" />
              {t.activeEvents}
            </div>

            <h1
              className="text-5xl font-medium leading-none text-zinc-100 sm:text-6xl"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {t.title}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
              {t.subtitle}
            </p>
          </div>

          {isLoading ? (
            <SkeletonLine className="h-8 w-40 rounded-full" />
          ) : (
            events.length > 0 && (
              <div className="shrink-0 rounded-full border border-zinc-800/50 bg-zinc-900/40 px-4 py-2 text-xs text-zinc-500 backdrop-blur">
                <span className="text-amber-200/80">{events.length}</span>{" "}
                {t.activeEvents.toLowerCase()}
              </div>
            )
          )}
        </div>

        {content}
      </div>
    </main>
  );
}