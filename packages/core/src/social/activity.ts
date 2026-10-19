import {
  activities,
  and,
  desc,
  eq,
  gt,
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
export async function recordActivity(db: DbExecutor, input: ActivityInput): Promise<void> {
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
  if (dupe[0]) return;
  await db.insert(activities).values({
    userId: input.userId,
    type: input.type,
    mediaId: input.mediaId ?? null,
    episodeId: input.episodeId ?? null,
    listId: input.listId ?? null,
    targetUserId: input.targetUserId ?? null,
    meta: input.meta ?? {},
  });
}
