"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function isBanned(until: unknown, permanent: unknown) {
  if (permanent === true || until === "infinity") return true;
  if (typeof until !== "string") return false;
  const timestamp = Date.parse(until);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

/** Legacy Server Action kept for existing imports; privileged creation is now role-checked. */
export async function createResident(formData: FormData) {
  const sessionClient = await createClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) return { success: false, error: "Необходима авторизация." };

  const { data: actor, error: actorError } = await sessionClient
    .from("profiles")
    .select("role, banned_until, ban_permanent")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (actorError || !actor) return { success: false, error: "Не удалось проверить права доступа." };
  if (isBanned(actor.banned_until, actor.ban_permanent)) return { success: false, error: "Аккаунт заблокирован." };
  if (actor.role !== "owner" && actor.role !== "admin") {
    return { success: false, error: "Недостаточно прав. Требуется owner или admin." };
  }

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || name.length > 100) return { success: false, error: "Имя должно содержать от 2 до 100 символов." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Укажите корректный email." };
  if (password.length < 10 || password.length > 128) return { success: false, error: "Пароль должен содержать от 10 до 128 символов." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { success: false, error: "На сервере не настроен Supabase Admin." };

  const admin = createSupabaseAdmin(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, name },
  });

  if (createError || !created.user) {
    return { success: false, error: createError?.message ?? "Не удалось создать Auth-пользователя." };
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      full_name: name,
      email,
      role: "resident",
      segment: "working",
      reliability: 100,
      kyc_level: 0,
      status: "pending",
    },
    { onConflict: "id" },
  );

  if (profileError) {
    // Compensating rollback: do not leave an Auth account without the profiles row expected by RLS.
    await admin.auth.admin.deleteUser(created.user.id);
    return { success: false, error: `Не удалось создать профиль: ${profileError.message}` };
  }

  return { success: true };
}
