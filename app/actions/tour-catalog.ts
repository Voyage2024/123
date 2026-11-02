"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · каталог статичных туров — серверные методы
 * app/actions/tour-catalog.ts
 *
 *   listCatalogTours()     партнёр/admin/owner: активные туры (staff видит и скрытые)
 *   saveCatalogTour(input) owner/admin: создать или изменить тур
 *   deleteCatalogTour(id)  owner/admin: удалить (у кастингов catalog_tour_id → NULL)
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
import { TOUR_CATALOG_COLUMNS, parseCatalogTour, slugify, type CatalogTour } from "@/lib/tour-catalog";

export type CatalogFailure = "forbidden" | "invalid" | "slug_taken" | "schema" | "not_found" | "failed";
export type CatalogListResult = { ok: true; tours: CatalogTour[] } | { ok: false; reason: CatalogFailure };
export type CatalogSaveResult = { ok: true; tour: CatalogTour } | { ok: false; reason: CatalogFailure; field?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYERS = ["manager", "participant", "split"];
const AUDIENCES = ["all", "working", "elite"];

function failureOf(error: { code?: string; message?: string }): CatalogFailure {
  console.error("[tour_catalog]", error.code, error.message);
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
  const { data, error } = await query;
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true, tours: (data ?? []).flatMap((row) => parseCatalogTour(row) ?? []) };
}

export type CatalogTourInput = {
  id?: string | null;
  slug?: string;
  city: string;
  countryCode?: string | null;
  region?: string | null;
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

function toRow(input: CatalogTourInput): { row: Record<string, unknown> } | { field: string } {
  const city = (input.city ?? "").trim();
  if (city.length < 2 || city.length > 60) return { field: "city" };
  const slug = slugify(input.slug?.trim() || city);
  if (!slug) return { field: "slug" };
  const country = (input.countryCode ?? "").trim().toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) return { field: "countryCode" };
  const region = (input.region ?? "").trim();
  if (region.length > 60) return { field: "region" };
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
      slug,
      city,
      country_code: country || null,
      region: region || null,
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

export async function saveCatalogTour(input: CatalogTourInput): Promise<CatalogSaveResult> {
  try {
    await requireRole(["admin", "owner"]);
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    throw error;
  }
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid" };
  if (input.id && !UUID_RE.test(input.id)) return { ok: false, reason: "invalid" };
  const built = toRow(input);
  if ("field" in built) return { ok: false, reason: "invalid", field: built.field };

  const supabase = await createClient();
  const query = input.id
    ? supabase.from("tour_catalog").update(built.row).eq("id", input.id).select(TOUR_CATALOG_COLUMNS)
    : supabase.from("tour_catalog").insert(built.row).select(TOUR_CATALOG_COLUMNS);
  const { data, error } = await query;
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
