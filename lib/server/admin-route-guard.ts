import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getAdminAllowedRoles, getRoleHomePath, isRole } from "@/lib/rbac";

/* ──────────────────────────────────────────────────────────────────────
 * Проверка /admin/* в middleware.ts (или proxy.ts в Next 16) — ДО рендера.
 *
 * Роль берётся из public.profiles по проверенной сессии Supabase
 * (getUser ходит в Auth API), cookie voyage_token тут не участвует.
 * Правила разделов — те же, что у клиента: lib/rbac.ts.
 *
 * Использование (см. README_SECURITY_HARDENING_RU.md):
 *
 *   export async function middleware(request: NextRequest) {
 *     const response = NextResponse.next({ request });
 *     const denied = await guardAdminRoute(request, response);
 *     if (denied) return denied;
 *     // … остальной ваш код (bunkerGuard и т.п.)
 *     return response;
 *   }
 *
 * Возвращает редирект, если доступа нет, иначе null.
 * ──────────────────────────────────────────────────────────────────── */

export async function guardAdminRoute(request: NextRequest, response: NextResponse): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (pathname !== "/admin" && !pathname.startsWith("/admin/")) return null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const to = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return to("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || !isRole(profile.role)) return to("/login");

  if (!getAdminAllowedRoles(pathname).includes(profile.role)) {
    return to(profile.role === "manager" ? "/partner" : getRoleHomePath(profile.role));
  }
  return null;
}
