/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Ключи»
 * app/(dashboard)/partner/_lib/keys.ts
 *
 * KEY_RULES повторяют функцию public.partner_manager_stats из миграции
 * 20261011120000_partner_command.sql — меняете пороги там, меняйте и здесь:
 *   Gold      ≥ 3 закрытых тура за всё время и оценка резиденток ≥ 4,5
 *   Platinum  ≥ 10 закрытых туров с вылетом за последние 12 месяцев и ≥ 4,5
 *
 * Данные: RPC public.partner_keys() — тот же расчёт, что в Штабе.
 * ──────────────────────────────────────────────────────────────────── */

import { DAY } from "@/app/(dashboard)/partner/_lib/clock";
import {
  toProjectKey,
  list,
  num,
  obj,
  oneOf,
  parseManager,
  str,
  time,
  type KeyTier,
  type ManagerSnapshot,
  type ProjectKey,
} from "@/app/(dashboard)/partner/_lib/command";

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

/** Разбор public.partner_keys() — миграция 20261020094000_partner_live_pages.sql */
export function parseKeys(raw: unknown): KeysData {
  const root = obj(raw);
  const counted = list<CountedTour>(root.counted, (r) => {
    const id = str(r.id);
    const project = toProjectKey(r.project);
    const departsAt = time(r.departs_at);
    if (!id || !project || departsAt === null) return null;
    return { id, city: str(r.city) ?? "—", project, departsAt, expiresAt: time(r.expires_at) ?? departsAt + YEAR };
  }).sort((a, b) => a.expiresAt - b.expiresAt);
  return {
    generatedAt: time(root.generated_at) ?? Date.now(),
    manager: parseManager(root.manager),
    closedTotal: num(root.closed_total) ?? 0,
    closedYear: num(root.closed_year) ?? counted.length,
    counted,
  };
}
