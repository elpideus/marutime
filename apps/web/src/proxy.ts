import { SESSION_COOKIE } from '@marutime/config';
import { NextResponse, type NextRequest } from 'next/server';
import { isBlockedCrawler } from '@/lib/bots';

const PROTECTED = ['/watchlist', '/shows', '/feed', '/notifications', '/settings', '/admin', '/lists/new'];

/**
 * Fast redirect for signed-out visitors on private routes (pages still verify
 * the session properly; this only avoids streaming a page that will redirect),
 * and a cheap gate for crawlers on the pages that read the most data.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Content harvesters that ignore robots.txt are turned away before any page renders (and touches the database).
  if (isBlockedCrawler(request.headers.get('user-agent'))) return new NextResponse('Crawling is not allowed here. See /robots.txt.', { status: 403 });
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
  matcher: [
    '/watchlist/:path*',
    '/shows/:path*',
    '/feed/:path*',
    '/notifications/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/lists/:path*',
    '/show/:path*',
    '/movie/:path*',
    '/discover/:path*',
    '/search/:path*',
    '/u/:path*',
    '/api/:path*',
  ],
};
