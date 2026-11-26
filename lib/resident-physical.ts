/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Физические параметры резидентки: рост, вес, объёмы
 *
 * Единые правила для анкеты (клиент) и серверного действия
 * app/actions/resident-physical.ts. Файл без серверных импортов.
 *
 * В БД (без изменений схемы):
 *   profiles.height       numeric  — сантиметры
 *   profiles.weight       numeric  — килограммы
 *   profiles.measurements text     — «грудь / талия / бёдра», напр. "90 / 62 / 93"
 * Единицы (см / кг) в БД не пишутся.
 * ──────────────────────────────────────────────────────────────────── */

export type PhysicalField = "height" | "weight" | "measurements";

export const HEIGHT_MIN = 120;
export const HEIGHT_MAX = 230;
export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 200;
export const MEASUREMENTS_MAX_LENGTH = 40;

/** Число из инпута: "180", "180,5", " 52 кг " → 180 / 180.5 / 52. Пусто → null. Мусор → NaN. */
function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.trim().replace(/\s*(см|cm|кг|kg)\.?$/i, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d{1,3}(\.\d)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

type Normalized<T> = { ok: true; value: T | null } | { ok: false };

/** Рост в см, 120–230, шаг 0.1. Пустое значение = очистить поле. */
export function normalizeHeight(value: unknown): Normalized<number> {
  const n = parseNumber(value);
  if (n === null) return { ok: true, value: null };
  if (Number.isNaN(n) || n < HEIGHT_MIN || n > HEIGHT_MAX) return { ok: false };
  return { ok: true, value: n };
}

/** Вес в кг, 30–200, шаг 0.1. Пустое значение = очистить поле. */
export function normalizeWeight(value: unknown): Normalized<number> {
  const n = parseNumber(value);
  if (n === null) return { ok: true, value: null };
  if (Number.isNaN(n) || n < WEIGHT_MIN || n > WEIGHT_MAX) return { ok: false };
  return { ok: true, value: n };
}

/**
 * Объёмы — свободный текст, как и раньше ("90 / 62 / 93", "90-60-90").
 * Только цифры, пробелы и разделители / - x × , . ; до 40 символов.
 */
export function normalizeMeasurements(value: unknown): Normalized<string> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > MEASUREMENTS_MAX_LENGTH) return { ok: false };
  if (!/^[0-9\s/\-x×,.;]+$/i.test(trimmed) || !/\d/.test(trimmed)) return { ok: false };
  return { ok: true, value: trimmed };
}

/** numeric из БД приходит строкой "180" / "180.0" / "52.5" → "180" / "52.5" */
export function formatPhysicalNumber(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(n)) return null;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

type PhysicalLang = "EN" | "RU" | "ES" | "PT";

export const PHYSICAL_COPY: Record<PhysicalLang, { invalid: string; saveError: string }> = {
  RU: {
    invalid: `Проверьте значение: рост ${HEIGHT_MIN}–${HEIGHT_MAX} см, вес ${WEIGHT_MIN}–${WEIGHT_MAX} кг, объёмы цифрами, например 90 / 60 / 90.`,
    saveError: "Не удалось сохранить параметры. Попробуйте ещё раз.",
  },
  EN: {
    invalid: `Please check the value: height ${HEIGHT_MIN}–${HEIGHT_MAX} cm, weight ${WEIGHT_MIN}–${WEIGHT_MAX} kg, measurements as numbers, e.g. 90 / 60 / 90.`,
    saveError: "Could not save your measurements. Please try again.",
  },
  ES: {
    invalid: `Revisa el valor: altura ${HEIGHT_MIN}–${HEIGHT_MAX} cm, peso ${WEIGHT_MIN}–${WEIGHT_MAX} kg, medidas en números, p. ej. 90 / 60 / 90.`,
    saveError: "No se pudieron guardar los parámetros. Inténtalo de nuevo.",
  },
  PT: {
    invalid: `Verifique o valor: altura ${HEIGHT_MIN}–${HEIGHT_MAX} cm, peso ${WEIGHT_MIN}–${WEIGHT_MAX} kg, medidas em números, ex. 90 / 60 / 90.`,
    saveError: "Não foi possível salvar os parâmetros. Tente novamente.",
  },
};
