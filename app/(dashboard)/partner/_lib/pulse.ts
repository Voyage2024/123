/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Пульс»
 * app/(dashboard)/partner/_lib/pulse.ts
 *
 * Пока демо, собранное из тех же туров, что Манифест, — цифры сходятся
 * со Штабом (23 из 24 долетели, оценка 4,8). При подключении:
 *   manager     partner_manager_stats(me)
 *   months      участницы туров менеджера по месяцам вылета (flown / late_drop + no_show)
 *   criteria    отзывы резиденток о менеджере (partner_reviews, direction resident_to_manager)
 *   feedback    те же отзывы без автора — резидентка не должна бояться оценить
 *   pending     участницы закрытых туров, которым менеджер ещё не поставил оценку
 *               (partner_can_review) — отзыв уходит на модерацию (status pending)
 * ──────────────────────────────────────────────────────────────────── */

import { DAY } from "./clock";
import type { ManagerSnapshot, ProjectKey, Trust } from "./command";
import { buildManifestMock } from "./manifest";

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
  participants: { id: string; name: string; trust: Trust }[];
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

const trust = (flown: number, rating: number | null, reviews: number): Trust => ({
  flown,
  rating,
  reviews,
  trusted: flown >= 3 && reviews >= 3 && (rating ?? 0) >= 4.5,
});

/** Оценки участниц от менеджеров клуба (демо) */
const RATINGS: Record<string, [number | null, number]> = {
  "rs-1039": [4.7, 6],
  "rs-1042": [4.9, 5],
  "rs-1033": [4.8, 4],
  "rs-1044": [4.6, 4],
  "rs-1053": [4.8, 3],
  "rs-1065": [4.5, 3],
  "rs-1045": [4.4, 2],
  "rs-1061": [4.6, 2],
  "rs-1063": [null, 0],
  "rs-1046": [5, 1],
};

export function buildPulseMock(): PulseData {
  const t = Date.now();
  const tours = buildManifestMock().tours;
  const closed = tours.filter((r) => r.status === "closed");

  // 12 месяцев: от месяца год назад до текущего
  const monthStart = (at: number) => {
    const d = new Date(at);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  };
  const current = new Date(t);
  const months: PulseMonth[] = Array.from({ length: 12 }, (_, i) => ({
    start: new Date(current.getFullYear(), current.getMonth() - 11 + i, 1).getTime(),
    flown: 0,
    dropped: 0,
  }));
  for (const r of closed) {
    const m = months.find((x) => x.start === monthStart(r.departsAt));
    if (m && r.outcome) {
      m.flown += r.outcome.flown;
      m.dropped += r.outcome.dropped;
    }
  }

  // участницы закрытых туров: сколько туров с вами и когда последний
  const crewMap = new Map<string, CrewStat>();
  for (const r of closed) {
    for (const c of r.crew) {
      if (!c.id) continue;
      const prev = crewMap.get(c.id);
      const [rating, reviews] = RATINGS[c.id] ?? [null, 0];
      crewMap.set(c.id, {
        id: c.id,
        name: c.name,
        tours: (prev?.tours ?? 0) + 1,
        lastAt: Math.max(prev?.lastAt ?? 0, r.departsAt),
        trust: trust((prev?.tours ?? 0) + 1, rating, reviews),
      });
    }
  }
  const crew = [...crewMap.values()].sort((a, b) => b.tours - a.tours || b.lastAt - a.lastAt).slice(0, 6);
  const crewTrust = (id: string) => crewMap.get(id)?.trust ?? trust(0, null, 0);

  const ist = closed.find((r) => r.id === "tr-ist-01");
  const dxb = closed.find((r) => r.id === "tr-dxb-04");

  return {
    generatedAt: t,
    manager: {
      tier: "gold",
      nextTier: "platinum",
      toursDone: 7,
      toursForNext: 10,
      flown: 23,
      confirmed: 24,
      rating: 4.8,
      reviews: 19,
    },
    months,
    replacements: { closed: 2, total: 2 },
    criteria: [
      { key: "payOnTime", count: 18 },
      { key: "respectful", count: 17 },
      { key: "matchesBrief", count: 16 },
      { key: "organized", count: 14 },
      { key: "communicative", count: 13 },
    ],
    feedback: [
      {
        id: "fb-1", rating: 5, tags: ["payOnTime", "matchesBrief", "organized"],
        quote: "Всё как в брифе, гонорар пришёл в день окончания.",
        city: "Istanbul", project: "campaign", at: t - 14 * DAY,
      },
      {
        id: "fb-2", rating: 5, tags: ["respectful", "communicative"], quote: null,
        city: "Istanbul", project: "campaign", at: t - 15 * DAY,
      },
      {
        id: "fb-3", rating: 4, tags: ["payOnTime", "respectful"],
        quote: "Хорошая организация, но расписание прислали поздно.",
        city: "Dubai", project: "shoot", at: t - 40 * DAY,
      },
      {
        id: "fb-4", rating: 5, tags: ["organized", "matchesBrief"],
        quote: "Трансфер и отель без сюрпризов.",
        city: "Milan", project: "show", at: t - 66 * DAY,
      },
    ],
    pending: [
      ...(ist
        ? [{
            tourId: ist.id, city: ist.city, project: ist.project, returnedAt: ist.returnsAt ?? ist.departsAt,
            participants: [
              { id: "rs-1053", name: "Kate I.", trust: crewTrust("rs-1053") },
              { id: "rs-1033", name: "Sofia L.", trust: crewTrust("rs-1033") },
            ],
          }]
        : []),
      ...(dxb
        ? [{
            tourId: dxb.id, city: dxb.city, project: dxb.project, returnedAt: dxb.returnsAt ?? dxb.departsAt,
            participants: [{ id: "rs-1046", name: "Olga S.", trust: crewTrust("rs-1046") }],
          }]
        : []),
    ],
    crew,
  };
}
