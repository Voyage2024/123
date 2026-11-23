"use server";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · туры каталога — менеджеры, приватная заметка, история (owner)
 * app/actions/tour-catalog-managers.ts
 *
 *   searchCatalogManagers(q)          кандидаты: действующие менеджеры + VOYAGE Management
 *   listCatalogAssignments(tourId?)   назначения тура (или всех туров), включая отозванные
 *   assignCatalogManager(t, m, note)  назначить менеджера на тур
 *   revokeCatalogManager(a, r, to)    отозвать; to — кому передать открытые кастинги без поездки
 *   transferCatalogCasting(c, to)     передать один кастинг (без поездки) другому ответственному
 *   getCatalogOwnerNote(tourId)       внутренняя заметка владельца
 *   saveCatalogOwnerNote(tourId, b)   сохранить заметку (пустая — удалить)
 *   listCatalogTourHistory(tourId)    изменения условий, назначения, отзывы, передачи
 *
 * Всё только для owner: requireRole(["owner"]) здесь и is_owner() в базе
 * (RPC SECURITY DEFINER и RLS tour_catalog_owner_notes, миграция
 * 20261125090000_tour_catalog_managers.sql). admin сюда не допускается.
 * Заметка нигде больше не читается: ни в каталоге, ни в RPC менеджеров,
 * ни в уведомлениях.
 * ──────────────────────────────────────────────────────────────────── */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AuthorizationError, requireRole } from "@/lib/server/require-role";
import {
  parseCatalogAssignment,
  parseManagerCandidate,
  parseTourHistoryEntry,
  type CatalogAssignment,
  type ManagerCandidate,
  type TourHistoryEntry,
} from "@/lib/tour-catalog";

export type ManagersFailure =
  | "forbidden"
  | "invalid"
  | "not_found"
  | "not_eligible"
  | "already_assigned"
  | "not_active"
  | "not_assigned"
  | "has_tour"
  | "schema"
  | "failed";

type Fail = { ok: false; reason: ManagersFailure };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNER_NOTE_MAX = 8000;

function failureOf(error: { code?: string; message?: string }): ManagersFailure {
  console.error("[tour_catalog_managers]", error.code, error.message);
  const msg = error.message ?? "";
  if (msg.includes("owner_only") || error.code === "42501") return "forbidden";
  if (msg.includes("manager_not_eligible")) return "not_eligible";
  if (msg.includes("manager_already_assigned")) return "already_assigned";
  if (msg.includes("assignment_not_active")) return "not_active";
  if (msg.includes("manager_not_assigned") || msg.includes("transfer_to_same_manager")) return "not_assigned";
  if (msg.includes("casting_has_tour")) return "has_tour";
  if (msg.includes("not_found") || error.code === "P0002") return "not_found";
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42P01" || error.code === "PGRST205") return "schema";
  if (error.code === "22023" || error.code === "23514") return "invalid";
  return "failed";
}

async function ownerClient(): Promise<{ ok: true; supabase: Awaited<ReturnType<typeof createClient>> } | Fail> {
  try {
    await requireRole(["owner"]);
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, reason: "forbidden" };
    throw error;
  }
  return { ok: true, supabase: await createClient() };
}

const asList = (data: unknown): unknown[] => (Array.isArray(data) ? data : []);

export async function searchCatalogManagers(query: string): Promise<{ ok: true; managers: ManagerCandidate[] } | Fail> {
  const c = await ownerClient();
  if (!c.ok) return c;
  const q = typeof query === "string" ? query.trim().slice(0, 80) : "";
  const { data, error } = await c.supabase.rpc("voyage_owner_catalog_manager_candidates", { p_query: q || null, p_limit: 20 });
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true, managers: asList(data).flatMap((row) => parseManagerCandidate(row) ?? []) };
}

export async function listCatalogAssignments(tourId?: string | null): Promise<{ ok: true; assignments: CatalogAssignment[] } | Fail> {
  const c = await ownerClient();
  if (!c.ok) return c;
  if (tourId && !UUID_RE.test(tourId)) return { ok: false, reason: "invalid" };
  const { data, error } = await c.supabase.rpc("voyage_owner_catalog_assignments", { p_tour: tourId ?? null });
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true, assignments: asList(data).flatMap((row) => parseCatalogAssignment(row) ?? []) };
}

export async function assignCatalogManager(
  tourId: string,
  managerId: string,
  note?: string | null,
): Promise<{ ok: true; assignment: CatalogAssignment } | Fail> {
  const c = await ownerClient();
  if (!c.ok) return c;
  if (!UUID_RE.test(tourId) || !UUID_RE.test(managerId)) return { ok: false, reason: "invalid" };
  const { data, error } = await c.supabase.rpc("voyage_owner_assign_catalog_manager", {
    p_tour: tourId,
    p_manager: managerId,
    p_note: typeof note === "string" ? note.slice(0, 500) : null,
  });
  if (error) return { ok: false, reason: failureOf(error) };
  const assignment = parseCatalogAssignment(data);
  if (!assignment) return { ok: false, reason: "failed" };
  revalidatePath("/partner/castings/tours");
  return { ok: true, assignment };
}

export type RevokeResult =
  | { ok: true; assignment: CatalogAssignment; transferred: number; kept: number }
  | Fail;

export async function revokeCatalogManager(
  assignmentId: string,
  reason?: string | null,
  transferTo?: string | null,
): Promise<RevokeResult> {
  const c = await ownerClient();
  if (!c.ok) return c;
  if (!UUID_RE.test(assignmentId) || (transferTo && !UUID_RE.test(transferTo))) return { ok: false, reason: "invalid" };
  const { data, error } = await c.supabase.rpc("voyage_owner_revoke_catalog_manager", {
    p_assignment: assignmentId,
    p_reason: typeof reason === "string" ? reason.slice(0, 500) : null,
    p_transfer_to: transferTo || null,
  });
  if (error) return { ok: false, reason: failureOf(error) };
  const r = (data ?? {}) as Record<string, unknown>;
  const assignment = parseCatalogAssignment(r.assignment);
  if (!assignment) return { ok: false, reason: "failed" };
  revalidatePath("/partner/castings/tours");
  return {
    ok: true,
    assignment,
    transferred: Array.isArray(r.transferred) ? r.transferred.length : 0,
    kept: Array.isArray(r.kept) ? r.kept.length : 0,
  };
}

export async function transferCatalogCasting(castingId: string, toManagerId: string): Promise<{ ok: true } | Fail> {
  const c = await ownerClient();
  if (!c.ok) return c;
  if (!UUID_RE.test(castingId) || !UUID_RE.test(toManagerId)) return { ok: false, reason: "invalid" };
  const { error } = await c.supabase.rpc("voyage_owner_transfer_casting", { p_casting: castingId, p_to: toManagerId });
  if (error) return { ok: false, reason: failureOf(error) };
  revalidatePath("/partner/castings/tours");
  return { ok: true };
}

export type OwnerNote = { body: string; updatedAt: string | null };

export async function getCatalogOwnerNote(tourId: string): Promise<{ ok: true; note: OwnerNote } | Fail> {
  const c = await ownerClient();
  if (!c.ok) return c;
  if (!UUID_RE.test(tourId)) return { ok: false, reason: "invalid" };
  const { data, error } = await c.supabase
    .from("tour_catalog_owner_notes")
    .select("body,updated_at")
    .eq("catalog_tour_id", tourId)
    .maybeSingle();
  if (error) return { ok: false, reason: failureOf(error) };
  return {
    ok: true,
    note: {
      body: typeof data?.body === "string" ? data.body : "",
      updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
    },
  };
}

export async function saveCatalogOwnerNote(tourId: string, body: string): Promise<{ ok: true; note: OwnerNote } | Fail> {
  const c = await ownerClient();
  if (!c.ok) return c;
  if (!UUID_RE.test(tourId) || typeof body !== "string") return { ok: false, reason: "invalid" };
  const text = body.replace(/\r\n/g, "\n");
  if (text.length > OWNER_NOTE_MAX) return { ok: false, reason: "invalid" };

  const { data: existing, error: readError } = await c.supabase
    .from("tour_catalog_owner_notes")
    .select("id")
    .eq("catalog_tour_id", tourId)
    .maybeSingle();
  if (readError) return { ok: false, reason: failureOf(readError) };

  if (!text.trim()) {
    if (existing) {
      const { error } = await c.supabase.from("tour_catalog_owner_notes").delete().eq("id", existing.id);
      if (error) return { ok: false, reason: failureOf(error) };
    }
    return { ok: true, note: { body: "", updatedAt: null } };
  }

  const res = existing
    ? await c.supabase.from("tour_catalog_owner_notes").update({ body: text }).eq("id", existing.id).select("body,updated_at").single()
    : await c.supabase.from("tour_catalog_owner_notes").insert({ catalog_tour_id: tourId, body: text }).select("body,updated_at").single();
  if (res.error) return { ok: false, reason: failureOf(res.error) };
  return {
    ok: true,
    note: { body: String(res.data.body ?? ""), updatedAt: typeof res.data.updated_at === "string" ? res.data.updated_at : null },
  };
}

export async function listCatalogTourHistory(tourId: string): Promise<{ ok: true; entries: TourHistoryEntry[] } | Fail> {
  const c = await ownerClient();
  if (!c.ok) return c;
  if (!UUID_RE.test(tourId)) return { ok: false, reason: "invalid" };
  const { data, error } = await c.supabase.rpc("voyage_owner_catalog_tour_history", { p_tour: tourId, p_limit: 200 });
  if (error) return { ok: false, reason: failureOf(error) };
  return { ok: true, entries: asList(data).flatMap((row) => parseTourHistoryEntry(row) ?? []) };
}
