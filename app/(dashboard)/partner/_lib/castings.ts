/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Кастинги»
 * app/(dashboard)/partner/_lib/castings.ts
 *
 * RPC public.partner_castings_list(): кастинги менеджера (manager_id = me;
 * админ и владелец видят все) и слепые ответы — как в partner_command():
 * код вместо имени, пока нет рукопожатия, без контактов.
 * ──────────────────────────────────────────────────────────────────── */

import {
  PAYERS,
  PROJECTS,
  arr,
  day,
  list,
  num,
  obj,
  oneOf,
  parseResponder,
  str,
  time,
  type Payer,
  type ProjectKey,
  type Responder,
} from "@/app/(dashboard)/partner/_lib/command";

export type CastingStage = "open" | "shortlist" | "closed" | "cancelled";

export type CastingBrief = {
  id: string;
  city: string;
  project: ProjectKey;
  startsAt: number;
  endsAt: number;
  slots: number;
  /** Новых «Готова» с последнего просмотра */
  fresh: number;
  closesAt: number;
  stage: CastingStage;
  /** Гонорар участницы; null — «по договорённости» */
  fee: { amount: number; currency: string } | null;
  flightPaidBy: Payer;
  hotelPaidBy: Payer;
  heightMin: number | null;
  /** Языки, ISO 639-1 */
  languages: string[];
  /** Текст брифа — как его написал менеджер */
  note: string | null;
  responders: Responder[];
  /** Закрытый кастинг → тур, который из него родился */
  tourId: string | null;
};

export type CastingsData = { generatedAt: number; castings: CastingBrief[] };

const STAGES = ["open", "shortlist", "closed", "cancelled"] as const;

/** Разбор public.partner_castings_list() — миграция 20261020094000_partner_live_pages.sql */
export function parseCastings(raw: unknown): CastingsData {
  const root = obj(raw);
  const castings = list<CastingBrief>(root.castings, (r) => {
    const id = str(r.id);
    const project = oneOf(r.project, PROJECTS);
    const startsAt = day(r.starts_on);
    const endsAt = day(r.ends_on);
    const closesAt = time(r.closes_at);
    if (!id || !project || startsAt === null || endsAt === null || closesAt === null) return null;
    const amount = num(r.fee_amount);
    const currency = str(r.fee_currency);
    return {
      id,
      city: str(r.city) ?? "—",
      project,
      startsAt,
      endsAt,
      slots: num(r.slots) ?? 1,
      fresh: num(r.fresh) ?? 0,
      closesAt,
      stage: oneOf(r.stage, STAGES) ?? "open",
      fee: amount !== null && currency ? { amount, currency } : null,
      flightPaidBy: oneOf(r.flight_paid_by, PAYERS) ?? "manager",
      hotelPaidBy: oneOf(r.hotel_paid_by, PAYERS) ?? "manager",
      heightMin: num(r.height_min),
      languages: arr(r.languages).flatMap((x) => (typeof x === "string" ? [x] : [])),
      note: str(r.brief),
      responders: list<Responder>(r.responders, parseResponder),
      tourId: str(r.tour_id),
    };
  });
  return { generatedAt: time(root.generated_at) ?? Date.now(), castings };
}
