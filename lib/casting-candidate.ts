/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · анкета кандидатки для менеджера кастинга (типы + разбор)
 * lib/casting-candidate.ts
 *
 * Данные приходят из RPC partner_manager_candidate_profile
 * (миграция 20261127090000). Поля — белый список: контактов, документов,
 * финансов и точной даты рождения в ответе нет и здесь их тоже нет.
 * Без "server-only": тип используется и в клиентском диалоге.
 * ──────────────────────────────────────────────────────────────────── */

export type CandidateTrust = { flown: number; rating: number | null; reviews: number; trusted: boolean };

export type CandidatePhoto = { src: string };
export type CandidateSnap = { src: string; capturedAt: string | null };

export type CandidateProfile = {
  residentId: string;
  code: string;
  name: string;
  response: { status: string; optionExpiresAt: string | null; createdAt: string | null };
  photos: CandidatePhoto[];
  snaps: CandidateSnap[];
  age: number | null;
  height: number | null;
  weight: number | null;
  measurements: string | null;
  clothingSize: string | null;
  shoeSize: number | null;
  smoking: boolean | null;
  alcohol: boolean | null;
  location: string | null;
  about: string | null;
  achievements: string[];
  languages: string[];
  segment: string | null;
  circle: string;
  kycLevel: number;
  minKycLevel: number;
  belowKyc: boolean;
  verifiedAt: string | null;
  openToTours: boolean;
  influenceIndex: number;
  reliability: number;
  trust: CandidateTrust;
};

/** Сырые пути (до подписи) — только на сервере */
export type CandidateProfileRaw = Omit<CandidateProfile, "photos" | "snaps"> & {
  photoPaths: string[];
  snapPaths: { path: string; capturedAt: string | null }[];
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : [];

export function parseCandidateProfile(data: unknown): CandidateProfileRaw | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const residentId = str(d.resident_id);
  if (!residentId) return null;
  const response = (d.response && typeof d.response === "object" ? d.response : {}) as Record<string, unknown>;
  const trust = (d.trust && typeof d.trust === "object" ? d.trust : {}) as Record<string, unknown>;
  const snaps = Array.isArray(d.snaps) ? d.snaps : [];
  return {
    residentId,
    code: str(d.code) ?? "",
    name: str(d.name) ?? "Резидентка",
    response: {
      status: str(response.status) ?? "ready",
      optionExpiresAt: str(response.option_expires_at),
      createdAt: str(response.created_at),
    },
    photoPaths: strList(d.photos),
    snapPaths: snaps
      .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
      .map((s) => ({ path: str(s.path) ?? "", capturedAt: str(s.captured_at) }))
      .filter((s) => s.path),
    age: num(d.age),
    height: num(d.height),
    weight: num(d.weight),
    measurements: str(d.measurements),
    clothingSize: str(d.clothing_size),
    shoeSize: num(d.shoe_size),
    smoking: bool(d.smoking),
    alcohol: bool(d.alcohol),
    location: str(d.location),
    about: str(d.about),
    achievements: strList(d.achievements),
    languages: strList(d.languages),
    segment: str(d.segment),
    circle: str(d.circle) ?? "voyager",
    kycLevel: Math.max(0, Math.min(3, Math.round(num(d.kyc_level) ?? 0))),
    minKycLevel: Math.max(0, Math.min(3, Math.round(num(d.min_kyc_level) ?? 3))),
    belowKyc: d.below_kyc === true,
    verifiedAt: str(d.verified_at),
    openToTours: d.open_to_tours === true,
    influenceIndex: num(d.influence_index) ?? 0,
    reliability: num(d.reliability) ?? 100,
    trust: {
      flown: num(trust.flown) ?? 0,
      rating: num(trust.rating),
      reviews: num(trust.reviews) ?? 0,
      trusted: trust.trusted === true,
    },
  };
}
