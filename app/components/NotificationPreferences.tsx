"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Блок «Telegram-оповещения» в настройках профиля
 * app/components/NotificationPreferences.tsx
 *
 *   variant="resident"  туры · тусовки · одобрение заявок · начисление баллов
 *                       + приватность: скрыть баллы и рейтинг
 *   variant="manager"   отклики на кастинг · подписи · документы · отзывы ·
 *                       заявки на закреплённые локации
 *
 * Тумблер сохраняется сразу (оптимистично); при ошибке возвращается назад.
 * Служебные сообщения — договор, документы, ссылка входа — не отключаются.
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import { BellRing, EyeOff, LoaderCircle, Send } from "lucide-react";
import { getMyNotificationPreferences, saveMyNotificationPreferences } from "@/app/actions/notification-preferences";
import {
  DEFAULT_PREFERENCES,
  MANAGER_PREFERENCE_KEYS,
  RESIDENT_PREFERENCE_KEYS,
  type MemberPreferences,
  type PreferenceKey,
} from "@/lib/memberPreferences";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";

type Variant = "resident" | "manager";
type Item = { title: string; hint: string };
type Copy = {
  title: string;
  subtitle: string;
  managerSubtitle: string;
  items: Record<PreferenceKey, Item>;
  privacyTitle: string;
  privacySubtitle: string;
  loading: string;
  error: string;
  saved: string;
  noTelegram: string;
  telegramOk: string;
  always: string;
};

const T: Record<Lang, Copy> = {
  RU: {
    title: "Telegram-оповещения",
    subtitle: "Выберите, о чём VOYAGE пишет вам в Telegram. Выключенный пункт — отказ от этого вида сообщений.",
    managerSubtitle: "Рабочие уведомления кабинета менеджера. Выключите то, что отслеживаете в Штабе сами.",
    items: {
      notify_tours: { title: "Новые туры", hint: "Когда на интерактивной карте открывается новая локация." },
      notify_parties: { title: "Новые тусовки", hint: "Закрытые ивенты и яхты, доступные вашему уровню." },
      notify_approvals: { title: "Одобрение в тур", hint: "Заявка на тур или тусовку одобрена, вас выбрали в состав." },
      notify_points: { title: "Начисление баллов", hint: "Сколько баллов пришло и за что: тур, штамп, комбо." },
      hide_points: { title: "Скрыть мои баллы и рейтинг", hint: "Другие резидентки увидят ваше место, но не цифры. Вы и клуб видите всё." },
      notify_casting_responses: { title: "Отклики на кастинг", hint: "Новая «Готова в тур». Не чаще раза в 30 минут на кастинг." },
      notify_contract_signed: { title: "Подписи договора", hint: "Участница подписала версию условий — со счётчиком подписей." },
      notify_docs_uploaded: { title: "Документы участниц", hint: "Участница загрузила документы для тура — пора проверить." },
      notify_reviews: { title: "Отзывы резиденток", hint: "Новая оценка вашей работы. Автор не раскрывается." },
      notify_map_applications: { title: "Заявки на мои локации", hint: "Отклик резидентки на локацию карты, за которую вы отвечаете." },
    },
    privacyTitle: "Приватность",
    privacySubtitle: "Influence Index, баллы и надёжность в общем рейтинге.",
    loading: "Загружаем настройки…",
    error: "Не удалось сохранить. Попробуйте ещё раз.",
    saved: "Сохранено",
    noTelegram: "Telegram ещё не подключён — оповещения начнут приходить после привязки аккаунта выше.",
    telegramOk: "Telegram подключён",
    always: "Договоры, документы, верификация и ссылки входа приходят всегда.",
  },
  EN: {
    title: "Telegram notifications",
    subtitle: "Choose what VOYAGE sends you in Telegram. Turning an item off opts you out of that kind of message.",
    managerSubtitle: "Work alerts from the manager cabinet. Switch off what you already follow in Command.",
    items: {
      notify_tours: { title: "New tours", hint: "When a new location opens on the interactive map." },
      notify_parties: { title: "New parties", hint: "Private events and yachts open to your level." },
      notify_approvals: { title: "Tour approval", hint: "Your tour or party application is approved, or you joined a crew." },
      notify_points: { title: "Points awarded", hint: "How many points arrived and why: tour, stamp, combo." },
      hide_points: { title: "Hide my points and rating", hint: "Other residents see your place, not your numbers. You and the club see everything." },
      notify_casting_responses: { title: "Casting responses", hint: "A new “Ready for the tour”. At most once per 30 minutes per casting." },
      notify_contract_signed: { title: "Contract signatures", hint: "A participant signed the terms — with the signature count." },
      notify_docs_uploaded: { title: "Participant documents", hint: "A participant uploaded tour documents to verify." },
      notify_reviews: { title: "Resident reviews", hint: "A new rating of your work. The author stays anonymous." },
      notify_map_applications: { title: "Applications to my locations", hint: "A resident applied to a map location you are responsible for." },
    },
    privacyTitle: "Privacy",
    privacySubtitle: "Influence Index, points and reliability in the public rating.",
    loading: "Loading settings…",
    error: "Could not save. Please try again.",
    saved: "Saved",
    noTelegram: "Telegram is not linked yet — notifications start once you link your account above.",
    telegramOk: "Telegram linked",
    always: "Contracts, documents, verification and sign-in links are always delivered.",
  },
  ES: {
    title: "Avisos de Telegram",
    subtitle: "Elige qué te envía VOYAGE por Telegram. Desactivar un punto es renunciar a ese tipo de mensajes.",
    managerSubtitle: "Avisos de trabajo del gabinete. Desactiva lo que ya sigues en el Cuartel.",
    items: {
      notify_tours: { title: "Nuevos tours", hint: "Cuando se abre una nueva ubicación en el mapa interactivo." },
      notify_parties: { title: "Nuevas fiestas", hint: "Eventos privados y yates abiertos a tu nivel." },
      notify_approvals: { title: "Aprobación para el tour", hint: "Tu solicitud fue aprobada o entraste en un equipo." },
      notify_points: { title: "Puntos recibidos", hint: "Cuántos puntos llegaron y por qué: tour, sello, combo." },
      hide_points: { title: "Ocultar mis puntos y ranking", hint: "Otras residentes ven tu puesto, no tus cifras. Tú y el club lo veis todo." },
      notify_casting_responses: { title: "Respuestas al casting", hint: "Un nuevo «Lista para el tour». Máximo una vez cada 30 minutos." },
      notify_contract_signed: { title: "Firmas del contrato", hint: "Una participante firmó las condiciones." },
      notify_docs_uploaded: { title: "Documentos", hint: "Una participante subió documentos para revisar." },
      notify_reviews: { title: "Valoraciones", hint: "Una nueva valoración de tu trabajo. La autora es anónima." },
      notify_map_applications: { title: "Solicitudes a mis ubicaciones", hint: "Una residente solicitó una ubicación a tu cargo." },
    },
    privacyTitle: "Privacidad",
    privacySubtitle: "Influence Index, puntos y fiabilidad en el ranking.",
    loading: "Cargando ajustes…",
    error: "No se pudo guardar. Inténtalo de nuevo.",
    saved: "Guardado",
    noTelegram: "Telegram aún no está vinculado: los avisos llegarán cuando lo vincules arriba.",
    telegramOk: "Telegram vinculado",
    always: "Contratos, documentos, verificación y enlaces de acceso llegan siempre.",
  },
  PT: {
    title: "Avisos no Telegram",
    subtitle: "Escolha o que o VOYAGE envia no Telegram. Desligar um item é recusar esse tipo de mensagem.",
    managerSubtitle: "Avisos de trabalho do gabinete. Desligue o que você já acompanha no Quartel.",
    items: {
      notify_tours: { title: "Novos tours", hint: "Quando uma nova localização abre no mapa interativo." },
      notify_parties: { title: "Novas festas", hint: "Eventos privados e iates abertos ao seu nível." },
      notify_approvals: { title: "Aprovação no tour", hint: "Sua candidatura foi aprovada ou você entrou na equipe." },
      notify_points: { title: "Pontos recebidos", hint: "Quantos pontos chegaram e por quê: tour, carimbo, combo." },
      hide_points: { title: "Ocultar meus pontos e ranking", hint: "Outras residentes veem sua posição, não os números. Você e o clube veem tudo." },
      notify_casting_responses: { title: "Respostas ao casting", hint: "Um novo «Pronta para o tour». No máximo a cada 30 minutos." },
      notify_contract_signed: { title: "Assinaturas do contrato", hint: "Uma participante assinou as condições." },
      notify_docs_uploaded: { title: "Documentos", hint: "Uma participante enviou documentos para verificar." },
      notify_reviews: { title: "Avaliações", hint: "Uma nova avaliação do seu trabalho. A autora é anônima." },
      notify_map_applications: { title: "Candidaturas às minhas localizações", hint: "Uma residente se candidatou a uma localização sua." },
    },
    privacyTitle: "Privacidade",
    privacySubtitle: "Influence Index, pontos e confiabilidade no ranking.",
    loading: "Carregando configurações…",
    error: "Não foi possível salvar. Tente novamente.",
    saved: "Salvo",
    noTelegram: "O Telegram ainda não está vinculado — os avisos chegam após vincular a conta acima.",
    telegramOk: "Telegram vinculado",
    always: "Contratos, documentos, verificação e links de acesso chegam sempre.",
  },
};

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40 disabled:opacity-50 ${
        checked ? "border-amber-200/50 bg-amber-200/80" : "border-zinc-700 bg-zinc-800"
      }`}
    >
      <span
        className={`inline-block h-[18px] w-[18px] rounded-full shadow-md transition-transform duration-300 ${
          checked ? "translate-x-[22px] bg-zinc-950" : "translate-x-[3px] bg-zinc-400"
        }`}
      />
    </button>
  );
}

export default function NotificationPreferences({ variant }: { variant: Variant }) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.RU;
  const [prefs, setPrefs] = useState<MemberPreferences>(DEFAULT_PREFERENCES);
  const [telegramLinked, setTelegramLinked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [status, setStatus] = useState<{ key: PreferenceKey; ok: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    void getMyNotificationPreferences().then((result) => {
      if (!alive) return;
      if (result.ok) {
        setPrefs(result.preferences);
        setTelegramLinked(result.telegramLinked);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const keys = (variant === "manager" ? MANAGER_PREFERENCE_KEYS : RESIDENT_PREFERENCE_KEYS) as readonly PreferenceKey[];
  const notifyKeys = keys.filter((k) => k !== "hide_points");
  const hasPrivacy = keys.includes("hide_points");

  const update = async (key: PreferenceKey, value: boolean) => {
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSavingKey(key);
    setStatus(null);
    const result = await saveMyNotificationPreferences({ [key]: value });
    if (result.ok) {
      setPrefs(result.preferences);
      setStatus({ key, ok: true });
    } else {
      setPrefs((p) => ({ ...p, [key]: previous }));
      setStatus({ key, ok: false });
    }
    setSavingKey(null);
  };

  const row = (key: PreferenceKey) => (
    <li key={key} className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="text-sm text-zinc-100">{t.items[key].title}</p>
        <p className="mt-0.5 text-xs leading-5 text-zinc-500">{t.items[key].hint}</p>
        {status?.key === key && (
          <p className={`mt-1 text-[11px] ${status.ok ? "text-emerald-300/80" : "text-rose-300"}`}>{status.ok ? t.saved : t.error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        {savingKey === key && <LoaderCircle size={14} className="animate-spin text-zinc-500" />}
        <Toggle checked={prefs[key]} disabled={loading || savingKey !== null} onChange={(v) => void update(key, v)} label={t.items[key].title} />
      </div>
    </li>
  );

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 shadow-xl shadow-black/10">
      <div className="flex items-start gap-3 p-5 sm:p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-200/[0.05] text-amber-100">
          <BellRing size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-xl text-zinc-100">{t.title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{variant === "manager" ? t.managerSubtitle : t.subtitle}</p>
          {!loading && (
            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${telegramLinked ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/90" : "border-amber-200/20 bg-amber-200/[0.04] text-amber-100/90"}`}>
              <Send size={11} />
              {telegramLinked ? t.telegramOk : t.noTelegram}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 border-t border-zinc-800/80 px-5 py-4 text-sm text-zinc-500 sm:px-6">
          <LoaderCircle size={15} className="animate-spin" />
          {t.loading}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-zinc-800/70 border-t border-zinc-800/80">{notifyKeys.map(row)}</ul>
          <p className="border-t border-zinc-800/60 px-5 py-3 text-[11px] leading-5 text-zinc-600 sm:px-6">{t.always}</p>
          {hasPrivacy && (
            <div className="border-t border-zinc-800/80">
              <div className="flex items-center gap-2 px-5 pt-4 sm:px-6">
                <EyeOff size={14} className="text-amber-100/70" />
                <h3 className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{t.privacyTitle}</h3>
              </div>
              <p className="px-5 pt-1 text-xs text-zinc-600 sm:px-6">{t.privacySubtitle}</p>
              <ul className="mt-1">{row("hide_points")}</ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
