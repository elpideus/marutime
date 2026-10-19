import {
  activities,
  and,
  desc,
  eq,
  gt,
  inArray,
  sql,
  type Activity,
  type DbExecutor,
} from '@marutime/db';

export type ActivityInput = {
  userId: string;
  type: Activity['type'];
  mediaId?: number | null;
  episodeId?: number | null;
  listId?: string | null;
  targetUserId?: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Append to the public activity stream. Never store private check-in fields
 * (device, service, emotions, favourite character) here.
 */
export async function recordActivity(db: DbExecutor, input: ActivityInput): Promise<string | null> {
  // Collapse rapid duplicates (e.g. double clicks) within one minute.
  const since = new Date(Date.now() - 60_000);
  const dupe = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.userId, input.userId),
        eq(activities.type, input.type),
        gt(activities.createdAt, since),
        input.mediaId ? eq(activities.mediaId, input.mediaId) : undefined,
        input.episodeId ? eq(activities.episodeId, input.episodeId) : undefined,
        input.listId ? eq(activities.listId, input.listId) : undefined,
        input.targetUserId ? eq(activities.targetUserId, input.targetUserId) : undefined,
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(1);
  if (dupe[0]) return dupe[0].id;
  const [row] = await db.insert(activities).values({
    userId: input.userId,
    type: input.type,
    mediaId: input.mediaId ?? null,
    episodeId: input.episodeId ?? null,
    listId: input.listId ?? null,
    targetUserId: input.targetUserId ?? null,
    meta: input.meta ?? {},
  }).returning({ id: activities.id });
  return row?.id ?? null;
}

export type ActivityFilter = {
  userId: string;
  type: Activity['type'] | Activity['type'][];
  mediaId?: number;
  episodeIds?: number[];
  listId?: string;
  targetUserId?: string;
  ids?: string[];
  /** Match `meta.commentId`. */
  commentId?: string;
};

/**
 * Take back activities when the action behind them is undone (unwatched,
 * unfollowed, unliked, deleted), so friends never see things that did not
 * stick.
 */
export async function removeActivities(db: DbExecutor, filter: ActivityFilter): Promise<number> {
  if (filter.episodeIds && filter.episodeIds.length === 0) return 0;
  if (filter.ids && filter.ids.length === 0) return 0;
  const types = Array.isArray(filter.type) ? filter.type : [filter.type];
  const rows = await db
    .delete(activities)
    .where(
      and(
        eq(activities.userId, filter.userId),
        inArray(activities.type, types),
        filter.mediaId !== undefined ? eq(activities.mediaId, filter.mediaId) : undefined,
        filter.episodeIds ? inArray(activities.episodeId, filter.episodeIds) : undefined,
        filter.listId !== undefined ? eq(activities.listId, filter.listId) : undefined,
        filter.targetUserId !== undefined ? eq(activities.targetUserId, filter.targetUserId) : undefined,
        filter.ids ? inArray(activities.id, filter.ids) : undefined,
        filter.commentId !== undefined ? sql`${activities.meta}->>'commentId' = ${filter.commentId}` : undefined,
      ),
    )
    .returning({ id: activities.id });
  return rows.length;
}
