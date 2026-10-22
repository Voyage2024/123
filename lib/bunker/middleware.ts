import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/* ──────────────────────────────────────────────────────────────────────
 * Гард /bunker для корневого middleware.ts.
 *
 * Лучший вариант — вызвать ПОСЛЕ того, как middleware обновил сессию
 * Supabase, и передать уже полученные клиент, пользователя и ответ:
 *
 *   import { bunkerGuard } from "@/lib/bunker/middleware";
 *   ...
 *   const { data: { user } } = await supabase.auth.getUser();   // уже есть в middleware
 *   const bunker = await bunkerGuard(request, { supabase, userId: user?.id ?? null });
 *   if (bunker) return bunker;
 *
 * Если middleware своего клиента не создаёт — достаточно
 *   const bunker = await bunkerGuard(request, { response });
 * (response — NextResponse, который middleware вернёт: в него запишутся
 * обновлённые cookie сессии).
 *
 * Возвращает 404 для всех, кроме владельца, и null — если путь не /bunker
 * или доступ есть (тогда middleware продолжает как обычно).
 * Вторая линия обороны — app/bunker/layout.tsx (notFound()), третья — RLS.
 * ──────────────────────────────────────────────────────────────────── */

const notFound = () =>
  new NextResponse("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

/** Страницы бункера. Иконки PWA из public/bunker/*.png не трогаем — в них нет ничего секретного. */
export function isBunkerPath(pathname: string) {
  if (/^\/bunker\/[^/]+\.(png|ico|svg|webp)$/.test(pathname)) return false;
  return pathname === "/bunker" || pathname.startsWith("/bunker/");
}

type GuardContext = {
  /** Клиент Supabase, который middleware уже создал. */
  supabase?: SupabaseClient;
  /** id пользователя из уже сделанного getUser(); null — не вошёл. */
  userId?: string | null;
  /** Ответ middleware: сюда пишутся обновлённые cookie, если клиент создаём мы. */
  response?: NextResponse;
};

export async function bunkerGuard(request: NextRequest, ctx: GuardContext = {}): Promise<NextResponse | null> {
  if (!isBunkerPath(request.nextUrl.pathname)) return null;

  const supabase =
    ctx.supabase ??
    createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            ctx.response?.cookies.set(name, value, options);
          });
        },
      },
    });

  let userId = ctx.userId;
  if (userId === undefined) {
    const { data, error } = await supabase.auth.getUser();
    userId = error ? null : (data.user?.id ?? null);
  }
  if (!userId) return notFound();

  const ownerIds = (process.env.BUNKER_OWNER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (ownerIds.includes(userId.toLowerCase())) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return profile?.role === "owner" ? null : notFound();
}
