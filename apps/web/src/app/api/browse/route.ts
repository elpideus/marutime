import { browseMedia, BROWSE_SORTS, type BrowseSort } from '@marutime/core';
import { NextResponse } from 'next/server';
import { cardFromSummary } from '@/lib/media-card';

export const dynamic = 'force-dynamic';

/** Next page of Discover → Browse results (genre-filtered, sorted). */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const c = sp.get('c');
  const category = c === 'movies' || c === 'anime' ? c : 'shows';
  const sort = (BROWSE_SORTS as readonly string[]).includes(sp.get('sort') ?? '') ? (sp.get('sort') as BrowseSort) : 'popular';
  const genreIds = (sp.get('g') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 6);
  const page = Math.min(500, Math.max(1, Number(sp.get('page') ?? 1) || 1));
  try {
    const res = await browseMedia(category, { genreIds, sort, page });
    return NextResponse.json({ items: res.results.map(cardFromSummary), page: res.page, totalPages: res.totalPages }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch (err) {
    console.error('[browse]', err);
    return NextResponse.json({ error: 'Unavailable right now' }, { status: 503 });
  }
}
