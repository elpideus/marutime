import 'server-only';

import {
  cached,
  ensureMedia,
  getAnimeDetails,
  getCharactersForMedia,
  getEpisodesPage,
  getListsForPicker,
  getMediaById,
  getSeasonSummaries,
  getSeasons,
  isAppError,
  isInWatchlist,
  parseMediaParam,
  todayIso,
} from '@marutime/core';
import { getDb, type Media, type User } from '@marutime/db';
import { notFound } from 'next/navigation';

/** Resolve a `/show/[id]` or `/movie/[id]` param to a synced media row, or 404. */
export async function loadMedia(type: 'show' | 'movie', param: string): Promise<Media> {
  const externalId = parseMediaParam(param);
  if (!externalId) notFound();
  try {
    return await ensureMedia(getDb(), type, externalId);
  } catch (err) {
    if (isAppError(err) && err.code === 'not_found') notFound();
    throw err;
  }
}

export async function loadViewerMediaState(user: User | null, mediaId: number) {
  if (!user) return { inWatchlist: false, lists: [] as Awaited<ReturnType<typeof getListsForPicker>> };
  const db = getDb();
  const [inWatchlist, lists] = await Promise.all([isInWatchlist(db, user.id, mediaId), getListsForPicker(db, user.id, mediaId)]);
  return { inWatchlist, lists };
}

/*
 * Title data only changes when the title is re-synced, so it is cached in
 * memory under a key that includes `syncedAt`: a re-sync naturally moves to a
 * fresh key and the old one ages out of the LRU. No invalidation needed.
 */
const version = (m: Pick<Media, 'id' | 'syncedAt'>) => `${m.id}:${m.syncedAt?.getTime() ?? 0}`;
const TITLE_DATA = { ttl: 60 * 60, staleTtl: 0 };

export function loadSeasons(m: Media) {
  return cached(`title:seasons:${version(m)}`, TITLE_DATA, () => getSeasons(getDb(), m.id));
}

export function loadSeasonCounts(m: Media) {
  const today = todayIso();
  return cached(`title:season-counts:${version(m)}:${today}`, TITLE_DATA, () => getSeasonSummaries(getDb(), m.id, today));
}

export function loadEpisodesPage(m: Media, season: number, offset: number, limit: number) {
  return cached(`title:episodes:${version(m)}:${season}:${offset}:${limit}`, { ...TITLE_DATA, weight: limit }, () => getEpisodesPage(getDb(), m.id, season, offset, limit));
}

export function loadCharacters(m: Media, limit = 40) {
  return cached(`title:characters:${version(m)}:${limit}`, TITLE_DATA, () => getCharactersForMedia(getDb(), m.id, { limit }));
}

export function loadAnime(m: Media) {
  return m.isAnime ? cached(`title:anime:${version(m)}`, TITLE_DATA, () => getAnimeDetails(getDb(), m.id)) : Promise.resolve(null);
}

/** Media row by internal id, briefly cached (used by client-side fetches). */
export function loadMediaById(id: number) {
  return cached(`title:row:${id}`, { ttl: 60, staleTtl: 0 }, () => getMediaById(getDb(), id));
}
