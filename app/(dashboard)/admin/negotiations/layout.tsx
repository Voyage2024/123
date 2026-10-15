import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side route guard for the Control Tower.
 * Middleware is not required: role authorization happens before the page is rendered.
 */
export default async function NegotiationsLayout({
  children,
}: {
  children: ReactNode;
}) {
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

  if (profileError || !profile?.role) {
    redirect("/dashboard");
  }

  if (profile.role !== "owner" && profile.role !== "admin") {
    redirect(profile.role === "manager" ? "/partner" : "/dashboard");
  }

  return <>{children}</>;
}
