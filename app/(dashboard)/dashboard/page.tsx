import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ResidentProfileDashboard from "./ResidentProfileDashboard";

export const dynamic = "force-dynamic";

/** Server-side role switch: personnel must never render the resident card dashboard. */
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  // Never infer a resident role if the profile is missing or cannot be read.
  if (profileError) {
    console.error("[dashboard] Failed to resolve profile role", {
      code: profileError.code,
    });
    redirect("/login?error=profile_check");
  }
  if (!profile) redirect("/login?error=profile_check");

  const role = profile.role;
  // Менеджер — в Штаб: /admin для него закрыт (lib/rbac.ts), а резидентская
  // карточка ему не принадлежит.
  if (role === "manager") redirect("/partner");
  if (role === "owner" || role === "admin") redirect("/admin");
  if (role !== "resident") redirect("/login?error=role_check");

  return <ResidentProfileDashboard />;
}
