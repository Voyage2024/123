import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  STAFF_ROLES,
  getAdminAllowedRoles,
  isRole,
  matchesPrefix,
  getRoleHomePath,
  PARTNER_HOME_PATH,
  RESIDENT_HOME_PATH,
  ADMIN_HOME_PATH,
  type Role,
} from "@/lib/rbac";

const LOGIN_PATH = "/login";
const STAFF_HOME_PATH = ADMIN_HOME_PATH;
const PROTECTED_PREFIXES = [RESIDENT_HOME_PATH, STAFF_HOME_PATH, PARTNER_HOME_PATH, "/profile", "/event", "/events"];
// Only /login redirects authenticated users into their role-specific workspace.
// The public homepage (/) must remain accessible to every authenticated role.
const AUTHENTICATED_REDIRECT_ROUTES = [LOGIN_PATH];
const LEGACY_COOKIE = "voyage_token";

/** Redirect while preserving any refreshed Supabase cookies. */
function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

  // Keep this directly after createServerClient; getUser validates the real session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (request.cookies.has(LEGACY_COOKIE)) response.cookies.delete(LEGACY_COOKIE);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  if (!user) return isProtected ? redirectTo(request, response, LOGIN_PATH) : response;

  const shouldResolveRole =
    AUTHENTICATED_REDIRECT_ROUTES.includes(pathname) ||
    pathname === RESIDENT_HOME_PATH ||
    matchesPrefix(pathname, STAFF_HOME_PATH) ||
    matchesPrefix(pathname, PARTNER_HOME_PATH);

  let role: Role | null = null;
  let roleResolved = false;

  if (shouldResolveRole) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    roleResolved = !error && !!profile && isRole(profile.role);
    role = roleResolved ? (profile!.role as Role) : null;

    if (!roleResolved) {
      // Do NOT silently treat a missing/unreadable staff profile as a resident.
      console.error("[proxy] Could not resolve authenticated profile role", {
        userId: user.id,
        code: error?.code ?? (profile ? "invalid_role" : "profile_missing"),
      });
    }
  }

  // Keep role-based auto-routing on /login only. The public homepage (/) is not an entry redirect.
  if (AUTHENTICATED_REDIRECT_ROUTES.includes(pathname)) {
    if (!roleResolved || !role) return response;
    return redirectTo(request, response, getRoleHomePath(role));
  }

  // The resident profile/onboarding screen must never be the landing page for staff.
  if (pathname === RESIDENT_HOME_PATH) {
    if (!roleResolved || !role) return redirectTo(request, response, LOGIN_PATH);
    if (STAFF_ROLES.includes(role)) return redirectTo(request, response, getRoleHomePath(role));
    return response;
  }

  if (matchesPrefix(pathname, PARTNER_HOME_PATH)) {
    if (!roleResolved || !role) return redirectTo(request, response, LOGIN_PATH);
    if (!STAFF_ROLES.includes(role)) return redirectTo(request, response, RESIDENT_HOME_PATH);
    // Manager, admin and owner can use /partner. More detailed per-tour ownership
    // remains enforced by the partner RPCs and RLS.
    return response;
  }

  if (matchesPrefix(pathname, STAFF_HOME_PATH)) {
    if (!roleResolved || !role) return redirectTo(request, response, LOGIN_PATH);
    if (!STAFF_ROLES.includes(role)) return redirectTo(request, response, RESIDENT_HOME_PATH);
    // The manager's only allowed /admin route is their own profile settings.
    if (role === "manager" && !matchesPrefix(pathname, "/admin/settings")) {
      return redirectTo(request, response, PARTNER_HOME_PATH);
    }
    if (!getAdminAllowedRoles(pathname).includes(role)) {
      return redirectTo(request, response, getRoleHomePath(role));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
