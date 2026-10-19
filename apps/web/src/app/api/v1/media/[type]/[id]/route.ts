import { AppError, ensureMedia, getAnimeDetails, getCharactersForMedia, getEpisodesForMedia, getSeasons, getShowProgress, getUserEpisodeWatchMap, isInWatchlist } from '@marutime/core';
import { getDb } from '@marutime/db';
import { apiError, apiJson, authenticateApi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/** Full detail for a title by TMDB id, with the caller's progress when authenticated. */
export async function GET(request: Request, ctx: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { type, id } = await ctx.params;
    if (type !== 'show' && type !== 'movie') throw new AppError('validation', 'type must be show or movie');
    const externalId = Number(id);
    if (!Number.isInteger(externalId) || externalId <= 0) throw new AppError('validation', 'Invalid id');
    const db = getDb();
    let userId: string | null = null;
    try {
      userId = (await authenticateApi(request, 'read')).user.id;
    } catch {
      userId = null;
    }
    const media = await ensureMedia(db, type, externalId);
    const [seasons, episodes, characters, anime] = await Promise.all([
      type === 'show' ? getSeasons(db, media.id) : Promise.resolve([]),
      type === 'show' ? getEpisodesForMedia(db, media.id) : Promise.resolve([]),
      getCharactersForMedia(db, media.id),
      media.isAnime ? getAnimeDetails(db, media.id) : Promise.resolve(null),
    ]);
    let progress = null;
    let watchedEpisodeIds: number[] = [];
    let inWatchlist = false;
    if (userId) {
      if (type === 'show') {
        progress = await getShowProgress(db, userId, media.id);
        watchedEpisodeIds = Array.from((await getUserEpisodeWatchMap(db, userId, media.id)).keys());
      }
      inWatchlist = await isInWatchlist(db, userId, media.id);
    }
    return apiJson({ media, seasons, episodes, characters, anime, progress, watchedEpisodeIds, inWatchlist }, { headers: { 'Cache-Control': userId ? 'private, no-store' : 'public, s-maxage=600' } });
  } catch (err) {
    return apiError(err);
  }
}
