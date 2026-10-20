/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — данные страницы «Манифест»
 * app/(dashboard)/partner/_lib/manifest.ts
 *
 * RPC public.partner_manifest(): туры менеджера (partner_tours,
 * manager_id = me) с составом, документами и печатью контракта —
 * те же поля, что FlightItem в Штабе, плюс статус тура и итог.
 * ──────────────────────────────────────────────────────────────────── */

import {
  PROJECTS,
  list,
  num,
  obj,
  oneOf,
  parseContract,
  parseCrewMember,
  str,
  time,
  type Contract,
  type CrewMember,
  type FlightStatus,
  type ProjectKey,
} from "./command";

/** Статус тура в базе (partner_tours.status) */
export type TourStatus = "confirmed" | "in_tour" | "closed" | "cancelled";

export type TourRow = {
  id: string;
  city: string;
  iata: string | null;
  /** ISO-код страны тура — для начисления баллов при закрытии */
  countryCode: string | null;
  project: ProjectKey;
  flightNo: string | null;
  departsAt: number;
  returnsAt: number | null;
  status: TourStatus;
  /** Готовность подтверждённого тура: подписи, документы, замена. Для остальных — null */
  readiness: FlightStatus | null;
  crew: (CrewMember & { status?: "confirmed" | "flown" | "late_drop" | "no_show" })[];
  replacement: string | null;
  replacementId: string | null;
  contract: Contract | null;
  /** Закрытый тур: сколько участниц долетели и сколько сорвались */
  outcome: { flown: number; dropped: number } | null;
};

export type ManifestData = { generatedAt: number; tours: TourRow[] };

const TOUR_STATUSES = ["confirmed", "in_tour", "closed", "cancelled"] as const;
const READINESS = ["confirmed", "contract", "docs", "replacement"] as const;
const MEMBER_STATUSES = ["confirmed", "flown", "late_drop", "no_show"] as const;

/** Разбор public.partner_manifest() — миграция 20261020094000_partner_live_pages.sql */
export function parseManifest(raw: unknown): ManifestData {
  const root = obj(raw);
  const tours = list<TourRow>(root.tours, (r) => {
    const id = str(r.id);
    const project = oneOf(r.project, PROJECTS);
    const departsAt = time(r.departs_at);
    if (!id || !project || departsAt === null) return null;
    const outcome = obj(r.outcome);
    return {
      id,
      city: str(r.city) ?? "—",
      iata: str(r.iata),
      countryCode: str(r.country_code),
      project,
      flightNo: str(r.flight_no),
      departsAt,
      returnsAt: time(r.returns_at),
      status: oneOf(r.status, TOUR_STATUSES) ?? "confirmed",
      readiness: oneOf(r.readiness, READINESS),
      crew: list<CrewMember>(r.crew, (x) => ({ ...parseCrewMember(x), status: oneOf(x.status, MEMBER_STATUSES) ?? undefined })),
      replacement: str(r.replacement),
      replacementId: str(r.replacement_id),
      contract: parseContract(r.contract),
      outcome: r.outcome ? { flown: num(outcome.flown) ?? 0, dropped: num(outcome.dropped) ?? 0 } : null,
    };
  });
  return { generatedAt: time(root.generated_at) ?? Date.now(), tours };
}
