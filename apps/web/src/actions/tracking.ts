'use server';

import {
  addToWatchlist,
  checkInEpisode,
  checkInMovie,
  deleteWatch,
  deleteWatches,
  errors,
  getCharactersForEpisode,
  getCharactersForMedia,
  getEpisodeById,
  getLatestWatch,
  markEpisodesWatched,
  removeFromWatchlist,
  restoreWatches,
  setTrackingStatus,
  toggleFavoriteShow,
  trackShow,
  unwatchEpisode,
  unwatchEpisodes,
  unwatchMovie,
  untrackShow,
  updateWatch,
  type BulkMarkInput,
  type CheckInInput,
  type RestorableWatch,
} from '@marutime/core';
import { getDb, type Watch } from '@marutime/db';
import { run, type ActionResult } from '@/lib/action';
import { getCurrentUser } from '@/lib/session';
import type { CheckInCharacter, CheckInInitial } from '@/lib/check-in';

async function me() {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  if (user.status !== 'active') throw errors.forbidden('Your account is suspended');
  return user;
}

/** Just the fields needed to put a removed viewing back. */
function restorable(w: Watch): RestorableWatch {
  return {
    mediaId: w.mediaId,
    episodeId: w.episodeId,
    watchedAt: w.watchedAt,
    deviceId: w.deviceId,
    serviceId: w.serviceId,
    emotions: w.emotions as RestorableWatch['emotions'],
    favoriteCharacterId: w.favoriteCharacterId,
    rating: w.rating,
    note: w.note,
    source: w.source,
  };
}

function initialFrom(w: Watch | null): CheckInInitial | null {
  return w ? { watchId: w.id, deviceId: w.deviceId, serviceId: w.serviceId, emotions: w.emotions, favoriteCharacterId: w.favoriteCharacterId, rating: w.rating, note: w.note } : null;
}

export async function checkInEpisodeAction(episodeId: number, input: CheckInInput): Promise<ActionResult<{ created: boolean; finishedShow: boolean; startedShow: boolean; watchId: string }>> {
  return run(async () => {
    const user = await me();
    const r = await checkInEpisode(getDb(), user.id, episodeId, input);
    return { created: r.created, finishedShow: r.finishedShow, startedShow: r.startedShow, watchId: r.watch.id };
  });
}

export async function checkInMovieAction(mediaId: number, input: CheckInInput): Promise<ActionResult<{ created: boolean; watchId: string }>> {
  return run(async () => {
    const user = await me();
    const r = await checkInMovie(getDb(), user.id, mediaId, input);
    return { created: r.created, watchId: r.watch.id };
  });
}

export async function updateWatchAction(watchId: string, input: CheckInInput): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await updateWatch(getDb(), user.id, watchId, input);
  });
}

export async function deleteWatchAction(watchId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await deleteWatch(getDb(), user.id, watchId);
  });
}

export async function unwatchEpisodeAction(episodeId: number): Promise<ActionResult<{ removed: RestorableWatch[] }>> {
  return run(async () => {
    const user = await me();
    return { removed: (await unwatchEpisode(getDb(), user.id, episodeId)).map(restorable) };
  });
}

export async function unwatchMovieAction(mediaId: number): Promise<ActionResult<{ removed: RestorableWatch[] }>> {
  return run(async () => {
    const user = await me();
    return { removed: (await unwatchMovie(getDb(), user.id, mediaId)).map(restorable) };
  });
}

/** Unmark every watched episode of a season. */
export async function unwatchSeasonAction(mediaId: number, seasonNumber: number): Promise<ActionResult<{ removed: RestorableWatch[]; episodes: Array<{ id: number; seasonNumber: number }> }>> {
  return run(async () => {
    const user = await me();
    const removed = await unwatchEpisodes(getDb(), user.id, mediaId, { seasonNumber });
    return { removed: removed.map(restorable), episodes: Array.from(new Set(removed.map((w) => w.episodeId!))).map((id) => ({ id, seasonNumber })) };
  });
}

/** Undo for any unwatch: put the removed viewings back. */
export async function restoreWatchesAction(rows: RestorableWatch[]): Promise<ActionResult<{ restored: number }>> {
  return run(async () => {
    const user = await me();
    return { restored: await restoreWatches(getDb(), user.id, rows) };
  });
}

export async function bulkMarkAction(mediaId: number, input: BulkMarkInput): Promise<ActionResult<{ marked: number; watchIds: string[]; episodes: Array<{ id: number; seasonNumber: number }> }>> {
  return run(async () => {
    const user = await me();
    return markEpisodesWatched(getDb(), user.id, mediaId, input);
  });
}

/** Undo for a bulk mark: remove exactly the viewings it created. */
export async function undoBulkMarkAction(watchIds: string[]): Promise<ActionResult<{ removed: number }>> {
  return run(async () => {
    const user = await me();
    return { removed: (await deleteWatches(getDb(), user.id, watchIds.slice(0, 5000))).length };
  });
}

/**
 * Everything the check-in sheet needs that the page may not have loaded:
 * the cast to pick a favourite from and the latest check-in to edit.
 */
export async function getCheckInContextAction(target: { episodeId: number } | { mediaId: number }): Promise<ActionResult<{ characters: CheckInCharacter[]; guestCharacters: CheckInCharacter[]; latest: CheckInInitial | null }>> {
  return run(async () => {
    const user = await me();
    const db = getDb();
    const pick = (c: { id: number; name: string; imageUrl: string | null; profilePath: string | null }): CheckInCharacter => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, profilePath: c.profilePath });
    if ('episodeId' in target) {
      const episode = await getEpisodeById(db, target.episodeId);
      if (!episode) throw errors.notFound('Episode');
      const [chars, latest] = await Promise.all([getCharactersForEpisode(db, episode.mediaId, episode.id), getLatestWatch(db, user.id, target)]);
      return { characters: chars.main.map(pick), guestCharacters: chars.guests.map(pick), latest: initialFrom(latest) };
    }
    const [chars, latest] = await Promise.all([getCharactersForMedia(db, target.mediaId, { limit: 40 }), getLatestWatch(db, user.id, target)]);
    return { characters: chars.map(pick), guestCharacters: [], latest: initialFrom(latest) };
  });
}

export async function trackShowAction(mediaId: number): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await trackShow(getDb(), user.id, mediaId);
  });
}

export async function untrackShowAction(mediaId: number): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await untrackShow(getDb(), user.id, mediaId);
  });
}

export async function setTrackingStatusAction(mediaId: number, status: 'watching' | 'on_hold' | 'dropped' | 'completed'): Promise<ActionResult> {
  return run(async () => {
    const user = await me();
    await setTrackingStatus(getDb(), user.id, mediaId, status);
  });
}

export async function toggleFavoriteShowAction(mediaId: number): Promise<ActionResult<{ favorite: boolean }>> {
  return run(async () => {
    const user = await me();
    return { favorite: await toggleFavoriteShow(getDb(), user.id, mediaId) };
  });
}

export async function toggleWatchlistAction(mediaId: number, inList: boolean): Promise<ActionResult<{ inList: boolean }>> {
  return run(async () => {
    const user = await me();
    if (inList) await removeFromWatchlist(getDb(), user.id, mediaId);
    else await addToWatchlist(getDb(), user.id, mediaId);
    return { inList: !inList };
  });
}
