"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — поля брифа кастинга
 * app/(dashboard)/partner/_components/CastingBriefFields.tsx
 *
 * Блок полей для формы создания кастинга: гонорар и валюта, кто платит
 * перелёт и отель, минимальный рост, языки, текст брифа.
 *
 *   CastingBriefFields   — контролируемые поля (value / onChange)
 *   briefErrors(v)       — проверка до отправки, ключи переводятся на языке формы
 *   createCasting(v)     — insert в partner_castings; manager_id ставит база
 *
 * Колонки и ограничения — миграция 20261015120000_partner_resident_feed.sql
 * ──────────────────────────────────────────────────────────────────── */

import { useId, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import type { Payer, ProjectKey } from "../_lib/command";

export const PROJECT_TYPES: ProjectKey[] = ["shoot", "show", "campaign", "event"];
export const AUDIENCE_SEGMENTS = ["all", "working", "elite"] as const;
export type AudienceSegment = (typeof AUDIENCE_SEGMENTS)[number];
export const CURRENCIES = ["USD", "EUR", "AED", "AUD", "GBP"] as const;
export const LANGUAGE_CODES = ["EN", "RU", "ES", "PT", "FR", "IT", "DE", "AR"] as const;
const PAYERS: Payer[] = ["manager", "participant", "split"];
const BRIEF_MAX = 2000;
const MAX_LANGS = 5;

export type BriefValues = {
  city: string;
  audienceSegment: AudienceSegment;
  project: ProjectKey;
  startsOn: string; // YYYY-MM-DD
  endsOn: string;
  slots: number;
  closesAt: string; // datetime-local, локальное время
  feeAmount: string; // пусто — «по договорённости»
  feeCurrency: (typeof CURRENCIES)[number];
  flightPaidBy: Payer;
  hotelPaidBy: Payer;
  heightMin: string; // пусто — без требования
  languages: string[];
  brief: string;
};

export const EMPTY_BRIEF: BriefValues = {
  city: "",
  audienceSegment: "working",
  project: "shoot",
  startsOn: "",
  endsOn: "",
  slots: 1,
  closesAt: "",
  feeAmount: "",
  feeCurrency: "USD",
  flightPaidBy: "manager",
  hotelPaidBy: "manager",
  heightMin: "",
  languages: [],
  brief: "",
};

/* ── проверка ─────────────────────────────────────────────────────── */

export type BriefErrorKey =
  | "city"
  | "dates"
  | "slots"
  | "closesAt"
  | "fee"
  | "height"
  | "languages"
  | "brief";

/** Пустой список — форма валидна */
export function briefErrors(v: BriefValues): BriefErrorKey[] {
  const errs: BriefErrorKey[] = [];
  const city = v.city.trim();
  if (city.length < 2 || city.length > 60) errs.push("city");
  if (!v.startsOn || !v.endsOn || v.endsOn < v.startsOn) errs.push("dates");
  if (!Number.isInteger(v.slots) || v.slots < 1 || v.slots > 50) errs.push("slots");
  if (!v.closesAt || new Date(v.closesAt).getTime() <= Date.now()) errs.push("closesAt");
  if (v.feeAmount.trim() !== "") {
    const n = Number(v.feeAmount.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) errs.push("fee");
  }
  if (v.heightMin.trim() !== "") {
    const h = Number(v.heightMin);
    if (!Number.isInteger(h) || h < 140 || h > 230) errs.push("height");
  }
  if (v.languages.length > MAX_LANGS) errs.push("languages");
  if (v.brief.length > BRIEF_MAX) errs.push("brief");
  return errs;
}

/* ── запись в базу ────────────────────────────────────────────────── */

/** Значения формы → строка partner_castings (snake_case, как в миграции) */
export function briefToRow(v: BriefValues) {
  const fee = v.feeAmount.trim() === "" ? null : Number(v.feeAmount.replace(",", "."));
  return {
    city: v.city.trim(),
    audience_segment: v.audienceSegment,
    project_type: v.project,
    starts_on: v.startsOn,
    ends_on: v.endsOn,
    slots: v.slots,
    closes_at: new Date(v.closesAt).toISOString(),
    fee_amount: fee,
    fee_currency: fee === null ? null : v.feeCurrency,
    flight_paid_by: v.flightPaidBy,
    hotel_paid_by: v.hotelPaidBy,
    height_min: v.heightMin.trim() === "" ? null : Number(v.heightMin),
    languages: v.languages,
    brief: v.brief.trim() === "" ? null : v.brief.trim(),
  };
}

export type CreateResult = { ok: true; id: string } | { ok: false; reason: "invalid" | "forbidden" | "network" };

/** insert в partner_castings. Права проверяет RLS: только свои, только штат */
export async function createCasting(v: BriefValues): Promise<CreateResult> {
  if (briefErrors(v).length > 0) return { ok: false, reason: "invalid" };
  const { data, error } = await supabase
    .from("partner_castings")
    .insert(briefToRow(v))
    .select("id")
    .single();
  if (error) return { ok: false, reason: error.code === "42501" ? "forbidden" : "network" };
  return { ok: true, id: data.id as string };
}

/* ── тексты ───────────────────────────────────────────────────────── */

type Dict = {
  city: string;
  cityHint: string;
  project: string;
  audienceSegment: string;
  audiences: Record<AudienceSegment, string>;
  projects: Record<ProjectKey, string>;
  dates: string;
  from: string;
  to: string;
  slots: string;
  closesAt: string;
  fee: string;
  feePlaceholder: string;
  feeHint: string;
  flight: string;
  hotel: string;
  payer: Record<Payer, string>;
  height: string;
  heightHint: string;
  languages: string;
  languagesHint: string;
  brief: string;
  briefHint: string;
  errors: Record<BriefErrorKey, string>;
};

const T: Record<Lang, Dict> = {
  EN: {
    city: "City",
    cityHint: "As it will appear in the brief.",
    project: "Project type",
    audienceSegment: "Target audience",
    audiences: { all: "All residents", working: "Working", elite: "Elite" },
    projects: { shoot: "Shoot", show: "Show", campaign: "Campaign", event: "Event" },
    dates: "Dates",
    from: "From",
    to: "To",
    slots: "Spots",
    closesAt: "Replies close at",
    fee: "Participant fee",
    feePlaceholder: "Amount",
    feeHint: "Leave empty for “negotiable”.",
    flight: "Flight paid by",
    hotel: "Hotel paid by",
    payer: { manager: "Manager", participant: "Participant", split: "Split" },
    height: "Minimum height, cm",
    heightHint: "Leave empty if there is no requirement.",
    languages: "Languages",
    languagesHint: `Up to ${MAX_LANGS}.`,
    brief: "Brief",
    briefHint: `Up to ${BRIEF_MAX} characters. Shown to residents before they reply.`,
    errors: {
      city: "City: 2–60 characters.",
      dates: "Check the dates: the end can’t be before the start.",
      slots: "Spots: a whole number from 1 to 50.",
      closesAt: "Set a closing time in the future.",
      fee: "Fee: enter a number.",
      height: "Height: from 140 to 230 cm.",
      languages: `No more than ${MAX_LANGS} languages.`,
      brief: `The brief is longer than ${BRIEF_MAX} characters.`,
    },
  },
  RU: {
    city: "Город",
    cityHint: "Так он будет виден в брифе.",
    project: "Тип проекта",
    audienceSegment: "Целевая аудитория",
    audiences: { all: "Все резидентки", working: "Working", elite: "Elite" },
    projects: { shoot: "Съёмка", show: "Показ", campaign: "Кампейн", event: "Ивент" },
    dates: "Даты",
    from: "С",
    to: "По",
    slots: "Мест",
    closesAt: "Приём откликов закроется",
    fee: "Гонорар участницы",
    feePlaceholder: "Сумма",
    feeHint: "Пусто — «договорной».",
    flight: "Перелёт оплачивает",
    hotel: "Отель оплачивает",
    payer: { manager: "Менеджер", participant: "Участница", split: "Пополам" },
    height: "Минимальный рост, см",
    heightHint: "Пусто — требования нет.",
    languages: "Языки",
    languagesHint: `До ${MAX_LANGS}.`,
    brief: "Бриф",
    briefHint: `До ${BRIEF_MAX} символов. Резидентки видят его до отклика.`,
    errors: {
      city: "Город: от 2 до 60 символов.",
      dates: "Проверьте даты: конец не может быть раньше начала.",
      slots: "Мест: целое число от 1 до 50.",
      closesAt: "Укажите время закрытия откликов в будущем.",
      fee: "Гонорар: введите число.",
      height: "Рост: от 140 до 230 см.",
      languages: `Языков не больше ${MAX_LANGS}.`,
      brief: `Бриф длиннее ${BRIEF_MAX} символов.`,
    },
  },
  ES: {
    city: "Ciudad",
    cityHint: "Tal como aparecerá en el brief.",
    project: "Tipo de proyecto",
    audienceSegment: "Audiencia objetivo",
    audiences: { all: "Todas las residentes", working: "Working", elite: "Elite" },
    projects: { shoot: "Sesión", show: "Desfile", campaign: "Campaña", event: "Evento" },
    dates: "Fechas",
    from: "Desde",
    to: "Hasta",
    slots: "Plazas",
    closesAt: "Las respuestas cierran el",
    fee: "Honorario de la participante",
    feePlaceholder: "Importe",
    feeHint: "Vacío — «a convenir».",
    flight: "El vuelo lo paga",
    hotel: "El hotel lo paga",
    payer: { manager: "Gerente", participant: "Participante", split: "A medias" },
    height: "Altura mínima, cm",
    heightHint: "Vacío — sin requisito.",
    languages: "Idiomas",
    languagesHint: `Hasta ${MAX_LANGS}.`,
    brief: "Brief",
    briefHint: `Hasta ${BRIEF_MAX} caracteres. Las participantes lo ven antes de responder.`,
    errors: {
      city: "Ciudad: de 2 a 60 caracteres.",
      dates: "Revisa las fechas: el fin no puede ser anterior al inicio.",
      slots: "Plazas: número entero de 1 a 50.",
      closesAt: "Indica una hora de cierre futura.",
      fee: "Honorario: introduce un número.",
      height: "Altura: de 140 a 230 cm.",
      languages: `No más de ${MAX_LANGS} idiomas.`,
      brief: `El brief supera los ${BRIEF_MAX} caracteres.`,
    },
  },
  PT: {
    city: "Cidade",
    cityHint: "Como vai aparecer no brief.",
    project: "Tipo de projeto",
    audienceSegment: "Público-alvo",
    audiences: { all: "Todas as residentes", working: "Working", elite: "Elite" },
    projects: { shoot: "Ensaio", show: "Desfile", campaign: "Campanha", event: "Evento" },
    dates: "Datas",
    from: "De",
    to: "Até",
    slots: "Vagas",
    closesAt: "As respostas fecham em",
    fee: "Cachê da participante",
    feePlaceholder: "Valor",
    feeHint: "Vazio — «a combinar».",
    flight: "Passagem paga por",
    hotel: "Hotel pago por",
    payer: { manager: "Gerente", participant: "Participante", split: "Dividido" },
    height: "Altura mínima, cm",
    heightHint: "Vazio — sem requisito.",
    languages: "Idiomas",
    languagesHint: `Até ${MAX_LANGS}.`,
    brief: "Brief",
    briefHint: `Até ${BRIEF_MAX} caracteres. As participantes veem antes de responder.`,
    errors: {
      city: "Cidade: de 2 a 60 caracteres.",
      dates: "Confira as datas: o fim não pode ser antes do início.",
      slots: "Vagas: número inteiro de 1 a 50.",
      closesAt: "Informe um horário de fechamento no futuro.",
      fee: "Cachê: informe um número.",
      height: "Altura: de 140 a 230 cm.",
      languages: `No máximo ${MAX_LANGS} idiomas.`,
      brief: `O brief tem mais de ${BRIEF_MAX} caracteres.`,
    },
  },
};

/* ── поля ─────────────────────────────────────────────────────────── */

const INPUT =
  "min-h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition focus:border-amber-200/50 focus:outline-none focus:ring-2 focus:ring-amber-200/15 sm:min-h-10";

function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">
      {children}
    </label>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  render,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  render: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1.5">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={`min-h-11 rounded-xl border px-2 text-xs tracking-wide transition sm:min-h-10 ${
              on
                ? "border-amber-200/50 bg-amber-200/10 text-amber-100"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

export function CastingBriefFields({
  value,
  onChange,
  errors = [],
}: {
  value: BriefValues;
  onChange: (next: BriefValues) => void;
  /** Ключи из briefErrors — показываются под полями, которые не прошли проверку */
  errors?: BriefErrorKey[];
}) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const ids = {
    city: useId(),
    project: useId(),
    startsOn: useId(),
    endsOn: useId(),
    slots: useId(),
    closesAt: useId(),
    fee: useId(),
    height: useId(),
    brief: useId(),
  };
  const set = (patch: Partial<BriefValues>) => onChange({ ...value, ...patch });
  const toggleLang = (code: string) => {
    const has = value.languages.includes(code);
    if (!has && value.languages.length >= MAX_LANGS) return;
    set({ languages: has ? value.languages.filter((c) => c !== code) : [...value.languages, code] });
  };
  const err = (k: BriefErrorKey) => errors.includes(k) && (
    <p role="alert" className="mt-1.5 text-[11px] text-rose-300">
      {t.errors[k]}
    </p>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={ids.city}>{t.city}</Label>
        <input id={ids.city} className={INPUT} value={value.city} maxLength={60} onChange={(e) => set({ city: e.target.value })} />
        <p className="text-[11px] text-zinc-500">{t.cityHint}</p>
        {err("city")}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.project}</p>
        <Choice
          label={t.project}
          value={value.project}
          options={PROJECT_TYPES}
          render={(p) => t.projects[p]}
          onChange={(p) => set({ project: p })}
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.audienceSegment}</p>
        <Choice
          label={t.audienceSegment}
          value={value.audienceSegment}
          options={AUDIENCE_SEGMENTS}
          render={(audience) => t.audiences[audience]}
          onChange={(audience) => set({ audienceSegment: audience })}
        />
        <p className="text-[11px] text-zinc-500">Working sees Working/All castings; Elite sees only Elite/All castings.</p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.dates}</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={ids.startsOn} className="sr-only">{t.from}</label>
            <input id={ids.startsOn} type="date" className={INPUT} value={value.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
          </div>
          <div>
            <label htmlFor={ids.endsOn} className="sr-only">{t.to}</label>
            <input id={ids.endsOn} type="date" className={INPUT} value={value.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />
          </div>
        </div>
        {err("dates")}
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.slots}>{t.slots}</Label>
        <input
          id={ids.slots}
          type="number"
          min={1}
          max={50}
          className={INPUT}
          value={value.slots}
          onChange={(e) => set({ slots: Number(e.target.value) })}
        />
        {err("slots")}
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.closesAt}>{t.closesAt}</Label>
        <input id={ids.closesAt} type="datetime-local" className={INPUT} value={value.closesAt} onChange={(e) => set({ closesAt: e.target.value })} />
        {err("closesAt")}
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.fee}>{t.fee}</Label>
        <div className="flex gap-2">
          <input
            id={ids.fee}
            inputMode="decimal"
            placeholder={t.feePlaceholder}
            className={`${INPUT} min-w-0 flex-1 font-mono`}
            value={value.feeAmount}
            onChange={(e) => set({ feeAmount: e.target.value })}
          />
          <select
            aria-label={`${t.fee} · currency`}
            className={`${INPUT} w-24 shrink-0 px-2 text-center font-mono`}
            value={value.feeCurrency}
            onChange={(e) => set({ feeCurrency: e.target.value as BriefValues["feeCurrency"] })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-zinc-900">{c}</option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-zinc-500">{t.feeHint}</p>
        {err("fee")}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.flight}</p>
        <Choice label={t.flight} value={value.flightPaidBy} options={PAYERS} render={(p) => t.payer[p]} onChange={(p) => set({ flightPaidBy: p })} />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.hotel}</p>
        <Choice label={t.hotel} value={value.hotelPaidBy} options={PAYERS} render={(p) => t.payer[p]} onChange={(p) => set({ hotelPaidBy: p })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.height}>{t.height}</Label>
        <input
          id={ids.height}
          inputMode="numeric"
          className={INPUT}
          value={value.heightMin}
          onChange={(e) => set({ heightMin: e.target.value.replace(/\D/g, "") })}
        />
        <p className="text-[11px] text-zinc-500">{t.heightHint}</p>
        {err("height")}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.languages}</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.languages}>
          {LANGUAGE_CODES.map((code) => {
            const on = value.languages.includes(code);
            return (
              <button
                key={code}
                type="button"
                aria-pressed={on}
                onClick={() => toggleLang(code)}
                className={`min-h-9 rounded-full border px-3 font-mono text-xs transition ${
                  on ? "border-amber-200/50 bg-amber-200/10 text-amber-100" : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {code}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-500">{t.languagesHint}</p>
        {err("languages")}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={ids.brief}>{t.brief}</Label>
        <textarea
          id={ids.brief}
          rows={4}
          maxLength={BRIEF_MAX}
          className={`${INPUT} min-h-28 py-3`}
          value={value.brief}
          onChange={(e) => set({ brief: e.target.value })}
        />
        <p className="text-[11px] text-zinc-500">{t.briefHint}</p>
        {err("brief")}
      </div>
    </div>
  );
}
