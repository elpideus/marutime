import { SESSION_COOKIE } from '@marutime/config';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/watchlist', '/shows', '/feed', '/notifications', '/settings', '/admin', '/lists/new'];

/**
 * Fast redirect for signed-out visitors on private routes. Pages still verify
 * the session properly; this only avoids streaming a page that will redirect.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/watchlist/:path*', '/shows/:path*', '/feed/:path*', '/notifications/:path*', '/settings/:path*', '/admin/:path*', '/lists/new'],
};
