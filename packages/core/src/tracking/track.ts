import { and, eq, showTracking, type DbExecutor, type ShowTracking } from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { getMediaById } from '../media/queries';
import { parseInput } from '../utils';

export const trackingStatusSchema = z.enum(['watching', 'on_hold', 'dropped', 'completed']);

export async function getTracking(db: DbExecutor, userId: string, mediaId: number): Promise<ShowTracking | null> {
  const rows = await db.select().from(showTracking).where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, mediaId))).limit(1);
  return rows[0] ?? null;
}

/** Follow a show so it appears in "watch next" and "upcoming". */
export async function trackShow(db: DbExecutor, userId: string, mediaId: number): Promise<ShowTracking> {
  const m = await getMediaById(db, mediaId);
  if (!m || m.type !== 'show') throw errors.notFound('Show');
  const [row] = await db
    .insert(showTracking)
    .values({ userId, mediaId, status: 'watching' })
    .onConflictDoUpdate({ target: [showTracking.userId, showTracking.mediaId], set: { status: 'watching', updatedAt: new Date() } })
    .returning();
  return row!;
}

export async function untrackShow(db: DbExecutor, userId: string, mediaId: number): Promise<void> {
  await db.delete(showTracking).where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, mediaId)));
}

export async function setTrackingStatus(db: DbExecutor, userId: string, mediaId: number, rawStatus: unknown): Promise<ShowTracking> {
  const status = parseInput(trackingStatusSchema, rawStatus);
  const [row] = await db
    .insert(showTracking)
    .values({ userId, mediaId, status })
    .onConflictDoUpdate({ target: [showTracking.userId, showTracking.mediaId], set: { status, updatedAt: new Date() } })
    .returning();
  return row!;
}

export async function toggleFavoriteShow(db: DbExecutor, userId: string, mediaId: number): Promise<boolean> {
  const current = await getTracking(db, userId, mediaId);
  if (!current) {
    await db.insert(showTracking).values({ userId, mediaId, status: 'watching', isFavorite: true });
    return true;
  }
  await db.update(showTracking).set({ isFavorite: !current.isFavorite, updatedAt: new Date() }).where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, mediaId)));
  return !current.isFavorite;
}
