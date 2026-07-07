import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('voyage_token');
  const { pathname } = request.nextUrl;

  // 1. Защита от анонимов: 
  // Если нет токена и пытаются зайти в закрытую часть — выкидываем на логин
  if (!token && (
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/profile') || 
    pathname.startsWith('/event')
  )) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Умный вход: 
  // Если есть токен и пытаются зайти на страницу логина ИЛИ на пустую главную (/)
  // — перекидываем их сразу в клуб (дашборд)
  if (token && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};