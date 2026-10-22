/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · PARTNER — база резиденток и карточка резидентки
 * app/(dashboard)/partner/_lib/residents.ts
 *
 * RPC public.partner_residents_list() и public.partner_resident_card(uuid)
 * (миграция 20261022090000). Слепой отбор: имя и фото приходят только
 * после рукопожатия с этим организатором, у owner/admin — всегда.
 * ──────────────────────────────────────────────────────────────────── */

import { arr, list, num, obj, parseTrust, str, time, type Trust } from "@/app/(dashboard)/partner/_lib/command";

export type ResidentRow = {
  id: string;
  code: string;
  revealed: boolean;
  name: string | null;
  height: number | null;
  languages: string[];
  segment: string | null;
  openToTours: boolean;
  verifiedAt: number | null;
  workedWithMe: boolean;
  trust: Trust;
};

export type ResidentsData = { generatedAt: number; residents: ResidentRow[] };

export type ResidentTour = {
  tourId: string;
  city: string | null;
  project: string | null;
  departsAt: number | null;
  tourStatus: string | null;
  memberStatus: string | null;
};

export type ResidentCard = Omit<ResidentRow, "workedWithMe"> & {
  photo: string | null;
  kycLevel: number;
  circle: string | null;
  reliability: number | null;
  blacklisted: boolean;
  tours: ResidentTour[];
};

const strings = (v: unknown) => arr(v).flatMap((x) => (typeof x === "string" && x ? [x] : []));

function parseRow(r: Record<string, unknown>): ResidentRow | null {
  const id = str(r.id);
  if (!id) return null;
  return {
    id,
    code: str(r.code) ?? "—",
    revealed: r.revealed === true,
    name: str(r.name),
    height: num(r.height),
    languages: strings(r.languages),
    segment: str(r.segment),
    openToTours: r.open_to_tours === true,
    verifiedAt: time(r.verified_at),
    workedWithMe: r.worked_with_me === true,
    trust: parseTrust(r.trust),
  };
}

export function parseResidents(raw: unknown): ResidentsData {
  const r = obj(raw);
  return { generatedAt: time(r.generated_at) ?? Date.now(), residents: list(r.residents, parseRow) };
}

export function parseResidentCard(raw: unknown): ResidentCard {
  const r = obj(raw);
  const row = parseRow(r);
  if (!row) throw new Error("voyage:resident_not_found");
  const { workedWithMe: _skip, ...base } = row;
  void _skip;
  return {
    ...base,
    photo: str(r.photo),
    kycLevel: num(r.kyc_level) ?? 0,
    circle: str(r.circle),
    reliability: num(r.reliability),
    blacklisted: r.blacklisted === true,
    tours: list(r.tours, (t) => {
      const tourId = str(t.tour_id);
      return tourId
        ? {
            tourId,
            city: str(t.city),
            project: str(t.project),
            departsAt: time(t.departs_at),
            tourStatus: str(t.tour_status),
            memberStatus: str(t.member_status),
          }
        : null;
    }),
  };
}
