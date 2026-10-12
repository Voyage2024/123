import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/app/context/AuthContext";

export class AuthorizationError extends Error {
  constructor(message = "You are not authorized to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function isBanActive(profile: { banned_until?: string | null; ban_permanent?: boolean | null }): boolean {
  if (profile.ban_permanent === true || profile.banned_until === "infinity") return true;
  if (!profile.banned_until) return false;
  const parsed = Date.parse(profile.banned_until);
  return Number.isFinite(parsed) && parsed > Date.now();
}

export async function requireRole(allowed: readonly Role[]): Promise<{ userId: string; role: Role }> {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new AuthorizationError("Please sign in.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,banned_until,ban_permanent")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileError || !profile || !allowed.includes(profile.role as Role)) {
    throw new AuthorizationError("You do not have permission to perform this action.");
  }
  if (isBanActive(profile)) throw new AuthorizationError("Access is restricted for this account.");

  return { userId: auth.user.id, role: profile.role as Role };
}
