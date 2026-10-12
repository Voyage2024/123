"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type KycActionResult = { ok: true; level: number } | { ok: false; reason: "unauthenticated" | "forbidden" | "invalid" | "not_found" | "server_error" };

export async function setResidentKycLevel(profileId: string, level: number): Promise<KycActionResult> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(profileId) || !Number.isInteger(level) || level < 0 || level > 3) return { ok: false, reason: "invalid" };
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { ok: false, reason: "unauthenticated" };
  const { data: actor, error: actorError } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (actorError || !actor) return { ok: false, reason: "server_error" };
  if (!(["owner", "admin"] as string[]).includes(String(actor.role))) return { ok: false, reason: "forbidden" };
  const { data: target, error: targetError } = await supabase.from("profiles").select("id,role").eq("id", profileId).maybeSingle();
  if (targetError) {
    console.error("[admin-kyc] target lookup failed", { code: targetError.code, message: targetError.message });
    return { ok: false, reason: "server_error" };
  }
  if (!target || target.role !== "resident") return { ok: false, reason: "not_found" };
  const { data, error } = await supabase.rpc("club_admin_set_kyc_level", { p_profile: profileId, p_level: level });
  if (error) {
    console.error("[admin-kyc] club_admin_set_kyc_level failed", { code: error.code, message: error.message, profileId, level });
    return { ok: false, reason: error.code === "42501" ? "forbidden" : error.code === "P0002" ? "not_found" : "server_error" };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/face-control");
  revalidatePath("/admin/database");
  return { ok: true, level: Number(data ?? level) };
}
