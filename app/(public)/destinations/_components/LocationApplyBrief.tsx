/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · пояснение механики «заявки на направление» в досье локации
 * app/(public)/destinations/_components/LocationApplyBrief.tsx
 *
 * Используется в сайдбаре /destinations/{americas,asia-pacific,europe,
 * middle-east} прямо над кнопкой заявки.
 *
 *  • LOCATION_APPLY_COPY — тексты RU/EN/ES/PT (блок + подписи кнопки);
 *  • useHubSubscription  — подписана ли резидентка на локацию
 *    (map_hub_subscriptions, миграция 20261106090000) + subscribe();
 *  • LocationApplyBrief  — экшн-карточка «Как работает подача заявки».
 *
 * Заявка = applications (как раньше) + подписка на локацию, чтобы пункт
 * «Авто-уведомления» был правдой: новые туры/кастинги города приходят
 * в ленту и в Telegram (шаблон location_update).
 * Если миграция подписок ещё не применена, всё работает как раньше:
 * subscribed остаётся false, кнопка показывает «Заявка активна».
 * ──────────────────────────────────────────────────────────────────── */

"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Info, ListChecks, Loader2, MapPin } from "lucide-react";
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
        RU: "Вы подтверждаете готовность выехать в эту локацию.",
        EN: "You confirm that you are ready to travel to this location.",
        ES: "Confirmas que estás disponible para viajar a esta ubicación.",
        PT: "Confirma que está disponível para viajar para esta localização.",
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
        RU: "При открытии новых кастингов или туров в этом городе вам сразу придёт пуш в Telegram.",
        EN: "As soon as new castings or tours open in this city, you get a Telegram push.",
        ES: "En cuanto se abran nuevos castings o tours en esta ciudad, recibirás un aviso en Telegram.",
        PT: "Assim que abrirem novos castings ou tours nesta cidade, receberá um aviso no Telegram.",
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
        RU: "Заявка автоматически помещает ваш профиль в шорт-лист направления для овнера и менеджеров.",
        EN: "Your application automatically places your profile on the destination shortlist for the owner and managers.",
        ES: "La solicitud coloca tu perfil automáticamente en la lista corta del destino para el owner y los managers.",
        PT: "A candidatura coloca automaticamente o seu perfil na shortlist do destino para o owner e os managers.",
      },
    },
  ] as { title: L; text: L }[],
  /** Кнопка, когда заявки ещё нет */
  cta: {
    RU: "Подтвердить готовность к локации",
    EN: "Confirm readiness for this location",
    ES: "Confirmar disponibilidad para el destino",
    PT: "Confirmar disponibilidade para o destino",
  },
  /** Кнопка, когда заявка активна и подписка есть */
  subscribed: {
    RU: "Вы подписаны",
    EN: "You're subscribed",
    ES: "Suscripción activa",
    PT: "Subscrição ativa",
  },
  subscribedNote: {
    RU: "Заявка подана. Новые туры и кастинги этого города придут в Telegram и в ленту на карте.",
    EN: "Application submitted. New tours and castings in this city will reach you in Telegram and in your map feed.",
    ES: "Solicitud enviada. Los nuevos tours y castings de esta ciudad te llegarán por Telegram y en tu feed del mapa.",
    PT: "Candidatura enviada. Novos tours e castings desta cidade chegam pelo Telegram e no feed do mapa.",
  },
  notSubscribedNote: {
    RU: "Заявка подана, но уведомления по этой локации выключены.",
    EN: "Application submitted, but alerts for this location are off.",
    ES: "Solicitud enviada, pero los avisos de este destino están desactivados.",
    PT: "Candidatura enviada, mas os avisos deste destino estão desligados.",
  },
  enableAlerts: {
    RU: "Включить уведомления",
    EN: "Turn on alerts",
    ES: "Activar avisos",
    PT: "Ativar avisos",
  },
  guestNote: {
    RU: "Подать заявку могут только резиденты клуба после входа.",
    EN: "Only club residents can apply after signing in.",
    ES: "Solo los residentes del club pueden solicitarlo tras iniciar sesión.",
    PT: "Apenas residentes do clube podem candidatar-se após iniciar sessão.",
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
      RU: "Уведомления по локациям доступны только резидентам.",
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
      RU: "Не удалось включить уведомления. Попробуйте ещё раз.",
      EN: "Couldn't turn on alerts. Please try again.",
      ES: "No se pudieron activar los avisos. Inténtalo de nuevo.",
      PT: "Não foi possível ativar os avisos. Tente novamente.",
    },
  } as Record<SubscriptionFailure, L>,
} as const;

const STEP_ICONS = [MapPin, BellRing, ListChecks] as const;

export type HubSubscription = {
  /** null — ещё проверяем или пользователь не вошёл */
  subscribed: boolean | null;
  busy: boolean;
  failure: SubscriptionFailure | null;
  /** Подписаться на локацию (идемпотентно). true — подписка есть. */
  subscribe: () => Promise<boolean>;
};

/** Подписка текущей резидентки на локацию карты */
export function useHubSubscription(hubId: string | null | undefined, userId: string | null | undefined): HubSubscription {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
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
        // таблицы ещё нет (миграция не применена) или сеть — ведём себя как без подписки
        console.warn("[location-apply] subscription check", error.code, error.message);
        setSubscribed(false);
        return;
      }
      setSubscribed(Boolean(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [hubId, userId]);

  const subscribe = useCallback(async () => {
    if (!hubId || !userId) return false;
    setBusy(true);
    setFailure(null);
    const result = await setHubSubscription(hubId, true);
    setBusy(false);
    if (!result.ok) {
      setFailure(result.reason);
      setSubscribed(false);
      return false;
    }
    setSubscribed(result.subscribed);
    return result.subscribed;
  }, [hubId, userId]);

  return { subscribed, busy, failure, subscribe };
}

/** Подпись кнопки для активной заявки: «Вы подписаны» или старый текст */
export function activeApplicationLabel(lang: ApplyLang, subscription: HubSubscription, fallback: string) {
  return subscription.subscribed ? LOCATION_APPLY_COPY.subscribed[lang] : fallback;
}

type BriefProps = {
  lang: ApplyLang;
  /** Пользователь вошёл */
  signedIn: boolean;
  /** Заявка pending/approved */
  applicationActive: boolean;
  subscription: HubSubscription;
  className?: string;
};

export function LocationApplyBrief({ lang, signedIn, applicationActive, subscription, className = "" }: BriefProps) {
  const c = LOCATION_APPLY_COPY;
  const showSubscribed = signedIn && applicationActive && subscription.subscribed === true;
  const showEnable =
    signedIn && applicationActive && subscription.subscribed === false && subscription.failure !== "schema";

  return (
    <section
      aria-labelledby="location-apply-brief-title"
      className={`relative overflow-hidden rounded-2xl border border-amber-200/15 bg-zinc-900/40 p-5 backdrop-blur-md ${className}`}
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

        {showSubscribed && (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 border-t border-zinc-800/80 pt-3 text-[11px] leading-relaxed text-amber-100/80"
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" aria-hidden />
            {c.subscribedNote[lang]}
          </p>
        )}

        {showEnable && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
            <p className="text-[11px] leading-relaxed text-zinc-500">{c.notSubscribedNote[lang]}</p>
            <button
              type="button"
              onClick={() => void subscription.subscribe()}
              disabled={subscription.busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200 transition-colors hover:bg-amber-200/10 disabled:cursor-wait disabled:opacity-60"
            >
              {subscription.busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <BellRing className="h-3 w-3" aria-hidden />}
              {c.enableAlerts[lang]}
            </button>
          </div>
        )}

        {signedIn && subscription.failure && subscription.failure !== "schema" && (
          <p className="mt-2 text-[11px] leading-relaxed text-red-300/80">{c.failure[subscription.failure][lang]}</p>
        )}
      </div>
    </section>
  );
}
