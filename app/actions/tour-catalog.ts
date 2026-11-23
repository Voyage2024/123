"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог статичных туров — серверные методы
 * app/actions/tour-catalog.ts
 *
 *   listCatalogTours()     партнёр/admin/owner: туры + локации карты (map_hubs);
 *                          менеджер получает только туры, на которые назначен
 *                          (и туры своих прежних кастингов) — это решает RLS
 *   listMyCatalogTours()   менеджер: «Мои направления» (RPC voyage_my_catalog_tours)
 *   saveCatalogTour(input) owner/admin: создать или изменить тур;
 *                          назначенный менеджер: изменить условия своего тура
 *                          (без локации, адреса и порядка)
 *   deleteCatalogTour(id)  owner/admin: удалить (у кастингов catalog_tour_id → NULL)
 *
 * Назначения менеджеров и приватная заметка владельца —
 * app/actions/tour-catalog-managers.ts (только owner).
 *
 * Направление тура — только локация из /admin/map-locations (map_hub_id);
 * город/регион ставит база (миграция 20261103100000_tour_catalog_map_hubs.sql).
 * В одной локации может быть несколько туров (миграция 20261124090000).
 *
 * Роль проверяется здесь (requireRole) и ещё раз в базе (RLS tour_catalog,
 * миграция 20261103090000_tour_catalog_casting_i18n_invites.sql).
 * ──────────────────────────────────────────────────────────────────── */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import { isProjectKey } from "@/lib/project-types";
import {
  TITLE_MAX,
  TOUR_DESCRIPTION_MAX,
  TOUR_NOTE_MAX,
  cleanI18n,
  hasI18nText,
  isCastingLang,
  type I18nText,
} from "@/lib/casting-i18n";
import {
  MAP_HUB_COLUMNS,
  TOUR_CATALOG_COLUMNS,
  parseCatalogTour,
  parseMapHub,
  parseMyCatalogTour,
  type MyCatalogTour,
  slugify,
  type CatalogTour,
  type MapHub,
} from "@/lib/tour-catalog";

export type CatalogFailure =
  | "forbidden"
  | "invalid"
  | "slug_taken"
  | "hub_required"
  | "hub_taken"
  | "hub_inactive"
  | "hub_no_country"
  | "schema"
  | "not_found"
  | "not_assigned"
  | "protected"
  | "failed";
/** Кастинг под туром каталога: один тур — много кастингов на разные даты */
export type CatalogTourCasting = {
  id: string;
  tourId: string;
  startsOn: string;
  endsOn: string;
  status: string;
};
export type CatalogListResult =
  | { ok: true; tours: CatalogTour[]; hubs: MapHub[]; castings: CatalogTourCasting[] }
  | { ok: false; reason: CatalogFailure };
export type CatalogSaveResult = { ok: true; tour: CatalogTour } | { ok: false; reason: CatalogFailure; field?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYERS = ["manager", "participant", "split"];
const AUDIENCES = ["all", "working", "elite"];

function failureOf(error: { code?: string; message?: string }): CatalogFailure {
  console.error("[tour_catalog]", error.code, error.message);
  const msg = error.message ?? "";
  if (msg.includes("catalog_field_forbidden")) return "protected";
  if (msg.includes("map_hub_required")) return "hub_required";
  if (msg.includes("map_hub_inactive")) return "hub_inactive";
  if (msg.includes("map_hub_country_required")) return "hub_no_country";
  if (msg.includes("map_hub_not_found") || msg.includes("tour_catalog_map_hub_fkey")) return "hub_required";
  if (error.code === "23505" && msg.includes("map_hub")) return "hub_taken";
  if (error.code === "42501") return "forbidden";
  if (error.code === "23505") return "slug_taken";
  if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST205") return "schema";
  if (error.code === "23514") return "invalid";
  return "failed";
}

export async function listCatalogTours(opts: { includeInactive?: boolean } = {}): Promise<CatalogListResult> {
  try {
    await requireRole(["manager", "admin", "owner"]);
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    throw error;
  }
  const supabase = await createClient();
  let query = supabase.from("tour_catalog").select(TOUR_CATALOG_COLUMNS).order("sort_order").order("city");
  if (!opts.includeInactive) query = query.eq("is_active", true);
  const [{ data, error }, hubsRes, castingsRes] = await Promise.all([
    query,
    supabase.from("map_hubs").select(MAP_HUB_COLUMNS).order("region").order("id"),
    // Кастинги под турами (RLS: менеджер видит свои, owner/admin — все)
    supabase
      .from("partner_castings")
      .select("id,catalog_tour_id,starts_on,ends_on,status")
      .not("catalog_tour_id", "is", null)
      .in("status", ["open", "shortlist"])
      .order("starts_on")
      .limit(500),
  ]);
  if (error) return { ok: false, reason: failureOf(error) };
  if (hubsRes.error) console.error("[map_hubs]", hubsRes.error.code, hubsRes.error.message);
  if (castingsRes.error) console.error("[partner_castings]", castingsRes.error.code, castingsRes.error.message);
  const castings: CatalogTourCasting[] = (castingsRes.data ?? []).flatMap((row) => {
    const r = row as Record<string, unknown>;
    return typeof r.id === "string" && typeof r.catalog_tour_id === "string"
      ? [{ id: r.id, tourId: r.catalog_tour_id, startsOn: String(r.starts_on ?? ""), endsOn: String(r.ends_on ?? ""), status: String(r.status ?? "") }]
      : [];
  });
  return {
    ok: true,
    tours: (data ?? []).flatMap((row) => parseCatalogTour(row) ?? []),
    hubs: (hubsRes.data ?? []).flatMap((row) => parseMapHub(row) ?? []),
    castings,
  };
}

export type MyCatalogListResult = { ok: true; tours: MyCatalogTour[] } | { ok: false; reason: CatalogFailure };

/** «Мои направления» менеджера: активные назначения, соведущие, кастинги по туру. */
export async function listMyCatalogTours(): Promise<MyCatalogListResult> {
  try {
    await requireRole(["manager"]);
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    throw error;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("voyage_my_catalog_tours");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return { ok: false, reason: "schema" };
    return { ok: false, reason: failureOf(error) };
  }
  const rows: unknown[] = Array.isArray(data) ? data : [];
  return { ok: true, tours: rows.flatMap((row) => parseMyCatalogTour(row) ?? []) };
}

export type CatalogTourInput = {
  id?: string | null;
  /** Локация из /admin/map-locations — единственный источник направления */
  mapHubId: string;
  project: string;
  audience: string;
  sourceLang: string;
  title: I18nText;
  description: I18nText;
  requirements: I18nText;
  conditions: I18nText;
  feeAmount?: string | number | null;
  feeCurrency?: string | null;
  flightPaidBy: string;
  hotelPaidBy: string;
  heightMin?: string | number | null;
  languages: string[];
  isActive: boolean;
  sortOrder?: number;
};

const HUB_ID = /^[A-Za-z0-9_-]{1,80}$/;

function toRow(input: CatalogTourInput): { row: Record<string, unknown> } | { field: string } {
  const mapHubId = typeof input.mapHubId === "string" ? input.mapHubId.trim() : "";
  if (!HUB_ID.test(mapHubId)) return { field: "mapHubId" };
  if (!isProjectKey(input.project)) return { field: "project" };
  if (!AUDIENCES.includes(input.audience)) return { field: "audience" };
  if (!isCastingLang(input.sourceLang)) return { field: "sourceLang" };
  const title = cleanI18n(input.title ?? {}, TITLE_MAX);
  if (!hasI18nText(title) || !(title[input.sourceLang] ?? "").trim()) return { field: "title" };
  const feeRaw = input.feeAmount === null || input.feeAmount === undefined ? "" : String(input.feeAmount).trim();
  const fee = feeRaw === "" ? null : Number(feeRaw.replace(",", "."));
  if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return { field: "fee" };
  const currency = (input.feeCurrency ?? "").trim().toUpperCase();
  if (fee !== null && !/^[A-Z]{3}$/.test(currency)) return { field: "fee" };
  if (!PAYERS.includes(input.flightPaidBy) || !PAYERS.includes(input.hotelPaidBy)) return { field: "payer" };
  const heightRaw = input.heightMin === null || input.heightMin === undefined ? "" : String(input.heightMin).trim();
  const height = heightRaw === "" ? null : Number(heightRaw);
  if (height !== null && (!Number.isInteger(height) || height < 140 || height > 230)) return { field: "height" };
  const languages = Array.from(new Set((input.languages ?? []).map((l) => String(l).trim().toUpperCase())));
  if (languages.length > 5 || languages.some((l) => !/^[A-Z]{2}$/.test(l))) return { field: "languages" };
  const sort = Number.isInteger(input.sortOrder) ? Number(input.sortOrder) : 0;

  return {
    row: {
      map_hub_id: mapHubId,
      // city / region ставит триггер tour_catalog_sync_hub из локации; здесь — заглушка для NOT NULL на старой базе
      city: mapHubId,
      project_type: input.project,
      audience_segment: input.audience,
      source_lang: input.sourceLang,
      title_i18n: title,
      description_i18n: cleanI18n(input.description ?? {}, TOUR_DESCRIPTION_MAX),
      requirements_i18n: cleanI18n(input.requirements ?? {}, TOUR_NOTE_MAX),
      conditions_i18n: cleanI18n(input.conditions ?? {}, TOUR_NOTE_MAX),
      fee_amount: fee,
      fee_currency: fee === null ? null : currency,
      flight_paid_by: input.flightPaidBy,
      hotel_paid_by: input.hotelPaidBy,
      height_min: height,
      languages,
      is_active: input.isActive !== false,
      sort_order: sort,
    },
  };
}

/** Поля, которые назначенный менеджер не меняет (база проверит ещё раз: tour_catalog_zz_manager_guard) */
const MANAGER_LOCKED_FIELDS = ["map_hub_id", "city", "sort_order"] as const;

export async function saveCatalogTour(input: CatalogTourInput): Promise<CatalogSaveResult> {
  let role: string;
  try {
    ({ role } = await requireRole(["admin", "owner", "manager"]));
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    throw error;
  }
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid" };
  if (input.id && !UUID_RE.test(input.id)) return { ok: false, reason: "invalid" };
  const built = toRow(input);
  if ("field" in built) return { ok: false, reason: "invalid", field: built.field };

  const supabase = await createClient();

  // Менеджер: только правка тура, на который у него активное назначение.
  // RLS tour_catalog_update и триггер-страж в базе проверяют то же самое.
  if (role === "manager") {
    if (!input.id) return { ok: false, reason: "forbidden" };
    const { data: assigned, error: assignedError } = await supabase.rpc("voyage_catalog_i_manage", { p_tour: input.id });
    if (assignedError) return { ok: false, reason: failureOf(assignedError) };
    if (assigned !== true) return { ok: false, reason: "not_assigned" };
    const row: Record<string, unknown> = { ...built.row };
    for (const key of MANAGER_LOCKED_FIELDS) delete row[key];
    const { data, error } = await supabase.from("tour_catalog").update(row).eq("id", input.id).select(TOUR_CATALOG_COLUMNS);
    if (error) return { ok: false, reason: failureOf(error) };
    const tour = parseCatalogTour(Array.isArray(data) ? data[0] : null);
    if (!tour) return { ok: false, reason: "not_found" };
    revalidatePath("/partner/castings/tours");
    return { ok: true, tour };
  }

  const { data: hub, error: hubError } = await supabase.from("map_hubs").select("id,is_active,country_code").eq("id", built.row.map_hub_id as string).maybeSingle();
  if (hubError) return { ok: false, reason: failureOf(hubError) };
  if (!hub) return { ok: false, reason: "hub_required" };
  if (built.row.is_active && hub.is_active === false) return { ok: false, reason: "hub_inactive" };
  // Локация = страна + город: без страны тур не создаётся и не включается (миграция 20261106090000)
  if (!hub.country_code && (!input.id || built.row.is_active)) return { ok: false, reason: "hub_no_country" };
  // Адрес тура = id локации; в одной локации может быть несколько туров
  // (миграция 20261124090000), поэтому следующий получает суффикс -2, -3 …
  const baseSlug = (slugify(String(built.row.map_hub_id)) || "tour").slice(0, 52).replace(/-+$/g, "");
  const insert = (slug: string) => supabase.from("tour_catalog").insert({ ...built.row, slug }).select(TOUR_CATALOG_COLUMNS);
  let { data, error } = input.id
    ? await supabase.from("tour_catalog").update(built.row).eq("id", input.id).select(TOUR_CATALOG_COLUMNS)
    : await insert(baseSlug);
  for (let n = 2; !input.id && n <= 30 && error?.code === "23505" && (error.message ?? "").includes("slug"); n += 1) {
    ({ data, error } = await insert(`${baseSlug}-${n}`));
  }
  if (!input.id && error?.code === "23505" && (error.message ?? "").includes("slug")) {
    ({ data, error } = await insert(`${baseSlug}-${Date.now().toString(36)}`.slice(0, 60)));
  }
  if (error) return { ok: false, reason: failureOf(error) };
  const tour = parseCatalogTour(Array.isArray(data) ? data[0] : null);
  if (!tour) return { ok: false, reason: input.id ? "not_found" : "failed" };
  revalidatePath("/partner/castings/tours");
  return { ok: true, tour };
}

export async function deleteCatalogTour(id: string): Promise<{ ok: true } | { ok: false; reason: CatalogFailure }> {
  try {
    await requireRole(["admin", "owner"]);
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    throw error;
  }
  if (!UUID_RE.test(id)) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tour_catalog").delete().eq("id", id).select("id");
  if (error) return { ok: false, reason: failureOf(error) };
  if (!data || data.length === 0) return { ok: false, reason: "not_found" };
  revalidatePath("/partner/castings/tours");
  return { ok: true };
}
