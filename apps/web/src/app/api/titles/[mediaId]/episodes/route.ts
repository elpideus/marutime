import { NextResponse } from 'next/server';
import { loadEpisodesPage, loadMediaById } from '@/lib/media-page';

export const dynamic = 'force-dynamic';

/** A page of a season's episodes for the episode list (loaded as you scroll). */
export async function GET(request: Request, ctx: { params: Promise<{ mediaId: string }> }) {
  const mediaId = Number((await ctx.params).mediaId);
  const url = new URL(request.url);
  const season = Number(url.searchParams.get('season'));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit') ?? 40) || 40));
  if (!Number.isInteger(mediaId) || mediaId <= 0 || !Number.isInteger(season) || season < 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const media = await loadMediaById(mediaId);
  if (!media || media.type !== 'show') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const page = await loadEpisodesPage(media, season, offset, limit);
  return NextResponse.json(
    {
      items: page.items.map((e) => ({ id: e.id, seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, name: e.name, overview: e.overview, stillPath: e.stillPath, airDate: e.airDate, runtime: e.runtime, voteAverage: e.voteAverage })),
      total: page.total,
    },
    // Public catalogue data: let the browser and CDN reuse it briefly.
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' } },
  );
}
