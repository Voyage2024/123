"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ResidentSegment = "working" | "elite";
export type ResidentTrustPatch = {
  segment?: ResidentSegment;
  reliability?: number;
};

export type ResidentTrustActionResult =
  | { ok: true; profileId: string; segment: ResidentSegment; reliability: number }
  | { ok: false; reason: "invalid" | "unauthenticated" | "forbidden" | "not_found" | "server_error" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Change only the manually managed trust fields. The database RPC validates the
 * authenticated user's owner/admin role and the resident profile atomically.
 * `level` and `circle` are intentionally not accepted by this action.
 */
export async function updateResidentTrust(
  profileId: string,
  patch: ResidentTrustPatch,
): Promise<ResidentTrustActionResult> {
  if (!UUID_RE.test(profileId)) return { ok: false, reason: "invalid" };

  const hasSegment = Object.prototype.hasOwnProperty.call(patch, "segment");
  const hasReliability = Object.prototype.hasOwnProperty.call(patch, "reliability");
  if (!hasSegment && !hasReliability) return { ok: false, reason: "invalid" };

  if (hasSegment && patch.segment !== "working" && patch.segment !== "elite") {
    return { ok: false, reason: "invalid" };
  }

  let reliability: number | null = null;
  if (hasReliability) {
    if (typeof patch.reliability !== "number" || !Number.isFinite(patch.reliability) || patch.reliability < 0 || patch.reliability > 100) {
      return { ok: false, reason: "invalid" };
    }
    // profiles.reliability uses numeric(5,2), so persist the precision the DB stores.
    reliability = Math.round(patch.reliability * 100) / 100;
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return { ok: false, reason: "unauthenticated" };

  const { data, error } = await supabase.rpc("admin_set_resident_segment_reliability", {
    p_profile_id: profileId,
    p_segment: hasSegment ? (patch.segment ?? null) : null,
    p_reliability: reliability,
  });

  if (error) {
    console.error("[VOYAGE profile trust] RPC failed", { code: error.code, message: error.message });
    if (error.code === "42501") return { ok: false, reason: "forbidden" };
    if (error.code === "28000") return { ok: false, reason: "unauthenticated" };
    if (error.code === "P0002") return { ok: false, reason: "not_found" };
    if (error.code === "22023") return { ok: false, reason: "invalid" };
    return { ok: false, reason: "server_error" };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { profile_id?: string; segment?: string; reliability?: number | string } | null;
  if (!row?.profile_id || (row.segment !== "working" && row.segment !== "elite")) {
    return { ok: false, reason: "server_error" };
  }

  const result = {
    ok: true as const,
    profileId: row.profile_id,
    segment: row.segment,
    reliability: Number(row.reliability),
  };
  revalidatePath(`/admin/database/${profileId}`);
  revalidatePath("/admin/database");
  revalidatePath("/admin/directory");
  revalidatePath("/admin/applications");
  return result;
}
