import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ResidentProfileDashboard from "./ResidentProfileDashboard";

export const dynamic = "force-dynamic";

/**
 * Корень кабинета резидентки: здесь только профиль/карта клуба и другие
 * блоки ResidentProfileDashboard. Лента кастингов находится по /dashboard/castings.
 * Перенаправления персонала совпадают с Navbar и RBAC: manager -> /partner,
 * admin/owner -> /admin.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  // Не предполагаем роль resident, если профиль отсутствует или не читается.
  if (profileError) {
    console.error("[dashboard] Failed to resolve profile role", {
      code: profileError.code,
    });
    redirect("/login?error=profile_check");
  }

  if (!profile) {
    redirect("/login?error=profile_check");
  }

  switch (profile.role) {
    case "owner":
    case "admin":
      redirect("/admin");
    case "manager":
      redirect("/partner");
    case "resident":
      return <ResidentProfileDashboard />;
    default:
      redirect("/login?error=role_check");
  }
}
