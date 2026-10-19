import { ensureMedia, getShowProgress, getUserWatchesForMedia, isAppError } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';
import { episodeCode } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * What "mark watched" means for a search result in the command bar: the
 * movie itself, or the next unwatched episode of a show (imported on demand).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const type = sp.get('type');
  const tmdbId = Number(sp.get('tmdbId'));
  if ((type !== 'show' && type !== 'movie') || !Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const db = getDb();
  try {
    const media = await ensureMedia(db, type, tmdbId);
    if (media.type === 'movie') {
      const watches = await getUserWatchesForMedia(db, user.id, media.id);
      return NextResponse.json({ target: { kind: 'movie', mediaId: media.id, label: media.title }, count: watches.length }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const progress = await getShowProgress(db, user.id, media.id);
    const next = progress.nextEpisode;
    if (!next) return NextResponse.json({ target: null, reason: progress.upcomingEpisode ? 'You are up to date' : 'Nothing left to watch' }, { headers: { 'Cache-Control': 'private, no-store' } });
    return NextResponse.json(
      { target: { kind: 'episode', episodeId: next.id, mediaId: media.id, seasonNumber: next.seasonNumber, label: `${media.title} · ${episodeCode(next.seasonNumber, next.episodeNumber)}` }, count: 0 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    if (isAppError(err) && err.code === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('[palette]', err);
    return NextResponse.json({ error: 'Unavailable right now' }, { status: 503 });
  }
}
