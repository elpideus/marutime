import type { MediaCategory } from '@marutime/config';
import { and, desc, eq, inArray, media, watchlist, type DbExecutor, type Media, type WatchlistEntry } from '@marutime/db';
import { errors } from '../errors';
import { mediaCategory } from '../media/category';
import { getMediaById } from '../media/queries';
import { recordActivity, removeActivities } from '../social/activity';

export async function addToWatchlist(db: DbExecutor, userId: string, mediaId: number, note?: string | null): Promise<WatchlistEntry> {
  const m = await getMediaById(db, mediaId);
  if (!m) throw errors.notFound('Title');
  const [row] = await db
    .insert(watchlist)
    .values({ userId, mediaId, note: note ?? null })
    .onConflictDoUpdate({ target: [watchlist.userId, watchlist.mediaId], set: { note: note ?? null } })
    .returning();
  await recordActivity(db, { userId, type: 'added_watchlist', mediaId });
  return row!;
}

export async function removeFromWatchlist(db: DbExecutor, userId: string, mediaId: number): Promise<void> {
  await db.delete(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.mediaId, mediaId)));
  await removeActivities(db, { userId, type: 'added_watchlist', mediaId });
}

export async function isInWatchlist(db: DbExecutor, userId: string, mediaId: number): Promise<boolean> {
  const rows = await db.select({ mediaId: watchlist.mediaId }).from(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.mediaId, mediaId))).limit(1);
  return rows.length > 0;
}

export async function getWatchlistIds(db: DbExecutor, userId: string, mediaIds: number[]): Promise<Set<number>> {
  if (mediaIds.length === 0) return new Set();
  const rows = await db.select({ mediaId: watchlist.mediaId }).from(watchlist).where(and(eq(watchlist.userId, userId), inArray(watchlist.mediaId, mediaIds)));
  return new Set(rows.map((r) => r.mediaId));
}

export type WatchlistItem = { entry: WatchlistEntry; media: Media; category: MediaCategory };

export async function getWatchlist(db: DbExecutor, userId: string, opts: { category?: MediaCategory | 'all' } = {}): Promise<WatchlistItem[]> {
  const rows = await db
    .select({ entry: watchlist, media })
    .from(watchlist)
    .innerJoin(media, eq(watchlist.mediaId, media.id))
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.addedAt));
  const items = rows.map((r) => ({ entry: r.entry, media: r.media, category: mediaCategory(r.media) }));
  if (!opts.category || opts.category === 'all') return items;
  return items.filter((i) => i.category === opts.category);
}
