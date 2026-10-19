import 'server-only';

import { ensureMedia, getListsForPicker, isAppError, isInWatchlist, parseMediaParam } from '@marutime/core';
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
