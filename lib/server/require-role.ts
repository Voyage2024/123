import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/rbac";

const VALID_ROLES = new Set<Role>(["owner", "admin", "manager", "resident"]);

export class AuthorizationError extends Error {
  readonly status: 401 | 403 | 500;

  constructor(message: string, status: 401 | 403 | 500) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

/**
 * Server-side authorization. The role is always read from public.profiles
 * using the authenticated user's Supabase session; never trust client role,
 * user_metadata, app_metadata or an email allow-list for authorization.
 */
export async function requireRole(allowedRoles: readonly Role[]) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new AuthorizationError("Необходима авторизация.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[authorization] profile role lookup failed:", profileError.message);
    throw new AuthorizationError("Не удалось проверить права доступа.", 500);
  }

  const role = profile?.role;
  if (typeof role !== "string" || !VALID_ROLES.has(role as Role)) {
    throw new AuthorizationError("Профиль пользователя не найден или роль недействительна.", 403);
  }
  if (!allowedRoles.includes(role as Role)) {
    throw new AuthorizationError("Недостаточно прав.", 403);
  }

  return { user: authData.user, role: role as Role, supabase };
}

export function toAuthorizationResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return { error: error.message, status: error.status } as const;
  }
  return { error: "Внутренняя ошибка сервера.", status: 500 } as const;
}
