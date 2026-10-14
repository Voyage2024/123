/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Ключи»
 * app/(dashboard)/partner/_lib/keys.ts
 *
 * KEY_RULES повторяют функцию public.partner_manager_stats из миграции
 * 20261011120000_partner_command.sql — меняете пороги там, меняйте и здесь:
 *   Gold      ≥ 3 закрытых тура за всё время и оценка резиденток ≥ 4,5
 *   Platinum  ≥ 10 закрытых туров с вылетом за последние 12 месяцев и ≥ 4,5
 *
 * Демо собрано из тех же туров, что Манифест: 7 туров в зачёте, 9 всего.
 * ──────────────────────────────────────────────────────────────────── */

import { DAY } from "./clock";
import type { KeyTier, ManagerSnapshot, ProjectKey } from "./command";
import { buildManifestMock } from "./manifest";

export type TierRule = {
  tier: KeyTier;
  /** Сколько закрытых туров нужно; null — порога нет */
  tours: number | null;
  /** Окно подсчёта туров: за всё время или за 12 месяцев */
  window: "total" | "year" | null;
  /** Минимальная оценка резиденток; null — не нужна */
  rating: number | null;
};

export const KEY_RULES: TierRule[] = [
  { tier: "silver", tours: null, window: null, rating: null },
  { tier: "gold", tours: 3, window: "total", rating: 4.5 },
  { tier: "platinum", tours: 10, window: "year", rating: 4.5 },
];

/** Тур в зачёте Platinum: считается 12 месяцев с даты вылета */
export type CountedTour = { id: string; city: string; project: ProjectKey; departsAt: number; expiresAt: number };

export type KeysData = {
  generatedAt: number;
  manager: ManagerSnapshot;
  closedTotal: number;
  closedYear: number;
  counted: CountedTour[];
};

export const YEAR = 365 * DAY;

export function buildKeysMock(): KeysData {
  const t = Date.now();
  const closed = buildManifestMock().tours.filter((r) => r.status === "closed");
  const counted = closed
    .filter((r) => r.departsAt > t - YEAR)
    .map((r) => ({ id: r.id, city: r.city, project: r.project, departsAt: r.departsAt, expiresAt: r.departsAt + YEAR }))
    .sort((a, b) => a.expiresAt - b.expiresAt);

  return {
    generatedAt: t,
    manager: {
      tier: "gold",
      nextTier: "platinum",
      toursDone: counted.length,
      toursForNext: 10,
      flown: 23,
      confirmed: 24,
      rating: 4.8,
      reviews: 19,
    },
    closedTotal: closed.length,
    closedYear: counted.length,
    counted,
  };
}
