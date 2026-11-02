/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Размеры резидентки (одежда + обувь)
 *
 * Единый источник для анкеты, админки, PDF и серверной валидации.
 * В БД: profiles.clothing_size (text) и profiles.shoe_size (numeric 3,1),
 * см. supabase/migrations/20261102100000_resident_sizes_dossier_audit.sql.
 *
 * Колонки в БД nullable (старые профили не ломаются), а обязательность
 * держит анкета: напоминание до заполнения + сервер не даёт стереть
 * уже указанный размер.
 * Файл без серверных импортов — его можно подключать и в клиенте.
 * ──────────────────────────────────────────────────────────────────── */

export const CLOTHING_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"] as const;
export type ClothingSize = (typeof CLOTHING_SIZES)[number];

/** Европейская сетка обуви, шаг 0.5 */
export const SHOE_SIZE_MIN = 33;
export const SHOE_SIZE_MAX = 46;
export const SHOE_SIZE_OPTIONS: number[] = Array.from(
  { length: (SHOE_SIZE_MAX - SHOE_SIZE_MIN) * 2 + 1 },
  (_, i) => SHOE_SIZE_MIN + i / 2,
);

export function normalizeClothingSize(value: unknown): ClothingSize | null {
  if (typeof value !== "string") return null;
  const upper = value.trim().toUpperCase().replace(/\s+/g, "");
  return (CLOTHING_SIZES as readonly string[]).includes(upper) ? (upper as ClothingSize) : null;
}

/** "38", "38,5", 38.5, "38.5 EU" → 38.5; всё вне сетки → null */
export function normalizeShoeSize(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") n = Number(value.trim().replace(/\s*eu$/i, "").replace(",", "."));
  else return null;
  if (!Number.isFinite(n)) return null;
  if (n < SHOE_SIZE_MIN || n > SHOE_SIZE_MAX) return null;
  if (Math.round(n * 2) !== n * 2) return null;
  return n;
}

/** 38 → "38", 38.5 → "38.5" (БД отдаёт numeric строкой "38.0") */
export function formatShoeSize(value: unknown): string | null {
  const n = normalizeShoeSize(value);
  if (n === null) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export type SizeField = "clothing_size" | "shoe_size";

export function missingSizes(profile: { clothing_size?: unknown; shoe_size?: unknown } | null | undefined): SizeField[] {
  const missing: SizeField[] = [];
  if (!normalizeClothingSize(profile?.clothing_size)) missing.push("clothing_size");
  if (normalizeShoeSize(profile?.shoe_size) === null) missing.push("shoe_size");
  return missing;
}

export type SizeLang = "EN" | "RU" | "ES" | "PT";

export const SIZE_COPY: Record<SizeLang, {
  clothing: string;
  shoe: string;
  shoeUnit: string;
  choose: string;
  required: string;
  requiredHint: string;
  saveError: string;
}> = {
  RU: {
    clothing: "Размер одежды",
    shoe: "Размер обуви",
    shoeUnit: "EU",
    choose: "Выбрать",
    required: "Обязательно",
    requiredHint: "Укажите размер одежды и обуви — без них анкета считается неполной, а клуб не сможет подобрать образ к туру.",
    saveError: "Не удалось сохранить размер. Попробуйте ещё раз.",
  },
  EN: {
    clothing: "Clothing size",
    shoe: "Shoe size",
    shoeUnit: "EU",
    choose: "Select",
    required: "Required",
    requiredHint: "Add your clothing and shoe size — the profile is incomplete without them and the club can't prepare looks for tours.",
    saveError: "Could not save the size. Please try again.",
  },
  ES: {
    clothing: "Talla de ropa",
    shoe: "Talla de calzado",
    shoeUnit: "EU",
    choose: "Elegir",
    required: "Obligatorio",
    requiredHint: "Indica tu talla de ropa y de calzado: sin ellas el perfil está incompleto y el club no puede preparar los looks del tour.",
    saveError: "No se pudo guardar la talla. Inténtalo de nuevo.",
  },
  PT: {
    clothing: "Tamanho de roupa",
    shoe: "Tamanho de calçado",
    shoeUnit: "EU",
    choose: "Escolher",
    required: "Obrigatório",
    requiredHint: "Informe o tamanho de roupa e de calçado — sem eles o perfil fica incompleto e o clube não consegue preparar os looks do tour.",
    saveError: "Não foi possível salvar o tamanho. Tente novamente.",
  },
};
