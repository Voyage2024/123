"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · РЕЗИДЕНТКА — баннер допуска к кастингам
 * app/(dashboard)/dashboard/_components/CastingAccessBanner.tsx
 *
 * Вместо молчаливого пустого экрана объясняет, что мешает:
 *   · анкета на проверке / бан / ограничение клуба → кастингов нет вообще,
 *     баннер говорит почему и куда написать;
 *   · KYC ниже уровня отклика или выключено «Открыта к турам» → кастинги
 *     видны, а баннер-чек-лист показывает, что осталось для отклика;
 *   · не указаны рост или языки → карточка с формой прямо здесь. Это НЕ
 *     скрывает кастинги и не блокирует отклик, только помогает менеджеру
 *     увидеть совпадение с требованиями.
 *
 * С 20261114100000 у каждого кастинга свой минимальный KYC: чек-лист
 * показывает, на сколько открытых кастингов уже хватает уровня, а под ним —
 * раскрывающееся описание всех четырёх уровней с отметкой «вы здесь».
 *
 * Данные — me.blockers из partner_resident_feed (миграция 20261114090000),
 * запись роста/языков — setCastingProfile (_lib/actions.ts).
 * ──────────────────────────────────────────────────────────────────── */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Camera, Check, ChevronDown, Clock, Languages, Loader2, Lock, Ruler, ShieldAlert, ShieldCheck, ToggleRight } from "lucide-react";
import type { Lang } from "@/app/context/LanguageContext";
import { BTN_GHOST, BTN_GOLD, ICON_RING, PILL, cormorant } from "@/app/(dashboard)/partner/_components/PartnerUI";
import type { ResidentProfile } from "@/app/(dashboard)/dashboard/_lib/castingFeed";
import { setCastingProfile } from "@/app/(dashboard)/dashboard/_lib/actions";
import { KYC_LEVELS, kycCopy } from "@/lib/kyc-levels";
import { KycSteps } from "@/app/components/profile/KycLevelBadge";

export const PROFILE_PHOTO_HREF = "/dashboard";

/** Тексты гибкого KYC (20261114100000) — отдельно, чтобы не трогать основной словарь */
const KYC_EXTRA: Record<Lang, {
  avail: (have: number, ok: number, total: number) => string;
  allOpen: (have: number) => string;
  photo: string;
  photoCta: string;
  lockedPhoto: string;
  youAreHere: string;
}> = {
  RU: {
    avail: (have, ok, total) => `Ваш KYC ${have}: откликаться можно на ${ok} из ${total} кастингов`,
    allOpen: (have) => `Ваш KYC ${have}: уровня хватает для всех открытых кастингов`,
    photo: "Загрузите хотя бы одно фото в профиль",
    photoCta: "Добавить фото",
    lockedPhoto: "Отклик — после загрузки фото",
    youAreHere: "вы здесь",
  },
  EN: {
    avail: (have, ok, total) => `Your KYC ${have}: you can reply to ${ok} of ${total} castings`,
    allOpen: (have) => `Your KYC ${have}: enough for every open casting`,
    photo: "Upload at least one photo to your profile",
    photoCta: "Add a photo",
    lockedPhoto: "Replies open after you upload a photo",
    youAreHere: "you are here",
  },
  ES: {
    avail: (have, ok, total) => `Tu KYC ${have}: puedes responder a ${ok} de ${total} castings`,
    allOpen: (have) => `Tu KYC ${have}: suficiente para todos los castings abiertos`,
    photo: "Sube al menos una foto a tu perfil",
    photoCta: "Añadir foto",
    lockedPhoto: "Respuesta tras subir una foto",
    youAreHere: "estás aquí",
  },
  PT: {
    avail: (have, ok, total) => `Seu KYC ${have}: dá para responder a ${ok} de ${total} castings`,
    allOpen: (have) => `Seu KYC ${have}: suficiente para todos os castings abertos`,
    photo: "Envie pelo menos uma foto para o perfil",
    photoCta: "Adicionar foto",
    lockedPhoto: "Resposta após enviar uma foto",
    youAreHere: "você está aqui",
  },
};

/** Те же коды, что в форме кастинга (CastingBriefFields.LANGUAGE_CODES) */
const LANGUAGE_CODES = ["EN", "RU", "ES", "PT", "FR", "IT", "DE", "AR"] as const;
const MAX_LANGS = 5;
const HEIGHT_MIN = 140;
const HEIGHT_MAX = 230;

export const KYC_HREF = "/dashboard#kyc-title";
export const CONCIERGE_HREF = "/dashboard/concierge";

type Dict = {
  review: { title: string; text: string };
  banned: { title: string; text: string };
  restricted: { title: string; text: string };
  concierge: string;
  steps: { title: string; text: string; approved: string; kyc: (have: number, need: number) => string; kycCta: string; open: string; openHint: string };
  profile: {
    title: string;
    text: string;
    height: string;
    heightPh: string;
    languages: string;
    languagesHint: string;
    save: string;
    saving: string;
    saved: string;
    invalid: string;
    failed: string;
  };
  /** Короткая подпись на заблокированной кнопке карточки */
  locked: { kyc: (need: number) => string; open: string; both: (need: number) => string };
};

export const ACCESS_COPY: Record<Lang, Dict> = {
  RU: {
    review: {
      title: "Анкета на проверке",
      text: "Кастинги откроются сразу после того, как команда клуба одобрит вашу анкету. Как только это произойдёт, лента появится здесь.",
    },
    banned: {
      title: "Доступ к кастингам приостановлен",
      text: "Пока действует ограничение аккаунта, кастинги не показываются. Если это ошибка — напишите консьержу.",
    },
    restricted: {
      title: "Доступ к кастингам ограничен",
      text: "Сейчас кастинги для вас закрыты решением клуба. Консьерж подскажет, что можно сделать.",
    },
    concierge: "Написать консьержу",
    steps: {
      title: "Кастинги уже видны. Чтобы откликаться:",
      text: "Смотрите брифы, даты и гонорары уже сейчас. Кнопка «Готова в тур» включится, когда все пункты отмечены.",
      approved: "Анкета одобрена",
      kyc: (have, need) => `Верификация: уровень ${have} из ${need}`,
      kycCta: "Пройти верификацию",
      open: "Тумблер «Открыта к турам»",
      openHint: "Включите его над лентой",
    },
    profile: {
      title: "Укажите рост и языки",
      text: "Кастинги видны и без этого, но менеджер сразу увидит, подходите ли вы под требования.",
      height: "Рост, см",
      heightPh: "172",
      languages: "Языки",
      languagesHint: `До ${MAX_LANGS}`,
      save: "Сохранить",
      saving: "Сохраняем…",
      saved: "Сохранено",
      invalid: `Рост — от ${HEIGHT_MIN} до ${HEIGHT_MAX} см, языков — не больше ${MAX_LANGS}.`,
      failed: "Не удалось сохранить. Попробуйте ещё раз.",
    },
    locked: {
      kyc: (n) => `Отклик — после KYC уровня ${n}`,
      open: "Включите «Открыта к турам»",
      both: (n) => `Отклик — после KYC ${n} и «Открыта к турам»`,
    },
  },
  EN: {
    review: {
      title: "Your profile is under review",
      text: "Castings open as soon as the club team approves your profile. Once that happens, the feed will appear right here.",
    },
    banned: {
      title: "Casting access is paused",
      text: "While your account is restricted, castings are hidden. If this is a mistake, message the concierge.",
    },
    restricted: {
      title: "Casting access is limited",
      text: "Castings are closed for you by a club decision. The concierge can tell you what to do next.",
    },
    concierge: "Message the concierge",
    steps: {
      title: "You can already see castings. To reply:",
      text: "Browse briefs, dates and fees right now. “Ready for the tour” switches on once every item is checked.",
      approved: "Profile approved",
      kyc: (have, need) => `Verification: level ${have} of ${need}`,
      kycCta: "Get verified",
      open: "“Open to tours” switch",
      openHint: "Turn it on above the feed",
    },
    profile: {
      title: "Add your height and languages",
      text: "Castings show without them, but the manager will instantly see whether you match the requirements.",
      height: "Height, cm",
      heightPh: "172",
      languages: "Languages",
      languagesHint: `Up to ${MAX_LANGS}`,
      save: "Save",
      saving: "Saving…",
      saved: "Saved",
      invalid: `Height ${HEIGHT_MIN}–${HEIGHT_MAX} cm, no more than ${MAX_LANGS} languages.`,
      failed: "Couldn’t save. Please try again.",
    },
    locked: {
      kyc: (n) => `Replies open after KYC level ${n}`,
      open: "Turn on “Open to tours”",
      both: (n) => `Replies open after KYC ${n} and “Open to tours”`,
    },
  },
  ES: {
    review: {
      title: "Tu perfil está en revisión",
      text: "Los castings se abren en cuanto el equipo del club apruebe tu perfil. En cuanto ocurra, el feed aparecerá aquí.",
    },
    banned: {
      title: "Acceso a castings en pausa",
      text: "Mientras tu cuenta esté restringida, los castings no se muestran. Si es un error, escribe al conserje.",
    },
    restricted: {
      title: "Acceso a castings limitado",
      text: "Los castings están cerrados para ti por decisión del club. El conserje te dirá qué hacer.",
    },
    concierge: "Escribir al conserje",
    steps: {
      title: "Ya ves los castings. Para responder:",
      text: "Mira briefs, fechas y honorarios ahora mismo. “Lista para el tour” se activa cuando todo esté marcado.",
      approved: "Perfil aprobado",
      kyc: (have, need) => `Verificación: nivel ${have} de ${need}`,
      kycCta: "Verificarme",
      open: "Interruptor “Disponible para tours”",
      openHint: "Actívalo encima del feed",
    },
    profile: {
      title: "Indica tu altura e idiomas",
      text: "Los castings se ven igual, pero el gerente verá al instante si cumples los requisitos.",
      height: "Altura, cm",
      heightPh: "172",
      languages: "Idiomas",
      languagesHint: `Hasta ${MAX_LANGS}`,
      save: "Guardar",
      saving: "Guardando…",
      saved: "Guardado",
      invalid: `Altura ${HEIGHT_MIN}–${HEIGHT_MAX} cm, máximo ${MAX_LANGS} idiomas.`,
      failed: "No se pudo guardar. Inténtalo de nuevo.",
    },
    locked: {
      kyc: (n) => `Respuesta tras KYC nivel ${n}`,
      open: "Activa “Disponible para tours”",
      both: (n) => `Respuesta tras KYC ${n} y “Disponible para tours”`,
    },
  },
  PT: {
    review: {
      title: "Seu perfil está em análise",
      text: "Os castings abrem assim que a equipe do clube aprovar seu perfil. Assim que isso acontecer, o feed aparece aqui.",
    },
    banned: {
      title: "Acesso aos castings pausado",
      text: "Enquanto a conta estiver restrita, os castings ficam ocultos. Se for um erro, fale com o concierge.",
    },
    restricted: {
      title: "Acesso aos castings limitado",
      text: "Os castings estão fechados para você por decisão do clube. O concierge explica o que fazer.",
    },
    concierge: "Falar com o concierge",
    steps: {
      title: "Você já vê os castings. Para responder:",
      text: "Veja briefs, datas e cachês agora. “Pronta para o tour” liga quando todos os itens estiverem marcados.",
      approved: "Perfil aprovado",
      kyc: (have, need) => `Verificação: nível ${have} de ${need}`,
      kycCta: "Fazer verificação",
      open: "Botão “Disponível para tours”",
      openHint: "Ative acima do feed",
    },
    profile: {
      title: "Informe altura e idiomas",
      text: "Os castings aparecem mesmo assim, mas o gerente verá na hora se você atende aos requisitos.",
      height: "Altura, cm",
      heightPh: "172",
      languages: "Idiomas",
      languagesHint: `Até ${MAX_LANGS}`,
      save: "Salvar",
      saving: "Salvando…",
      saved: "Salvo",
      invalid: `Altura ${HEIGHT_MIN}–${HEIGHT_MAX} cm, no máximo ${MAX_LANGS} idiomas.`,
      failed: "Não foi possível salvar. Tente de novo.",
    },
    locked: {
      kyc: (n) => `Resposta após KYC nível ${n}`,
      open: "Ative “Disponível para tours”",
      both: (n) => `Resposta após KYC ${n} e “Disponível para tours”`,
    },
  },
};

/**
 * Подпись для заблокированной кнопки «Готова в тур».
 * casting — уровень конкретного кастинга; без него — общий порог (старая RPC).
 */
export function lockedLabel(
  me: ResidentProfile,
  open: boolean,
  lang: Lang,
  casting?: { minKyc: number; kycOk: boolean },
): string {
  const t = (ACCESS_COPY[lang] ?? ACCESS_COPY.EN).locked;
  const need = casting ? casting.minKyc : me.requiredKyc;
  const kyc = casting ? !casting.kycOk : me.blockers.includes("kyc");
  if (kyc && need === 0 && !me.hasPhoto) return (KYC_EXTRA[lang] ?? KYC_EXTRA.EN).lockedPhoto;
  if (kyc && !open) return t.both(need);
  if (kyc) return t.kyc(need);
  return t.open;
}

/** Блокеры, при которых кастингов нет совсем */
export const hardBlocker = (me: ResidentProfile) =>
  me.blockers.find((b) => b === "review" || b === "banned" || b === "restricted") ?? null;

export default function CastingAccessBanner({
  me,
  open,
  lang,
  onProfileSaved,
}: {
  me: ResidentProfile;
  /** Тумблер «Открыта к турам» — текущее значение на экране, а не из загрузки */
  open: boolean;
  lang: Lang;
  onProfileSaved: (v: { height: number | null; languages: string[] }) => void;
}) {
  const t = ACCESS_COPY[lang] ?? ACCESS_COPY.EN;
  const hard = hardBlocker(me);

  if (hard) {
    const copy = t[hard];
    const Icon = hard === "review" ? Clock : ShieldAlert;
    return (
      <div role="status" className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-amber-200/25 bg-gradient-to-br from-amber-200/[0.07] via-zinc-900/60 to-zinc-950/80 p-6 sm:flex-row sm:items-center">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${ICON_RING.gold}`}>
          <Icon className="size-5" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${cormorant.className} text-xl font-medium text-zinc-100`}>{copy.title}</p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">{copy.text}</p>
        </div>
        {hard !== "review" && (
          <Link href={CONCIERGE_HREF} className={BTN_GHOST}>
            {t.concierge}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    );
  }

  const needKyc = me.blockers.includes("kyc");
  const needPhoto = me.blockers.includes("photo");
  const x = KYC_EXTRA[lang] ?? KYC_EXTRA.EN;
  // Часть кастингов закрыта по уровню, хотя на другие KYC уже хватает
  const partial = me.openCastings !== null && me.openCastingsKycOk !== null && me.openCastingsKycOk < me.openCastings;
  const showSteps = needKyc || needPhoto || partial || !open;
  const showProfile = me.height === null || me.languages.length === 0;
  if (!showSteps && !showProfile) return null;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {showSteps && (
        <div role="status" className="rounded-2xl border border-amber-200/25 bg-gradient-to-br from-amber-200/[0.07] via-zinc-900/60 to-zinc-950/80 p-5">
          <p className="flex items-start gap-2 text-sm font-medium text-zinc-100">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-200" strokeWidth={1.75} aria-hidden />
            {t.steps.title}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{t.steps.text}</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <Step done icon={ShieldCheck} text={t.steps.approved} />
            {needPhoto && (
              <Step
                done={false}
                icon={Camera}
                text={x.photo}
                action={
                  <Link href={PROFILE_PHOTO_HREF} className="inline-flex items-center gap-1 text-xs text-amber-200 underline-offset-4 hover:underline">
                    {x.photoCta}
                    <ArrowRight className="size-3" aria-hidden />
                  </Link>
                }
              />
            )}
            <Step
              done={!needKyc && !partial}
              icon={ShieldCheck}
              text={
                me.openCastings !== null && me.openCastingsKycOk !== null && me.openCastings > 0
                  ? partial || needKyc
                    ? x.avail(me.kycLevel, me.openCastingsKycOk, me.openCastings)
                    : x.allOpen(me.kycLevel)
                  : t.steps.kyc(Math.min(me.kycLevel, me.requiredKyc), me.requiredKyc)
              }
              action={
                needKyc || partial ? (
                  <Link href={KYC_HREF} className="inline-flex items-center gap-1 text-xs text-amber-200 underline-offset-4 hover:underline">
                    {t.steps.kycCta}
                    <ArrowRight className="size-3" aria-hidden />
                  </Link>
                ) : null
              }
            />
            <Step
              done={open}
              icon={ToggleRight}
              text={t.steps.open}
              action={!open ? <span className="text-xs text-zinc-500">{t.steps.openHint}</span> : null}
            />
          </ul>
          <KycLevelsExplainer level={me.kycLevel} lang={lang} />
        </div>
      )}
      {showProfile && <ProfileCard me={me} t={t.profile} onSaved={onProfileSaved} />}
    </div>
  );
}

function Step({ done, icon: Icon, text, action }: { done: boolean; icon: typeof Check; text: string; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${done ? ICON_RING.emerald : ICON_RING.zinc}`}
        aria-hidden
      >
        {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" strokeWidth={1.75} />}
      </span>
      <span className={done ? "text-zinc-400 line-through decoration-zinc-600" : "text-zinc-100"}>{text}</span>
      {action}
    </li>
  );
}

function ProfileCard({
  me,
  t,
  onSaved,
}: {
  me: ResidentProfile;
  t: Dict["profile"];
  onSaved: (v: { height: number | null; languages: string[] }) => void;
}) {
  const [height, setHeight] = useState(me.height !== null ? String(me.height) : "");
  const [langs, setLangs] = useState<string[]>(me.languages);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "invalid" | "failed">("idle");

  const toggle = (code: string) => {
    setState("idle");
    setLangs((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : cur.length >= MAX_LANGS ? cur : [...cur, code]));
  };

  const save = async () => {
    const h = height.trim() === "" ? null : Number(height);
    if (h !== null && (!Number.isFinite(h) || h < HEIGHT_MIN || h > HEIGHT_MAX)) {
      setState("invalid");
      return;
    }
    setState("saving");
    const res = await setCastingProfile({ height: h, languages: langs });
    if (!res.ok) {
      setState(res.reason === "invalid" ? "invalid" : "failed");
      return;
    }
    setState("saved");
    onSaved({ height: res.height, languages: res.languages });
  };

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
      <p className="flex items-start gap-2 text-sm font-medium text-zinc-100">
        <Ruler className="mt-0.5 size-4 shrink-0 text-amber-200" strokeWidth={1.75} aria-hidden />
        {t.title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{t.text}</p>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          {t.height}
          <input
            type="number"
            inputMode="numeric"
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            value={height}
            placeholder={t.heightPh}
            onChange={(e) => {
              setHeight(e.target.value);
              setState("idle");
            }}
            className="h-11 w-28 rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/50 focus:outline-none sm:h-9"
          />
        </label>
        <fieldset className="min-w-0 flex-1">
          <legend className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <Languages className="size-3.5" aria-hidden />
            {t.languages} <span className="text-zinc-600">· {t.languagesHint}</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGE_CODES.map((code) => {
              const on = langs.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(code)}
                  className={`min-h-11 rounded-full border px-3 text-xs transition-colors sm:min-h-8 ${on ? PILL.gold : PILL.zinc}`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={state === "saving"} className={BTN_GOLD}>
          {state === "saving" ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
          {state === "saving" ? t.saving : t.save}
        </button>
        {state === "saved" && <span className="text-xs text-emerald-300">{t.saved}</span>}
        {state === "invalid" && <span className="text-xs text-rose-200">{t.invalid}</span>}
        {state === "failed" && <span className="text-xs text-rose-200">{t.failed}</span>}
      </div>
    </div>
  );
}

/** Раскрывающееся описание уровней KYC для резидентки — без визуального шума */
export function KycLevelsExplainer({ level, lang }: { level: number; lang: Lang }) {
  const k = kycCopy(lang);
  const x = KYC_EXTRA[lang] ?? KYC_EXTRA.EN;
  return (
    <details className="group mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 text-xs text-zinc-300">
        {k.levelsTitle}
        <ChevronDown className="size-3.5 text-zinc-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <ol className="mt-2 space-y-2 pb-1">
        {KYC_LEVELS.map((lvl) => {
          const here = lvl === Math.max(0, Math.min(3, Math.round(level)));
          return (
            <li key={lvl} className={`flex gap-2.5 rounded-lg px-2 py-1.5 ${here ? "bg-amber-200/[0.06]" : ""}`}>
              <span className="mt-0.5"><KycSteps level={lvl} tone={lvl <= level ? "ok" : "need"} /></span>
              <span className="min-w-0 text-[12px] leading-snug">
                <span className={here ? "text-amber-100" : "text-zinc-200"}>
                  {k.label(lvl)} · {k.levels[lvl].name}
                </span>
                {here && <span className="ml-1.5 text-[10px] uppercase tracking-[0.14em] text-amber-200/70">{x.youAreHere}</span>}
                <span className="block text-zinc-500">{k.levels[lvl].resident}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
