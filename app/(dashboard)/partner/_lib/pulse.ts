/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Пульс»
 * app/(dashboard)/partner/_lib/pulse.ts
 *
 * RPC public.partner_pulse() — цифры сходятся со Штабом:
 *   manager     partner_manager_stats(me)
 *   months      участницы туров менеджера по месяцам вылета (flown / late_drop + no_show)
 *   criteria    отзывы резиденток о менеджере (partner_reviews, direction resident_to_manager)
 *   feedback    те же отзывы без автора — резидентка не должна бояться оценить
 *   pending     участницы закрытых туров, которым менеджер ещё не поставил оценку
 *               (partner_can_review) — отзыв уходит на модерацию (status pending)
 * ──────────────────────────────────────────────────────────────────── */

import {
  toProjectKey,
  arr,
  day,
  list,
  num,
  obj,
  oneOf,
  parseManager,
  parseTrust,
  str,
  time,
  type ManagerSnapshot,
  type ProjectKey,
  type ReviewTag,
  type Trust,
} from "@/app/(dashboard)/partner/_lib/command";

/** За что резидентки отмечают менеджера */
export type ManagerCriterion = "payOnTime" | "matchesBrief" | "organized" | "respectful" | "communicative";

export type PulseMonth = { start: number; flown: number; dropped: number };

export type ResidentFeedback = {
  id: string;
  rating: number;
  tags: ManagerCriterion[];
  quote: string | null;
  city: string;
  project: ProjectKey;
  at: number;
};

export type PendingReview = {
  tourId: string;
  city: string;
  project: ProjectKey;
  returnedAt: number;
  /** status: долетела или сорвалась — сорвавшейся тоже можно поставить честную оценку */
  participants: { id: string; name: string; status: "flown" | "late_drop" | "no_show"; trust: Trust }[];
};

export type CrewStat = { id: string; name: string; tours: number; lastAt: number; trust: Trust };

export type PulseData = {
  generatedAt: number;
  manager: ManagerSnapshot;
  months: PulseMonth[];
  /** Срывы, закрытые заменой, из всех срывов за 12 месяцев */
  replacements: { closed: number; total: number };
  criteria: { key: ManagerCriterion; count: number }[];
  feedback: ResidentFeedback[];
  pending: PendingReview[];
  crew: CrewStat[];
};

/** Теги отзыва резидентки о менеджере: в БД → на экране */
export const CRITERION_FROM_DB: Record<string, ManagerCriterion> = {
  paid_on_time: "payOnTime",
  fair_terms: "matchesBrief",
  professional: "organized",
  safe: "respectful",
  communicative: "communicative",
};

/** Теги отзыва менеджера о резидентке: на экране → в БД */
export const REVIEW_TAG_TO_DB: Record<ReviewTag, string> = {
  punctual: "punctual",
  professional: "professional",
  matchesSnaps: "matches_snaps",
  communicative: "communicative",
  teamPlayer: "team_player",
};

const MEMBER_OUTCOMES = ["flown", "late_drop", "no_show"] as const;

/** Разбор public.partner_pulse() — миграция 20261020094000_partner_live_pages.sql */
export function parsePulse(raw: unknown): PulseData {
  const root = obj(raw);
  const months = list<PulseMonth>(root.months, (r) => {
    const start = day(r.start);
    if (start === null) return null;
    return { start, flown: num(r.flown) ?? 0, dropped: num(r.dropped) ?? 0 };
  });
  const rep = obj(root.replacements);
  const criteria = list<{ key: ManagerCriterion; count: number }>(root.criteria, (r) => {
    const key = typeof r.key === "string" ? CRITERION_FROM_DB[r.key] : undefined;
    return key ? { key, count: num(r.count) ?? 0 } : null;
  });
  const feedback = list<ResidentFeedback>(root.feedback, (r) => {
    const id = str(r.id);
    const rating = num(r.rating);
    const at = time(r.at);
    const project = toProjectKey(r.project);
    if (!id || rating === null || at === null || !project) return null;
    return {
      id,
      rating,
      tags: arr(r.tags).flatMap((x) => (typeof x === "string" && CRITERION_FROM_DB[x] ? [CRITERION_FROM_DB[x]] : [])),
      quote: str(r.quote),
      city: str(r.city) ?? "—",
      project,
      at,
    };
  });
  const pending = list<PendingReview>(root.pending, (r) => {
    const tourId = str(r.tour_id);
    const project = toProjectKey(r.project);
    const returnedAt = time(r.returned_at);
    if (!tourId || !project || returnedAt === null) return null;
    const participants = list<PendingReview["participants"][number]>(r.participants, (x) => {
      const id = str(x.id);
      if (!id) return null;
      return { id, name: str(x.name) ?? "—", status: oneOf(x.status, MEMBER_OUTCOMES) ?? "flown", trust: parseTrust(x.trust) };
    });
    return participants.length ? { tourId, city: str(r.city) ?? "—", project, returnedAt, participants } : null;
  });
  const crew = list<CrewStat>(root.crew, (r) => {
    const id = str(r.id);
    if (!id) return null;
    return { id, name: str(r.name) ?? "—", tours: num(r.tours) ?? 0, lastAt: time(r.last_at) ?? 0, trust: parseTrust(r.trust) };
  });
  return {
    generatedAt: time(root.generated_at) ?? Date.now(),
    manager: parseManager(root.manager),
    months,
    replacements: { closed: num(rep.closed) ?? 0, total: num(rep.total) ?? 0 },
    criteria,
    feedback,
    pending,
    crew,
  };
}
