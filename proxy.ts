import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_ROLE,
  STAFF_ROLES,
  getAdminAllowedRoles,
  isRole,
  matchesPrefix,
  type Role,
} from "@/lib/rbac";

const LOGIN_PATH = "/login";
const HOME_PATH = "/dashboard";
const ADMIN_PATH = "/admin";
const LEGACY_COOKIE = "voyage_token";
const PROTECTED_PREFIXES = [HOME_PATH, ADMIN_PATH, "/profile", "/event", "/events"];
const REDIRECT_IF_AUTHED_EXACT = ["/", LOGIN_PATH];

function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

/** Next.js 16 Middleware: refresh Supabase cookies and perform coarse route gating.
 * Server Actions, Route Handlers and RLS must still authorize independently.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail closed on protected application routes when auth config is missing.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtected || matchesPrefix(pathname, ADMIN_PATH)) {
      return NextResponse.json({ error: "Сервис авторизации не настроен." }, { status: 503 });
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) console.warn("[middleware] Supabase session check failed:", userError.message);

  if (request.cookies.has(LEGACY_COOKIE)) response.cookies.delete(LEGACY_COOKIE);

  if (!user) {
    return isProtected ? redirectTo(request, response, LOGIN_PATH) : response;
  }

  if (REDIRECT_IF_AUTHED_EXACT.includes(pathname)) {
    return redirectTo(request, response, HOME_PATH);
  }

  // The classic application inbox is a Working-track feature. Keep the
  // guard server-side as a direct URL must not bypass the hidden sidebar item.
  if (matchesPrefix(pathname, "/dashboard/applications")) {
    const { data: residentProfile, error: segmentError } = await supabase
      .from("profiles")
      .select("segment")
      .eq("id", user.id)
      .maybeSingle();

    if (segmentError) {
      console.error("[middleware] Segment lookup failed:", segmentError.message);
      return NextResponse.json({ error: "Не удалось проверить сегмент пользователя." }, { status: 503 });
    }
    if (residentProfile?.segment !== "working") return redirectTo(request, response, "/dashboard/parties");
  }

  if (matchesPrefix(pathname, ADMIN_PATH)) {
    const { data: profile, error: roleError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("[middleware] Role lookup failed:", roleError.message);
      return NextResponse.json({ error: "Не удалось проверить роль пользователя." }, { status: 503 });
    }

    const role: Role = isRole(profile?.role) ? profile.role : DEFAULT_ROLE;
    if (!STAFF_ROLES.includes(role)) return redirectTo(request, response, HOME_PATH);
    if (!getAdminAllowedRoles(pathname).includes(role)) {
      return redirectTo(request, response, ADMIN_PATH);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};