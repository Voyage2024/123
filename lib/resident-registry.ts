/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · реестр резиденток для owner/admin — типы и разбор ответа
 * lib/resident-registry.ts
 *
 * Данные — RPC public.voyage_resident_registry (миграция 20261103090000).
 * Без серверных импортов: используется и в server action, и в клиенте.
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Выездной статус:
 *   available — «Открыта к турам» включено и нет пересекающегося тура
 *   busy      — уже в составе тура на эти даты (без кастинга — в туре сейчас)
 *   closed    — «Открыта к турам» выключено
 */
export const REGISTRY_TRAVEL = ["available", "busy", "closed"] as const;
export type TravelStatus = (typeof REGISTRY_TRAVEL)[number];

export type InviteStatus = "invited" | "accepted" | "declined" | "revoked";

export type RegistryFilters = {
  q?: string;
  travel?: TravelStatus | "";
  segment?: "working" | "elite" | "";
  kycMin?: number | "";
  heightMin?: number | "";
  heightMax?: number | "";
  clothingSizes?: string[];
  shoeMin?: number | "";
  shoeMax?: number | "";
  languages?: string[];
  catalogTour?: string;
  notInvited?: boolean;
};

export type RegistryResident = {
  id: string;
  name: string | null;
  telegram: string | null;
  /** Путь в бакете или https — server action подменяет на подписанную ссылку */
  photo: string | null;
  segment: "working" | "elite" | null;
  level: number | null;
  kycLevel: number;
  height: number | null;
  clothingSize: string | null;
  shoeSize: number | null;
  languages: string[];
  citizenship: string | null;
  location: string | null;
  reliability: number | null;
  openToTours: boolean;
  travel: TravelStatus;
  toursDone: number;
  catalogTours: string[];
  inviteStatus: InviteStatus | null;
  responseStatus: string | null;
  lastSeenAt: string | null;
};

export type RegistryPage = {
  total: number;
  casting: { id: string; startsOn: string | null; endsOn: string | null } | null;
  residents: RegistryResident[];
};

export type InviteSummary = {
  invited: string[];
  skipped: { id: string; reason: string }[];
  notified: number;
};

export type CastingInviteRow = {
  residentId: string;
  name: string | null;
  kycLevel: number;
  status: InviteStatus;
  notified: boolean;
  message: string | null;
  invitedAt: string | null;
  respondedAt: string | null;
  responseStatus: string | null;
};

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function parseRegistry(raw: unknown): RegistryPage {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const c = root.casting && typeof root.casting === "object" ? (root.casting as Record<string, unknown>) : null;
  const rows = Array.isArray(root.residents) ? root.residents : [];
  return {
    total: n(root.total) ?? 0,
    casting: c && s(c.id) ? { id: s(c.id) as string, startsOn: s(c.starts_on), endsOn: s(c.ends_on) } : null,
    residents: rows.flatMap((x) => {
      const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const id = s(r.id);
      if (!id) return [];
      const travel = (REGISTRY_TRAVEL as readonly string[]).includes(String(r.travel_status)) ? (r.travel_status as TravelStatus) : "closed";
      const invite = (["invited", "accepted", "declined", "revoked"] as const).find((v) => v === r.invite_status) ?? null;
      return [{
        id,
        name: s(r.name),
        telegram: s(r.telegram),
        photo: s(r.photo),
        segment: r.segment === "elite" ? "elite" : r.segment === "working" ? "working" : null,
        level: n(r.level),
        kycLevel: n(r.kyc_level) ?? 0,
        height: n(r.height),
        clothingSize: s(r.clothing_size),
        shoeSize: n(r.shoe_size),
        languages: strings(r.languages),
        citizenship: s(r.citizenship),
        location: s(r.location),
        reliability: n(r.reliability),
        openToTours: r.open_to_tours === true,
        travel,
        toursDone: n(r.tours_done) ?? 0,
        catalogTours: strings(r.catalog_tours),
        inviteStatus: invite,
        responseStatus: s(r.response_status),
        lastSeenAt: s(r.last_seen_at),
      } satisfies RegistryResident];
    }),
  };
}
