"use client";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — поля брифа кастинга
 * app/(dashboard)/partner/_components/CastingBriefFields.tsx
 *
 * Блок полей для формы создания кастинга: статичный тур из каталога
 * (tour_catalog), заголовок и бриф на RU/EN/ES/PT с автопереводом,
 * гонорар и валюта, кто платит перелёт и отель, рост, языки.
 *
 * Архитектура «Статичный тур ↔ Динамичный кастинг»: тур — постоянное
 * направление с базовыми условиями; кастинг — отбор на конкретные даты
 * под этот тур. Выбор тура подставляет его условия по умолчанию.
 *
 *   CastingBriefFields   — контролируемые поля (value / onChange)
 *   briefErrors(v)       — проверка до отправки, ключи переводятся на языке формы
 *   createCasting(v, o)  — insert в partner_castings; manager_id ставит база,
 *                          owner/admin передают организатора (VOYAGE Management или партнёр)
 *   updateCasting(id, v) — правка брифа; rowToBrief(row) — строка базы → значения формы
 *   deleteCasting(id)    — удаление (только owner/admin)
 *
 * Колонки и ограничения — миграции 20261015120000_partner_resident_feed.sql
 * и 20261103090000_tour_catalog_casting_i18n_invites.sql (тур, title_i18n,
 * brief_i18n, source_lang; brief заполняет триггер из версии на языке автора).
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useId, useState, type ReactNode } from "react";
import { MapPinned } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import type { Payer, ProjectKey } from "@/app/(dashboard)/partner/_lib/command";
import { PROJECTS, projectHint, projectLabels, toProjectKey } from "@/lib/project-types";
import { I18nTextFields } from "@/app/(dashboard)/partner/_components/I18nTextFields";
import {
  BRIEF_MAX,
  TITLE_MAX,
  cleanI18n,
  pickI18n,
  toCastingLang,
  toI18n,
  type CastingLang,
  type I18nText,
} from "@/lib/casting-i18n";
import { TOUR_CATALOG_COLUMNS, parseCatalogTour, type CatalogTour } from "@/lib/tour-catalog";

/** Тур (1–2 недели) и Ивент (до 1 дня) — lib/project-types.ts */
export const PROJECT_TYPES: readonly ProjectKey[] = PROJECTS;
export const AUDIENCE_SEGMENTS = ["all", "working", "elite"] as const;
export type AudienceSegment = (typeof AUDIENCE_SEGMENTS)[number];
export const CURRENCIES = ["USD", "EUR", "AED", "AUD", "GBP"] as const;
export const LANGUAGE_CODES = ["EN", "RU", "ES", "PT", "FR", "IT", "DE", "AR"] as const;
const PAYERS: Payer[] = ["manager", "participant", "split"];
const MAX_LANGS = 5;
const TITLE_MIN = 3;

export type BriefValues = {
  /** Статичный тур из каталога; "" — без тура (только у старых кастингов) */
  catalogTourId: string;
  /** Язык, на котором пишет автор */
  sourceLang: CastingLang;
  /** Заголовок кастинга на 4 языках */
  titleI18n: I18nText;
  /** Бриф на 4 языках */
  briefI18n: I18nText;
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
};

export const EMPTY_BRIEF: BriefValues = {
  catalogTourId: "",
  sourceLang: "RU",
  titleI18n: {},
  briefI18n: {},
  city: "",
  audienceSegment: "working",
  project: "tour",
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
};

/* ── проверка ─────────────────────────────────────────────────────── */

export type BriefErrorKey =
  | "tour"
  | "title"
  | "city"
  | "dates"
  | "slots"
  | "closesAt"
  | "fee"
  | "height"
  | "languages"
  | "brief";

export type BriefCheckOptions = {
  /** Новый кастинг обязан ссылаться на тур, если в каталоге есть активные туры */
  requireTour?: boolean;
};

/** Пустой список — форма валидна */
export function briefErrors(v: BriefValues, opts: BriefCheckOptions = {}): BriefErrorKey[] {
  const errs: BriefErrorKey[] = [];
  if (opts.requireTour && !v.catalogTourId) errs.push("tour");
  const title = (v.titleI18n[v.sourceLang] ?? "").trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) errs.push("title");
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
  if (Object.values(v.briefI18n).some((text) => (text ?? "").length > BRIEF_MAX)) errs.push("brief");
  return errs;
}

/* ── запись в базу ────────────────────────────────────────────────── */

/** Значения формы → строка partner_castings (snake_case, как в миграции) */
export function briefToRow(v: BriefValues) {
  const fee = v.feeAmount.trim() === "" ? null : Number(v.feeAmount.replace(",", "."));
  const briefI18n = cleanI18n(v.briefI18n, BRIEF_MAX);
  return {
    catalog_tour_id: v.catalogTourId || null,
    source_lang: v.sourceLang,
    title_i18n: cleanI18n(v.titleI18n, TITLE_MAX),
    brief_i18n: briefI18n,
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
    // Триггер partner_castings_sync_i18n пересчитает brief из brief_i18n; здесь — для старой базы.
    brief: pickI18n(briefI18n, v.sourceLang, v.sourceLang),
  };
}

/**
 * Причина отказа базы → понятная причина для формы.
 *   forbidden — нет прав (RLS, права на колонки, триггер организатора);
 *   organizer — организатор не найден / заблокирован / профиль клуба не создан;
 *   tour      — тур из каталога выключен или удалён;
 *   schema    — база старее кода (не применена миграция: тип tour/event, колонка);
 *   network   — всё остальное (сеть, таймаут).
 * Настоящая ошибка пишется в консоль — по ней видно, какая проверка сработала.
 */
export type WriteFailure = "forbidden" | "organizer" | "tour" | "schema" | "network";

function classifyWriteError(
  op: "create" | "update" | "delete",
  error: { code?: string; message?: string; details?: string | null; hint?: string | null },
): WriteFailure {
  console.error(`[partner_castings:${op}]`, error.code, error.message, error.details ?? "", error.hint ?? "");
  const msg = error.message ?? "";
  if (msg.includes("catalog_tour_inactive") || msg.includes("partner_castings_catalog_tour_fkey")) return "tour";
  if (msg.includes("invalid_organizer") || error.code === "23503") return "organizer";
  if (error.code === "42501") return "forbidden";
  if (error.code === "23514" || error.code === "42703" || error.code === "PGRST204") return "schema";
  return "network";
}

export type CreateResult = { ok: true; id: string } | { ok: false; reason: "invalid" | WriteFailure };

/**
 * insert в partner_castings. Права проверяет RLS: менеджер — только от себя,
 * owner/admin — от имени VOYAGE Management или любого действующего партнёра.
 * Права на колонки — миграция 20261101090000_casting_owner_full_rights.sql.
 */
export async function createCasting(
  v: BriefValues,
  organizerId?: string | null,
  opts: BriefCheckOptions = {},
): Promise<CreateResult> {
  if (briefErrors(v, opts).length > 0) return { ok: false, reason: "invalid" };
  const row = organizerId ? { ...briefToRow(v), manager_id: organizerId } : briefToRow(v);
  const { data, error } = await supabase
    .from("partner_castings")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, reason: classifyWriteError("create", error) };
  return { ok: true, id: data.id as string };
}

export type CastingStatus = "open" | "shortlist" | "closed" | "cancelled" | "archived";
export type UpdateResult = { ok: true } | { ok: false; reason: "invalid" | "has_tour" | WriteFailure };

/** Правка кастинга. organizerId меняет только owner/admin и только до появления тура. */
export async function updateCasting(
  id: string,
  v: BriefValues,
  extra: { status?: CastingStatus; organizerId?: string | null } = {},
): Promise<UpdateResult> {
  if (editErrors(v, extra.status).length > 0) return { ok: false, reason: "invalid" };
  const row: Record<string, unknown> = { ...briefToRow(v) };
  if (extra.status) row.status = extra.status;
  if (extra.organizerId) row.manager_id = extra.organizerId;
  const { data, error } = await supabase
    .from("partner_castings")
    .update(row)
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.message.includes("casting_has_tour")) return { ok: false, reason: "has_tour" };
    return { ok: false, reason: classifyWriteError("update", error) };
  }
  if (!data || data.length === 0) return { ok: false, reason: "forbidden" };
  return { ok: true };
}

export type DeleteResult = { ok: true } | { ok: false; reason: WriteFailure };

/**
 * Удаление кастинга — только owner/admin (RLS partner_castings_delete).
 * Отклики удаляются каскадом; созданный тур остаётся, его casting_id → NULL.
 */
export async function deleteCasting(id: string): Promise<DeleteResult> {
  const { data, error } = await supabase
    .from("partner_castings")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, reason: classifyWriteError("delete", error) };
  if (!data || data.length === 0) return { ok: false, reason: "forbidden" };
  return { ok: true };
}

/** Для правки: закрытый или отменённый кастинг можно сохранить с прошедшим сроком откликов. */
export function editErrors(v: BriefValues, status?: CastingStatus): BriefErrorKey[] {
  const closing = status === "closed" || status === "cancelled" || status === "archived";
  return briefErrors(v).filter((key) => !(key === "closesAt" && closing && v.closesAt));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Строка partner_castings → значения формы (closes_at в локальное datetime-local). */
export function rowToBrief(row: Record<string, unknown>): BriefValues {
  const sourceLang = toCastingLang(row.source_lang);
  const titleI18n = toI18n(row.title_i18n, TITLE_MAX);
  const briefI18n = toI18n(row.brief_i18n, BRIEF_MAX);
  // Кастинги до 03.11.2026: бриф только в brief, заголовка нет — подставляем город.
  if (!briefI18n[sourceLang] && typeof row.brief === "string" && row.brief.trim()) briefI18n[sourceLang] = row.brief;
  if (!titleI18n[sourceLang] && typeof row.city === "string" && row.city.trim()) titleI18n[sourceLang] = row.city;
  const closes = typeof row.closes_at === "string" ? new Date(row.closes_at) : null;
  const closesAt = closes && Number.isFinite(closes.getTime())
    ? `${closes.getFullYear()}-${pad(closes.getMonth() + 1)}-${pad(closes.getDate())}T${pad(closes.getHours())}:${pad(closes.getMinutes())}`
    : "";
  const project = toProjectKey(row.project_type) ?? "tour";
  const segment = AUDIENCE_SEGMENTS.includes(row.audience_segment as AudienceSegment) ? (row.audience_segment as AudienceSegment) : "working";
  const currency = CURRENCIES.includes(row.fee_currency as (typeof CURRENCIES)[number]) ? (row.fee_currency as (typeof CURRENCIES)[number]) : "USD";
  const payer = (value: unknown): Payer => (PAYERS.includes(value as Payer) ? (value as Payer) : "manager");
  return {
    catalogTourId: typeof row.catalog_tour_id === "string" ? row.catalog_tour_id : "",
    sourceLang,
    titleI18n,
    briefI18n,
    city: typeof row.city === "string" ? row.city : "",
    audienceSegment: segment,
    project,
    startsOn: typeof row.starts_on === "string" ? row.starts_on.slice(0, 10) : "",
    endsOn: typeof row.ends_on === "string" ? row.ends_on.slice(0, 10) : "",
    slots: Number.isInteger(Number(row.slots)) ? Number(row.slots) : 1,
    closesAt,
    feeAmount: row.fee_amount === null || row.fee_amount === undefined ? "" : String(row.fee_amount),
    feeCurrency: currency,
    flightPaidBy: payer(row.flight_paid_by),
    hotelPaidBy: payer(row.hotel_paid_by),
    heightMin: row.height_min === null || row.height_min === undefined ? "" : String(row.height_min),
    languages: Array.isArray(row.languages) ? row.languages.filter((x): x is string => typeof x === "string") : [],
  };
}

/* ── тексты ───────────────────────────────────────────────────────── */

type Dict = {
  tour: string;
  tourPick: string;
  tourNone: string;
  tourHidden: string;
  tourHint: string;
  tourEmpty: string;
  tourApplied: string;
  tourRequirements: string;
  tourConditions: string;
  texts: string;
  textsHint: string;
  title: string;
  titleHint: string;
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
  audienceHint: string;
  errors: Record<BriefErrorKey, string>;
};

const T: Record<Lang, Dict> = {
  EN: {
    tour: "Tour (static destination)",
    tourPick: "Choose a tour",
    tourNone: "No tour (legacy casting)",
    tourHidden: "Hidden tour",
    tourHint: "The casting is a selection for specific dates under a permanent club tour. The tour’s base terms are filled in automatically — you can change them below.",
    tourEmpty: "The tour catalog is empty. The owner adds tours in “Castings → Tours”.",
    tourApplied: "Tour terms applied: city, type, fee, payers, height and languages.",
    tourRequirements: "Requirements",
    tourConditions: "Base terms",
    texts: "Title and brief · 4 languages",
    textsHint: "Write in one language and press “Auto-translate” — residents see the version in their language.",
    title: "Casting title",
    titleHint: "For example: “Yacht weekend · 3 spots”.",
    city: "City",
    cityHint: "As it will appear in the brief.",
    project: "Project type",
    audienceSegment: "Target audience",
    audiences: { all: "All residents", working: "Working", elite: "Elite" },
    projects: projectLabels("EN"),
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
    audienceHint: "Working sees Working/All castings; Elite sees only Elite/All castings. Invited residents see the casting regardless.",
    errors: {
      tour: "Choose the tour this casting belongs to.",
      title: `Title in the original language: ${TITLE_MIN}–${TITLE_MAX} characters.`,
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
    tour: "Тур (статичное направление)",
    tourPick: "Выберите тур",
    tourNone: "Без тура (старый кастинг)",
    tourHidden: "Скрытый тур",
    tourHint: "Кастинг — отбор на конкретные даты под постоянный тур клуба. Базовые условия тура подставятся автоматически, ниже их можно изменить.",
    tourEmpty: "Каталог туров пуст. Owner добавляет туры в разделе «Кастинги → Туры».",
    tourApplied: "Подставлены условия тура: город, тип, гонорар, оплата, рост и языки.",
    tourRequirements: "Требования",
    tourConditions: "Базовые условия",
    texts: "Заголовок и бриф · 4 языка",
    textsHint: "Напишите на одном языке и нажмите «Автоперевод» — резидентки увидят версию на своём языке.",
    title: "Заголовок кастинга",
    titleHint: "Например: «Яхт-уикенд · 3 места».",
    city: "Город",
    cityHint: "Так он будет виден в брифе.",
    project: "Тип проекта",
    audienceSegment: "Целевая аудитория",
    audiences: { all: "Все резидентки", working: "Working", elite: "Elite" },
    projects: projectLabels("RU"),
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
    audienceHint: "Working видят кастинги Working/Все, Elite — только Elite/Все. Приглашённые резидентки видят кастинг в любом случае.",
    errors: {
      tour: "Выберите тур, под который создаётся кастинг.",
      title: `Заголовок на языке оригинала: от ${TITLE_MIN} до ${TITLE_MAX} символов.`,
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
    tour: "Tour (destino fijo)",
    tourPick: "Elige un tour",
    tourNone: "Sin tour (casting antiguo)",
    tourHidden: "Tour oculto",
    tourHint: "El casting es una selección para fechas concretas dentro de un tour permanente del club. Las condiciones base del tour se rellenan solas y puedes cambiarlas abajo.",
    tourEmpty: "El catálogo de tours está vacío. El owner añade tours en «Castings → Tours».",
    tourApplied: "Condiciones del tour aplicadas: ciudad, tipo, honorario, pagos, altura e idiomas.",
    tourRequirements: "Requisitos",
    tourConditions: "Condiciones base",
    texts: "Título y brief · 4 idiomas",
    textsHint: "Escribe en un idioma y pulsa «Traducir»: las residentes verán la versión en su idioma.",
    title: "Título del casting",
    titleHint: "Por ejemplo: «Fin de semana en yate · 3 plazas».",
    city: "Ciudad",
    cityHint: "Tal como aparecerá en el brief.",
    project: "Tipo de proyecto",
    audienceSegment: "Audiencia objetivo",
    audiences: { all: "Todas las residentes", working: "Working", elite: "Elite" },
    projects: projectLabels("ES"),
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
    audienceHint: "Working ve castings Working/Todas; Elite solo Elite/Todas. Las residentes invitadas ven el casting en cualquier caso.",
    errors: {
      tour: "Elige el tour al que pertenece este casting.",
      title: `Título en el idioma original: de ${TITLE_MIN} a ${TITLE_MAX} caracteres.`,
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
    tour: "Tour (destino fixo)",
    tourPick: "Escolha um tour",
    tourNone: "Sem tour (casting antigo)",
    tourHidden: "Tour oculto",
    tourHint: "O casting é uma seleção para datas específicas dentro de um tour permanente do clube. As condições base do tour são preenchidas automaticamente e podem ser alteradas abaixo.",
    tourEmpty: "O catálogo de tours está vazio. O owner adiciona tours em «Castings → Tours».",
    tourApplied: "Condições do tour aplicadas: cidade, tipo, cachê, pagamentos, altura e idiomas.",
    tourRequirements: "Requisitos",
    tourConditions: "Condições base",
    texts: "Título e brief · 4 idiomas",
    textsHint: "Escreva em um idioma e clique em «Traduzir» — as residentes verão a versão no idioma delas.",
    title: "Título do casting",
    titleHint: "Por exemplo: «Fim de semana no iate · 3 vagas».",
    city: "Cidade",
    cityHint: "Como vai aparecer no brief.",
    project: "Tipo de projeto",
    audienceSegment: "Público-alvo",
    audiences: { all: "Todas as residentes", working: "Working", elite: "Elite" },
    projects: projectLabels("PT"),
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
    audienceHint: "Working vê castings Working/Todas; Elite só Elite/Todas. Residentes convidadas veem o casting em qualquer caso.",
    errors: {
      tour: "Escolha o tour ao qual este casting pertence.",
      title: `Título no idioma original: de ${TITLE_MIN} a ${TITLE_MAX} caracteres.`,
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

/* ── каталог туров ────────────────────────────────────────────────── */

/** Активные туры каталога (RLS tour_catalog). Пустой список — миграция не применена или каталог пуст. */
export function useCatalogTours(): { loading: boolean; tours: CatalogTour[] } {
  const [state, setState] = useState<{ loading: boolean; tours: CatalogTour[] }>({ loading: true, tours: [] });
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data, error } = await supabase
        .from("tour_catalog")
        .select(TOUR_CATALOG_COLUMNS)
        .eq("is_active", true)
        .order("sort_order")
        .order("city");
      if (!alive) return;
      if (error) console.warn("[tour_catalog]", error.code, error.message);
      setState({ loading: false, tours: error ? [] : (data ?? []).flatMap((row) => parseCatalogTour(row) ?? []) });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Значения тура по умолчанию → поля кастинга */
export function applyTourDefaults(v: BriefValues, tour: CatalogTour): BriefValues {
  const currency = CURRENCIES.find((c) => c === tour.feeCurrency);
  return {
    ...v,
    catalogTourId: tour.id,
    city: tour.city,
    project: tour.project,
    audienceSegment: tour.audience,
    feeAmount: tour.feeAmount === null || !currency ? v.feeAmount : String(tour.feeAmount),
    feeCurrency: currency ?? v.feeCurrency,
    flightPaidBy: tour.flightPaidBy,
    hotelPaidBy: tour.hotelPaidBy,
    heightMin: tour.heightMin === null ? "" : String(tour.heightMin),
    languages: tour.languages.slice(0, MAX_LANGS),
  };
}

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

/** Тип проекта: название + подсказка о длительности на языке интерфейса */
function ProjectChoice({
  label,
  value,
  render,
  hint,
  onChange,
}: {
  label: string;
  value: ProjectKey;
  render: (v: ProjectKey) => string;
  hint: (v: ProjectKey) => string;
  onChange: (v: ProjectKey) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1.5">
      {PROJECT_TYPES.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            className={`flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition ${
              on
                ? "border-amber-200/50 bg-amber-200/10 text-amber-100"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            <span className="text-xs tracking-wide">{render(o)}</span>
            <span className={`text-[10.5px] leading-snug ${on ? "text-amber-100/60" : "text-zinc-500"}`}>{hint(o)}</span>
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
  tours = [],
  toursLoading = false,
  allowNoTour = false,
}: {
  value: BriefValues;
  onChange: (next: BriefValues) => void;
  /** Ключи из briefErrors — показываются под полями, которые не прошли проверку */
  errors?: BriefErrorKey[];
  /** Активные туры каталога — useCatalogTours() */
  tours?: CatalogTour[];
  toursLoading?: boolean;
  /** Правка старого кастинга: можно оставить без тура */
  allowNoTour?: boolean;
}) {
  const { lang } = useLanguage();
  const t = T[lang] ?? T.EN;
  const [applied, setApplied] = useState(false);
  const selectedTour = tours.find((tour) => tour.id === value.catalogTourId) ?? null;
  const ids = {
    tour: useId(),
    city: useId(),
    project: useId(),
    startsOn: useId(),
    endsOn: useId(),
    slots: useId(),
    closesAt: useId(),
    fee: useId(),
    height: useId(),
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

  const pickTour = (id: string) => {
    const tour = tours.find((x) => x.id === id);
    if (!tour) {
      setApplied(false);
      set({ catalogTourId: "" });
      return;
    }
    onChange(applyTourDefaults(value, tour));
    setApplied(true);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={ids.tour}>{t.tour}</Label>
        <select
          id={ids.tour}
          className={`${INPUT} appearance-none`}
          value={value.catalogTourId}
          disabled={toursLoading}
          onChange={(e) => pickTour(e.target.value)}
        >
          <option value="" className="bg-zinc-900">
            {allowNoTour ? t.tourNone : t.tourPick}
          </option>
          {value.catalogTourId && !selectedTour && !toursLoading && (
            <option value={value.catalogTourId} className="bg-zinc-900">
              {t.tourHidden}
            </option>
          )}
          {tours.map((tour) => (
            <option key={tour.id} value={tour.id} className="bg-zinc-900">
              {pickI18n(tour.title, lang, tour.sourceLang) ?? tour.city} · {tour.city}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-zinc-500">{!toursLoading && tours.length === 0 ? t.tourEmpty : t.tourHint}</p>
        {err("tour")}
        {selectedTour && (
          <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.03] p-3.5 text-xs leading-5 text-zinc-300">
            <p className="flex items-center gap-2 text-sm text-amber-100">
              <MapPinned className="size-4 shrink-0" aria-hidden />
              {pickI18n(selectedTour.title, lang, selectedTour.sourceLang) ?? selectedTour.city}
            </p>
            {pickI18n(selectedTour.requirements, lang, selectedTour.sourceLang) && (
              <p className="mt-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t.tourRequirements}: </span>
                {pickI18n(selectedTour.requirements, lang, selectedTour.sourceLang)}
              </p>
            )}
            {pickI18n(selectedTour.conditions, lang, selectedTour.sourceLang) && (
              <p className="mt-1">
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t.tourConditions}: </span>
                {pickI18n(selectedTour.conditions, lang, selectedTour.sourceLang)}
              </p>
            )}
            {applied && <p className="mt-2 text-[11px] text-emerald-300/80">{t.tourApplied}</p>}
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/30 p-4 md:col-span-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-300">{t.texts}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{t.textsHint}</p>
        </div>
        <I18nTextFields
          fields={[
            { key: "title", label: t.title, max: TITLE_MAX, hint: t.titleHint, required: true },
            { key: "brief", label: t.brief, max: BRIEF_MAX, multiline: true, rows: 5, hint: t.briefHint },
          ]}
          values={{ title: value.titleI18n, brief: value.briefI18n }}
          onChange={(next) => set({ titleI18n: next.title ?? {}, briefI18n: next.brief ?? {} })}
          source={value.sourceLang}
          onSourceChange={(sourceLang) => set({ sourceLang })}
          errors={{
            title: errors.includes("title") ? t.errors.title : undefined,
            brief: errors.includes("brief") ? t.errors.brief : undefined,
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={ids.city}>{t.city}</Label>
        <input id={ids.city} className={INPUT} value={value.city} maxLength={60} onChange={(e) => set({ city: e.target.value })} />
        <p className="text-[11px] text-zinc-500">{t.cityHint}</p>
        {err("city")}
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">{t.project}</p>
        <ProjectChoice
          label={t.project}
          value={value.project}
          render={(p) => t.projects[p]}
          hint={(p) => projectHint(p, lang)}
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
        <p className="text-[11px] text-zinc-500">{t.audienceHint}</p>
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

    </div>
  );
}
