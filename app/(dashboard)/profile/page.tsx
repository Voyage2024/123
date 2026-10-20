import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRoleHomePath, isRole } from "@/lib/rbac";

/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · /profile — устаревший адрес
 * app/(dashboard)/profile/page.tsx
 *
 * Раньше здесь лежал макет резидентского профиля с зашитыми данными,
 * и менеджер, попав сюда со страниц направлений, видел «чужую» анкету.
 * Теперь адрес только перенаправляет: резидентка — в свой профиль,
 * менеджер — в Штаб, админ и владелец — в админку, гость — на вход.
 * ──────────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export default async function LegacyProfileRedirect() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const role = isRole(profile?.role) ? profile.role : "resident";
  redirect(role === "resident" ? "/dashboard/profile" : getRoleHomePath(role));
}
