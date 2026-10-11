import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ResidentProfileDashboard from "./ResidentProfileDashboard";

export const dynamic = "force-dynamic";

/** Server-side role switch: personnel must never render the resident card dashboard. */
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (error || !profile) redirect("/login?error=profile_check");
  if (["owner", "admin", "manager"].includes(String(profile.role))) redirect("/admin");
  if (profile.role !== "resident") redirect("/login?error=role_check");

  return <ResidentProfileDashboard />;
}
