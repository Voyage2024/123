/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог статичных туров (tour_catalog)
 * lib/tour-catalog.ts
 *
 * Статичный тур — постоянное направление клуба (Дубай, Сидней …):
 * базовые условия, описание и требования на RU/EN/ES/PT.
 * Динамичный кастинг — отбор под конкретные даты, ссылается на тур
 * (partner_castings.catalog_tour_id) и берёт из него значения по умолчанию.
 *
 * Направление тура = локация из /admin/map-locations (map_hubs, миграция
 * 20261103100000): город и регион тура база берёт из локации, вручную
 * направление не заводится. В одной локации может быть несколько туров
 * (20261124090000). У тура — несколько назначенных менеджеров
 * (tour_catalog_managers, 20261125090000); приватная заметка владельца
 * хранится отдельно и в эти типы не входит.
 *
 * Без серверных импортов — подключается и в клиенте, и в server actions.
 * ──────────────────────────────────────────────────────────────────── */

import { toProjectKey, type ProjectKey } from "@/lib/project-types";
import { toCastingLang, toI18n, type CastingLang, type I18nText, TITLE_MAX, TOUR_DESCRIPTION_MAX, TOUR_NOTE_MAX } from "@/lib/casting-i18n";

export type TourPayer = "manager" | "participant" | "split";
export type TourAudience = "all" | "working" | "elite";

export type CatalogTour = {
  id: string;
  slug: string;
  /** Локация карты (map_hubs.id); null — старый тур без локации (всегда выключен) */
  mapHubId: string | null;
  city: string;
  countryCode: string | null;
  region: string | null;
  project: ProjectKey;
  audience: TourAudience;
  sourceLang: CastingLang;
  title: I18nText;
  description: I18nText;
  requirements: I18nText;
  conditions: I18nText;
  feeAmount: number | null;
  feeCurrency: string | null;
  flightPaidBy: TourPayer;
  hotelPaidBy: TourPayer;
  heightMin: number | null;
  languages: string[];
  coverUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

export const TOUR_CATALOG_COLUMNS =
  "id,slug,map_hub_id,city,country_code,region,project_type,audience_segment,source_lang,title_i18n,description_i18n,requirements_i18n,conditions_i18n,fee_amount,fee_currency,flight_paid_by,hotel_paid_by,height_min,languages,cover_url,is_active,sort_order,updated_at";

const PAYERS: readonly TourPayer[] = ["manager", "participant", "split"];
const AUDIENCES: readonly TourAudience[] = ["all", "working", "elite"];

const s = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};

export function parseCatalogTour(raw: unknown): CatalogTour | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id);
  const slug = s(r.slug);
  const city = s(r.city);
  if (!id || !slug || !city) return null;
  return {
    id,
    slug,
    mapHubId: s(r.map_hub_id),
    city,
    countryCode: s(r.country_code),
    region: s(r.region),
    project: toProjectKey(r.project_type) ?? "tour",
    audience: AUDIENCES.includes(r.audience_segment as TourAudience) ? (r.audience_segment as TourAudience) : "all",
    sourceLang: toCastingLang(r.source_lang),
    title: toI18n(r.title_i18n, TITLE_MAX),
    description: toI18n(r.description_i18n, TOUR_DESCRIPTION_MAX),
    requirements: toI18n(r.requirements_i18n, TOUR_NOTE_MAX),
    conditions: toI18n(r.conditions_i18n, TOUR_NOTE_MAX),
    feeAmount: n(r.fee_amount),
    feeCurrency: s(r.fee_currency),
    flightPaidBy: PAYERS.includes(r.flight_paid_by as TourPayer) ? (r.flight_paid_by as TourPayer) : "manager",
    hotelPaidBy: PAYERS.includes(r.hotel_paid_by as TourPayer) ? (r.hotel_paid_by as TourPayer) : "manager",
    heightMin: n(r.height_min),
    languages: Array.isArray(r.languages) ? r.languages.filter((x): x is string => typeof x === "string") : [],
    coverUrl: s(r.cover_url),
    isActive: r.is_active !== false,
    sortOrder: n(r.sort_order) ?? 0,
    updatedAt: s(r.updated_at),
  };
}

/** Короткая сводка тура, которую отдают RPC лент (voyage_catalog_tour_brief) */
export type CatalogTourBrief = {
  id: string;
  slug: string;
  city: string;
  countryCode: string | null;
  title: I18nText;
  requirements: I18nText;
  conditions: I18nText;
};

export function parseCatalogTourBrief(raw: unknown): CatalogTourBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id);
  if (!id) return null;
  return {
    id,
    slug: s(r.slug) ?? "",
    city: s(r.city) ?? "",
    countryCode: s(r.country_code),
    title: toI18n(r.title_i18n, TITLE_MAX),
    requirements: toI18n(r.requirements_i18n, TOUR_NOTE_MAX),
    conditions: toI18n(r.conditions_i18n, TOUR_NOTE_MAX),
  };
}

/* ── Локации карты (map_hubs) ───────────────────────────────────────── */

export type MapHub = {
  id: string;
  name: I18nText;
  region: string | null;
  /** ISO-3166 alpha-2 (map_hubs.country_code, миграция 20261106090000); null — страна не задана, тур не создать */
  countryCode: string | null;
  isActive: boolean;
};

export const MAP_HUB_COLUMNS = "id,name,region,country_code,is_active";

export const MAP_HUB_REGIONS: Record<string, string> = {
  mena: "MENA",
  europe: "Europe",
  americas: "Americas",
  apac: "APAC",
};

export function parseMapHub(raw: unknown): MapHub | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id);
  if (!id) return null;
  const cc = s(r.country_code)?.toUpperCase() ?? null;
  return {
    id,
    name: toI18n(r.name, 60),
    region: s(r.region),
    countryCode: cc && /^[A-Z]{2}$/.test(cc) ? cc : null,
    isActive: r.is_active !== false,
  };
}

/** Название локации на языке интерфейса (как на карте) → EN → RU → id */
export function mapHubName(hub: Pick<MapHub, "id" | "name">, lang: string): string {
  const key = lang.toUpperCase() as keyof I18nText;
  return (hub.name[key] ?? hub.name.EN ?? hub.name.RU ?? hub.name.ES ?? hub.name.PT ?? hub.id).trim() || hub.id;
}

/** «Dubai» → «dubai», «São Paulo Fashion» → «sao-paulo-fashion» */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/* ── Менеджеры туров (миграция 20261125090000_tour_catalog_managers.sql) ── */

/** Назначение менеджера на тур каталога (история: активные и отозванные) */
export type CatalogAssignment = {
  id: string;
  tourId: string | null;
  tourLabel: string;
  managerId: string | null;
  managerName: string;
  managerIsSystem: boolean;
  /** Менеджер сейчас действующий (роль manager, одобрен, без бана) */
  managerEligible: boolean;
  assignedByName: string | null;
  assignedAt: string;
  note: string | null;
  source: "owner" | "backfill";
  isActive: boolean;
  revokedAt: string | null;
  revokedByName: string | null;
  revokeReason: string | null;
};

export function parseCatalogAssignment(raw: unknown): CatalogAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id);
  if (!id) return null;
  return {
    id,
    tourId: s(r.catalog_tour_id),
    tourLabel: s(r.tour_label) ?? "",
    managerId: s(r.manager_id),
    managerName: s(r.manager_name) ?? "—",
    managerIsSystem: r.manager_is_system === true,
    managerEligible: r.manager_eligible === true,
    assignedByName: s(r.assigned_by_name),
    assignedAt: s(r.assigned_at) ?? "",
    note: s(r.assign_note),
    source: r.source === "backfill" ? "backfill" : "owner",
    isActive: r.is_active === true,
    revokedAt: s(r.revoked_at),
    revokedByName: s(r.revoked_by_name),
    revokeReason: s(r.revoke_reason),
  };
}

/** Кандидат в менеджеры тура (поиск владельца) */
export type ManagerCandidate = {
  id: string;
  name: string;
  agency: string | null;
  telegram: string | null;
  isSystem: boolean;
};

export function parseManagerCandidate(raw: unknown): ManagerCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = s(r.id);
  if (!id) return null;
  return { id, name: s(r.name) ?? "—", agency: s(r.agency), telegram: s(r.telegram), isSystem: r.is_system === true };
}

/** Кастинг в карточке «Мои направления»: чужой — только даты и статус */
export type DirectionCasting = {
  id: string;
  startsOn: string;
  endsOn: string;
  status: string;
  slots: number;
  closesAt: string | null;
  isMine: boolean;
  organizer: string;
};

/** Тур из «Мои направления» (RPC voyage_my_catalog_tours) */
export type MyCatalogTour = CatalogTour & {
  assignedAt: string | null;
  coManagers: { name: string; isSystem: boolean; isMe: boolean; assignedAt: string | null }[];
  castings: DirectionCasting[];
};

export function parseMyCatalogTour(raw: unknown): MyCatalogTour | null {
  const tour = parseCatalogTour(raw);
  if (!tour || !raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const list = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object") : [];
  return {
    ...tour,
    assignedAt: s(r.assigned_at),
    coManagers: list(r.co_managers).map((m) => ({
      name: s(m.name) ?? "—",
      isSystem: m.is_system === true,
      isMe: m.is_me === true,
      assignedAt: s(m.assigned_at),
    })),
    castings: list(r.castings).flatMap((c) => {
      const id = s(c.id);
      return id
        ? [{
            id,
            startsOn: s(c.starts_on) ?? "",
            endsOn: s(c.ends_on) ?? "",
            status: s(c.status) ?? "",
            slots: n(c.slots) ?? 0,
            closesAt: s(c.closes_at),
            isMine: c.is_mine === true,
            organizer: s(c.organizer) ?? "—",
          }]
        : [];
    }),
  };
}

/** Запись истории тура (audit_logs, action tour_catalog.*) */
export type TourHistoryEntry = {
  id: string;
  at: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  changes: Record<string, { old: unknown; new: unknown }>;
  metadata: Record<string, unknown>;
};

export function parseTourHistoryEntry(raw: unknown): TourHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = r.id === undefined || r.id === null ? null : String(r.id);
  const action = s(r.action);
  if (!id || !action) return null;
  const metadata = r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {};
  const changes = metadata.changes && typeof metadata.changes === "object" ? (metadata.changes as Record<string, { old: unknown; new: unknown }>) : {};
  return { id, at: s(r.at) ?? "", action, actorName: s(r.actor_name), actorRole: s(r.actor_role), changes, metadata };
}
