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

/* ──────────────────────────────────────────────────────────────────────
 * MIDDLEWARE — серверная проверка доступа.
 *
 *  0. Обновляет сессию Supabase (продлевает токен, пишет свежие cookies).
 *  1. Защита от анонимов: закрытая часть → /login.
 *  2. Умный вход: залогиненных с /login и с пустой главной (/) → /dashboard.
 *  3. Админка: читает роль из profiles и
 *       resident            → /dashboard
 *       нет прав на раздел  → /admin
 *
 * Сессия проверяется через getUser() — это запрос к серверу Supabase,
 * подделать его кукой невозможно (в отличие от старого voyage_token).
 * ──────────────────────────────────────────────────────────────────── */

const LOGIN_PATH = "/login";
const HOME_PATH = "/dashboard";
const ADMIN_PATH = "/admin";

// Закрытая часть: без логина сюда нельзя
const PROTECTED_PREFIXES = [HOME_PATH, ADMIN_PATH, "/profile", "/event", "/events"];

// Залогиненных отсюда сразу перекидываем в клуб
const REDIRECT_IF_AUTHED_EXACT = ["/", LOGIN_PATH];

const LEGACY_COOKIE = "voyage_token";

/** Редирект, который не теряет обновлённые cookies сессии. */
function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ВАЖНО: между createServerClient и getUser не должно быть другого кода,
  // иначе возможны случайные разлогины из-за рассинхрона cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Старая кука больше не нужна — подчищаем
  if (request.cookies.has(LEGACY_COOKIE)) {
    response.cookies.delete(LEGACY_COOKIE);
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));

  // ── 1. Защита от анонимов ─────────────────────────────────
  if (!user) {
    return isProtected ? redirectTo(request, response, LOGIN_PATH) : response;
  }

  // ── 2. Умный вход ─────────────────────────────────────────
  if (REDIRECT_IF_AUTHED_EXACT.includes(pathname)) {
    return redirectTo(request, response, HOME_PATH);
  }

  // ── 3. Админка: проверка роли по базе ─────────────────────
  if (matchesPrefix(pathname, ADMIN_PATH)) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[middleware] Не удалось получить роль:", error.message);
    }

    // При любой ошибке — минимальная роль, а не повышенная
    const role: Role = isRole(profile?.role) ? profile.role : DEFAULT_ROLE;

    if (!STAFF_ROLES.includes(role)) {
      return redirectTo(request, response, HOME_PATH);
    }

    if (!getAdminAllowedRoles(pathname).includes(role)) {
      return redirectTo(request, response, ADMIN_PATH);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Все пути, кроме API, статики Next.js и картинок
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
