/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — названия городов на языке интерфейса
 * app/(dashboard)/partner/_lib/cities.ts
 *
 * Город приходит так, как его записал менеджер («Dubai», «Дубай»).
 * Известные сводим к ключу и переводим, остальные показываем как есть.
 * ──────────────────────────────────────────────────────────────────── */

import type { Lang } from "@/app/context/LanguageContext";

type CityKey = "dubai" | "sydney" | "milan" | "paris" | "london" | "istanbul";

const ALIASES: Record<string, CityKey> = {
  dubai: "dubai", "дубай": "dubai", "dubái": "dubai",
  sydney: "sydney", "сидней": "sydney", "sídney": "sydney",
  milan: "milan", milano: "milan", "милан": "milan", "milán": "milan", "milão": "milan",
  paris: "paris", "париж": "paris", "parís": "paris",
  london: "london", "лондон": "london", "londres": "london",
  istanbul: "istanbul", "стамбул": "istanbul", "estambul": "istanbul",
};

const NAMES: Record<Lang, Record<CityKey, string>> = {
  EN: { dubai: "Dubai", sydney: "Sydney", milan: "Milan", paris: "Paris", london: "London", istanbul: "Istanbul" },
  RU: { dubai: "Дубай", sydney: "Сидней", milan: "Милан", paris: "Париж", london: "Лондон", istanbul: "Стамбул" },
  ES: { dubai: "Dubái", sydney: "Sídney", milan: "Milán", paris: "París", london: "Londres", istanbul: "Estambul" },
  PT: { dubai: "Dubai", sydney: "Sydney", milan: "Milão", paris: "Paris", london: "Londres", istanbul: "Istambul" },
};

export function cityLabel(raw: string | null | undefined, lang: Lang): string {
  if (!raw) return "—";
  const key = ALIASES[raw.trim().toLowerCase()];
  return key ? (NAMES[lang] ?? NAMES.EN)[key] : raw;
}
