/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · действия резидентки в досье локации
 * app/(public)/destinations/_components/LocationApplyBrief.tsx
 *
 * Используется в сайдбаре /destinations/{americas,asia-pacific,europe,
 * middle-east} прямо над главной кнопкой.
 *
 * Две кнопки:
 *   1. «Подписаться на обновления» (outline, здесь) — только подписка
 *      map_hub_subscriptions: новые туры/кастинги города → лента + Telegram
 *      (шаблон location_update). В лист ожидания НЕ добавляет.
 *   2. «Подтвердить готовность к локации» (primary, в странице региона) —
 *      отклик applications (pending) = лист ожидания локации
 *      (view location_waiting_list, миграция 20261107090000) + подписка.
 *
 *  • LOCATION_APPLY_COPY — тексты RU/EN/ES/PT;
 *  • useHubSubscription  — подписка на локацию: subscribe / unsubscribe;
 *  • LocationApplyBrief  — карточка «Как работает…» + кнопка подписки.
 * Если миграция подписок не применена, кнопка подписки скрыта.
 * ──────────────────────────────────────────────────────────────────── */

"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Info, ListChecks, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { setHubSubscription, type SubscriptionFailure } from "@/lib/map-subscriptions";

export type ApplyLang = "EN" | "RU" | "ES" | "PT";

type L = Record<ApplyLang, string>;

export const LOCATION_APPLY_COPY = {
  title: {
    RU: "Как работает подача заявки на направление",
    EN: "How applying for a destination works",
    ES: "Cómo funciona la solicitud para un destino",
    PT: "Como funciona a candidatura a um destino",
  },
  steps: [
    {
      title: {
        RU: "Фиксация интереса",
        EN: "Interest locked in",
        ES: "Interés confirmado",
        PT: "Interesse registado",
      },
      text: {
        RU: "«Подтвердить готовность» означает, что вы согласны с условиями и готовы выехать в эту локацию.",
        EN: "“Confirm readiness” means you accept the terms and are ready to travel to this location.",
        ES: "«Confirmar disponibilidad» significa que aceptas las condiciones y estás lista para viajar a este destino.",
        PT: "«Confirmar disponibilidade» significa que aceita as condições e está pronta para viajar para este destino.",
      },
    },
    {
      title: {
        RU: "Авто-уведомления",
        EN: "Auto-notifications",
        ES: "Avisos automáticos",
        PT: "Notificações automáticas",
      },
      text: {
        RU: "При открытии новых кастингов или туров в этом городе вам сразу придёт пуш в Telegram. Если хотите только следить за городом, нажмите «Подписаться на обновления»: в лист ожидания это не добавляет.",
        EN: "As soon as new castings or tours open in this city, you get a Telegram push. To just follow the city, tap “Follow updates”: it does not add you to the waiting list.",
        ES: "En cuanto se abran nuevos castings o tours en esta ciudad, recibirás un aviso en Telegram. Si solo quieres seguir la ciudad, pulsa «Seguir novedades»: no te añade a la lista de espera.",
        PT: "Assim que abrirem novos castings ou tours nesta cidade, recebe um aviso no Telegram. Para apenas acompanhar a cidade, toque em «Seguir novidades»: não a coloca na lista de espera.",
      },
    },
    {
      title: {
        RU: "Приоритет в отборе",
        EN: "Selection priority",
        ES: "Prioridad en la selección",
        PT: "Prioridade na seleção",
      },
      text: {
        RU: "Подтверждение помещает ваш профиль в лист ожидания направления: овнер и менеджеры приглашают оттуда в туры и кастинги в первую очередь.",
        EN: "Confirming puts your profile on the destination waiting list: the owner and managers invite from it to tours and castings first.",
        ES: "La confirmación coloca tu perfil en la lista de espera del destino: el owner y los managers invitan desde ahí a tours y castings primero.",
        PT: "A confirmação coloca o seu perfil na lista de espera do destino: o owner e os managers convidam a partir dela para tours e castings primeiro.",
      },
    },
  ] as { title: L; text: L }[],
  /** Кнопка 2 (primary), когда заявки ещё нет */
  cta: {
    RU: "Подтвердить готовность к локации",
    EN: "Confirm readiness for this location",
    ES: "Confirmar disponibilidad para el destino",
    PT: "Confirmar disponibilidade para o destino",
  },
  /** Кнопка 2, когда заявка pending/approved */
  waiting: {
    RU: "Вы в листе ожидания",
    EN: "You're on the waiting list",
    ES: "Estás en la lista de espera",
    PT: "Está na lista de espera",
  },
  waitingNote: {
    RU: "Готовность подтверждена. Когда в городе откроется тур или кастинг, вас пригласят из листа ожидания.",
    EN: "Readiness confirmed. When a tour or casting opens in this city, you'll be invited from the waiting list.",
    ES: "Disponibilidad confirmada. Cuando se abra un tour o casting en esta ciudad, te invitarán desde la lista de espera.",
    PT: "Disponibilidade confirmada. Quando abrir um tour ou casting nesta cidade, será convidada a partir da lista de espera.",
  },
  /** Кнопка 1 (outline) */
  follow: {
    RU: "Подписаться на обновления",
    EN: "Follow updates",
    ES: "Seguir novedades",
    PT: "Seguir novidades",
  },
  following: {
    RU: "Вы подписаны",
    EN: "You're subscribed",
    ES: "Suscripción activa",
    PT: "Subscrição ativa",
  },
  unfollowHint: {
    RU: "Нажмите, чтобы отписаться от уведомлений по локации",
    EN: "Tap to stop alerts for this location",
    ES: "Pulsa para dejar de recibir avisos de este destino",
    PT: "Toque para deixar de receber avisos deste destino",
  },
  guestNote: {
    RU: "Подписаться и подтвердить готовность могут только резиденты клуба после входа.",
    EN: "Only club residents can follow and confirm readiness after signing in.",
    ES: "Solo los residentes del club pueden seguir y confirmar disponibilidad tras iniciar sesión.",
    PT: "Apenas residentes do clube podem seguir e confirmar disponibilidade após iniciar sessão.",
  },
  failure: {
    limit: {
      RU: "Достигнут лимит в 50 локаций. Отпишитесь от лишних на карте в кабинете.",
      EN: "You've reached the 50-location limit. Unsubscribe from some on your dashboard map.",
      ES: "Has alcanzado el límite de 50 destinos. Cancela alguno en el mapa de tu panel.",
      PT: "Atingiu o limite de 50 destinos. Cancele alguns no mapa do seu painel.",
    },
    inactive: {
      RU: "Локация сейчас закрыта для подписки.",
      EN: "This location is closed for subscriptions right now.",
      ES: "Este destino no admite suscripciones ahora mismo.",
      PT: "Este destino não aceita subscrições neste momento.",
    },
    residents_only: {
      RU: "Подписка на локации доступна только резидентам.",
      EN: "Location alerts are available to residents only.",
      ES: "Los avisos de destinos son solo para residentes.",
      PT: "Os avisos de destinos são apenas para residentes.",
    },
    schema: {
      RU: "Уведомления по локациям ещё не подключены.",
      EN: "Location alerts are not enabled yet.",
      ES: "Los avisos de destinos aún no están activos.",
      PT: "Os avisos de destinos ainda não estão ativos.",
    },
    network: {
      RU: "Не удалось изменить подписку. Попробуйте ещё раз.",
      EN: "Couldn't update the subscription. Please try again.",
      ES: "No se pudo cambiar la suscripción. Inténtalo de nuevo.",
      PT: "Não foi possível alterar a subscrição. Tente novamente.",
    },
  } as Record<SubscriptionFailure, L>,
} as const;

const STEP_ICONS = [MapPin, BellRing, ListChecks] as const;

export type HubSubscription = {
  /** null — ещё проверяем или пользователь не вошёл */
  subscribed: boolean | null;
  /** false — таблицы подписок нет (миграция не применена) */
  available: boolean;
  busy: boolean;
  failure: SubscriptionFailure | null;
  /** Подписаться (идемпотентно). true — подписка есть. */
  subscribe: () => Promise<boolean>;
  /** Отписаться. true — подписки больше нет. */
  unsubscribe: () => Promise<boolean>;
};

const SCHEMA_CODES = new Set(["42P01", "PGRST205", "PGRST202", "42883"]);

/** Подписка текущей резидентки на локацию карты */
export function useHubSubscription(hubId: string | null | undefined, userId: string | null | undefined): HubSubscription {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SubscriptionFailure | null>(null);

  useEffect(() => {
    setFailure(null);
    if (!hubId || !userId) {
      setSubscribed(null);
      return;
    }
    let cancelled = false;
    setSubscribed(null);
    void (async () => {
      const { data, error } = await supabase
        .from("map_hub_subscriptions")
        .select("hub_id")
        .eq("profile_id", userId)
        .eq("hub_id", hubId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("[location-apply] subscription check", error.code, error.message);
        if (error.code && SCHEMA_CODES.has(error.code)) setAvailable(false);
        setSubscribed(false);
        return;
      }
      setAvailable(true);
      setSubscribed(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [hubId, userId]);

  const change = useCallback(
    async (next: boolean) => {
      if (!hubId || !userId) return false;
      setBusy(true);
      setFailure(null);
      const result = await setHubSubscription(hubId, next);
      setBusy(false);
      if (!result.ok) {
        if (result.reason === "schema") setAvailable(false);
        setFailure(result.reason);
        return false;
      }
      setSubscribed(result.subscribed);
      return result.subscribed === next;
    },
    [hubId, userId],
  );

  const subscribe = useCallback(() => change(true), [change]);
  const unsubscribe = useCallback(() => change(false), [change]);

  return { subscribed, available, busy, failure, subscribe, unsubscribe };
}

type BriefProps = {
  lang: ApplyLang;
  /** Пользователь вошёл */
  signedIn: boolean;
  /** Заявка pending/approved = в листе ожидания */
  applicationActive: boolean;
  subscription: HubSubscription;
  className?: string;
};

/** Карточка «Как работает…» + кнопка 1 «Подписаться на обновления» */
export function LocationApplyBrief({ lang, signedIn, applicationActive, subscription, className = "" }: BriefProps) {
  const c = LOCATION_APPLY_COPY;
  const showFollow = signedIn && subscription.available;
  const following = subscription.subscribed === true;
  const checking = signedIn && subscription.subscribed === null;

  return (
    <div className={className}>
      <section
        aria-labelledby="location-apply-brief-title"
        className="relative overflow-hidden rounded-2xl border border-amber-200/15 bg-zinc-900/40 p-5 backdrop-blur-md"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.07),_transparent_55%)]" />

        <div className="relative">
          <h4
            id="location-apply-brief-title"
            className="flex items-start gap-2 text-[11px] font-medium uppercase leading-relaxed tracking-[0.18em] text-amber-200/80"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {c.title[lang]}
          </h4>

          <ol className="mt-4 space-y-3.5">
            {c.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? MapPin;
              return (
                <li key={index} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200/20 bg-zinc-950/60 text-amber-200/80">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <p className="text-xs font-light leading-relaxed text-zinc-400">
                    <span className="font-medium text-zinc-200">{step.title[lang]}:</span> {step.text[lang]}
                  </p>
                </li>
              );
            })}
          </ol>

          {!signedIn && (
            <p className="mt-4 border-t border-zinc-800/80 pt-3 text-[11px] leading-relaxed text-zinc-500">{c.guestNote[lang]}</p>
          )}

          {signedIn && applicationActive && (
            <p role="status" className="mt-4 flex items-start gap-2 border-t border-zinc-800/80 pt-3 text-[11px] leading-relaxed text-amber-100/80">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" aria-hidden />
              {c.waitingNote[lang]}
            </p>
          )}
        </div>
      </section>

      {showFollow && (
        <button
          type="button"
          onClick={() => void (following ? subscription.unsubscribe() : subscription.subscribe())}
          disabled={subscription.busy || checking}
          aria-pressed={following}
          title={following ? c.unfollowHint[lang] : undefined}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 disabled:cursor-wait disabled:opacity-60 ${
            following
              ? "border-amber-200/30 bg-amber-200/[0.06] text-amber-200 hover:border-amber-200/50"
              : "border-amber-200/30 bg-transparent text-amber-200 hover:bg-amber-200/10"
          }`}
        >
          {subscription.busy || checking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : following ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <BellRing className="h-3.5 w-3.5" aria-hidden />
          )}
          {following ? c.following[lang] : c.follow[lang]}
        </button>
      )}

      {signedIn && subscription.failure && subscription.failure !== "schema" && (
        <p className="mt-2 text-center text-[11px] leading-relaxed text-red-300/80">{c.failure[subscription.failure][lang]}</p>
      )}
    </div>
  );
}
