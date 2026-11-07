/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · лист ожидания локации — типы и разбор ответа RPC
 * lib/location-waiting-list.ts
 *
 * RPC public.voyage_location_waiting_list и voyage_location_open_castings
 * (миграция 20261107090000_location_waiting_list.sql).
 * Без серверных импортов: подключается и в server action, и в клиенте.
 * ──────────────────────────────────────────────────────────────────── */

import { CLOTHING_SIZES } from "@/lib/resident-sizes";

export type WaitingStatus = "pending" | "approved";
export type WaitingSort = "newest" | "oldest" | "kyc";

export type WaitingFilters = {
  q?: string;
  hub?: string;
  country?: string;
  region?: string;
  status?: WaitingStatus | "";
  segment?: "working" | "elite" | "";
  kycMin?: number | "";
  heightMin?: number | "";
  heightMax?: number | "";
  ageMin?: number | "";
  ageMax?: number | "";
  clothingSizes?: string[];
  /** YYYY-MM-DD */
  from?: string;
  to?: string;
  subscribed?: "" | "yes" | "no";
  sort?: WaitingSort;
};

export type I18nName = Partial<Record<"RU" | "EN" | "ES" | "PT", string>>;

export type WaitingRow = {
  applicationId: string;
  hubId: string;
  hubName: I18nName;
  region: string | null;
  countryCode: string | null;
  status: WaitingStatus;
  appliedAt: string | null;
  id: string;
  name: string | null;
  telegram: string | null;
  photo: string | null;
  segment: "working" | "elite" | null;
  level: number | null;
  kycLevel: number;
  height: number | null;
  clothingSize: string | null;
  shoeSize: number | null;
  age: number | null;
  languages: string[];
  citizenship: string | null;
  location: string | null;
  reliability: number | null;
  openToTours: boolean;
  eligible: boolean;
  subscribed: boolean;
  toursDone: number;
  lastInvite: { status: string; at: string | null; castingId: string | null } | null;
};

export type WaitingHub = {
  id: string;
  name: I18nName;
  region: string | null;
  countryCode: string | null;
  waiting: number;
};

export type WaitingPage = { total: number; rows: WaitingRow[]; hubs: WaitingHub[] };

export type OpenCasting = {
  id: string;
  city: string | null;
  projectType: string | null;
  startsOn: string | null;
  endsOn: string | null;
  closesAt: string | null;
  status: string;
  title: I18nName;
};

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const i18n = (v: unknown): I18nName => {
  const o = obj(v);
  const out: I18nName = {};
  for (const k of ["RU", "EN", "ES", "PT"] as const) {
    const val = s(o[k]) ?? s(o[k.toLowerCase()]);
    if (val) out[k] = val;
  }
  return out;
};

export function pickName(name: I18nName, lang: string, fallback: string): string {
  const key = String(lang).toUpperCase() as keyof I18nName;
  return name[key] || name.RU || name.EN || Object.values(name).find(Boolean) || fallback;
}

export function parseWaitingPage(raw: unknown): WaitingPage {
  const root = obj(raw);
  const rows = Array.isArray(root.rows) ? root.rows : [];
  const hubs = Array.isArray(root.hubs) ? root.hubs : [];
  return {
    total: n(root.total) ?? 0,
    rows: rows.flatMap((x) => {
      const r = obj(x);
      const id = s(r.id);
      const applicationId = s(r.application_id);
      const hubId = s(r.hub_id);
      if (!id || !applicationId || !hubId) return [];
      const inv = obj(r.last_invite);
      return [{
        applicationId,
        hubId,
        hubName: i18n(r.hub_name),
        region: s(r.region),
        countryCode: s(r.country_code),
        status: r.status === "approved" ? "approved" : "pending",
        appliedAt: s(r.applied_at),
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
        age: n(r.age),
        languages: Array.isArray(r.languages) ? r.languages.filter((l): l is string => typeof l === "string") : [],
        citizenship: s(r.citizenship),
        location: s(r.location),
        reliability: n(r.reliability),
        openToTours: r.open_to_tours === true,
        eligible: r.eligible !== false,
        subscribed: r.subscribed === true,
        toursDone: n(r.tours_done) ?? 0,
        lastInvite: s(inv.status) ? { status: s(inv.status) as string, at: s(inv.at), castingId: s(inv.casting_id) } : null,
      } satisfies WaitingRow];
    }),
    hubs: hubs.flatMap((x) => {
      const h = obj(x);
      const id = s(h.id);
      if (!id) return [];
      return [{ id, name: i18n(h.name), region: s(h.region), countryCode: s(h.country_code), waiting: n(h.waiting) ?? 0 }];
    }),
  };
}

export function parseOpenCastings(raw: unknown): OpenCasting[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows.flatMap((x) => {
    const c = obj(x);
    const id = s(c.id);
    if (!id) return [];
    return [{
      id,
      city: s(c.city),
      projectType: s(c.project_type),
      startsOn: s(c.starts_on),
      endsOn: s(c.ends_on),
      closesAt: s(c.closes_at),
      status: s(c.status) ?? "open",
      title: i18n(c.title_i18n),
    }];
  });
}

const numOrNull = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= min && x <= max ? x : null;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Фильтры клиента → jsonb для RPC (только известные ключи) */
export function waitingFiltersToRpc(f: WaitingFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const q = typeof f.q === "string" ? f.q.trim().slice(0, 80) : "";
  if (q) out.q = q;
  if (typeof f.hub === "string" && f.hub.trim() && f.hub.length <= 120) out.hub = f.hub.trim();
  if (typeof f.country === "string" && /^[A-Za-z]{2}$/.test(f.country)) out.country = f.country.toUpperCase();
  if (typeof f.region === "string" && /^[a-z_-]{1,40}$/i.test(f.region)) out.region = f.region;
  if (f.status === "pending" || f.status === "approved") out.status = f.status;
  if (f.segment === "working" || f.segment === "elite") out.segment = f.segment;
  const kyc = numOrNull(f.kycMin, 0, 3);
  if (kyc !== null) out.kyc_min = Math.round(kyc);
  const hmin = numOrNull(f.heightMin, 120, 230);
  const hmax = numOrNull(f.heightMax, 120, 230);
  if (hmin !== null) out.height_min = hmin;
  if (hmax !== null) out.height_max = hmax;
  const amin = numOrNull(f.ageMin, 16, 99);
  const amax = numOrNull(f.ageMax, 16, 99);
  if (amin !== null) out.age_min = Math.round(amin);
  if (amax !== null) out.age_max = Math.round(amax);
  const sizes = (f.clothingSizes ?? []).filter((x) => (CLOTHING_SIZES as readonly string[]).includes(x));
  if (sizes.length) out.clothing_sizes = sizes;
  if (typeof f.from === "string" && DATE_RE.test(f.from)) out.from = f.from;
  if (typeof f.to === "string" && DATE_RE.test(f.to)) out.to = f.to;
  if (f.subscribed === "yes") out.subscribed = true;
  if (f.subscribed === "no") out.subscribed = false;
  if (f.sort === "oldest" || f.sort === "kyc") out.sort = f.sort;
  return out;
}
