import { searchMedia } from '@marutime/core';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 8), 20);
  const type = url.searchParams.get('type');
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const res = await searchMedia(q, { type: type === 'show' || type === 'movie' ? type : 'all' });
    return NextResponse.json(
      {
        results: res.results.slice(0, limit).map((r) => ({ href: r.href, title: r.title, posterPath: r.posterPath, year: r.releaseDate?.slice(0, 4) ?? '', type: r.type, isAnime: r.isAnime })),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    console.error('[search]', err);
    return NextResponse.json({ results: [], error: 'Search is unavailable right now' }, { status: 503 });
  }
}
