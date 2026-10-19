'use server';

import {
  addToWatchlist,
  checkInEpisode,
  checkInMovie,
  errors,
  markEpisodesWatched,
  removeFromWatchlist,
  setTrackingStatus,
  trackShow,
  unwatchEpisode,
  unwatchMovie,
  untrackShow,
  updateWatch,
  deleteWatch,
  toggleFavoriteShow,
  type CheckInInput,
  type BulkMarkInput,
} from '@marutime/core';
import { getDb } from '@marutime/db';
import { run, type ActionResult } from '@/lib/action';
import { getCurrentUser } from '@/lib/session';

async function me() {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthorized();
  if (user.status !== 'active') throw errors.forbidden('Your account is suspended');
  return user;
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

export async function unwatchEpisodeAction(episodeId: number): Promise<ActionResult<{ removed: number }>> {
  return run(async () => {
    const user = await me();
    return { removed: await unwatchEpisode(getDb(), user.id, episodeId) };
  });
}

export async function unwatchMovieAction(mediaId: number): Promise<ActionResult<{ removed: number }>> {
  return run(async () => {
    const user = await me();
    return { removed: await unwatchMovie(getDb(), user.id, mediaId) };
  });
}

export async function bulkMarkAction(mediaId: number, input: BulkMarkInput): Promise<ActionResult<{ marked: number }>> {
  return run(async () => {
    const user = await me();
    return markEpisodesWatched(getDb(), user.id, mediaId, input);
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
