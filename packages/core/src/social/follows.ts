import { and, count, desc, eq, inArray, publicUserColumns, userFollows, users, type DbExecutor, type PublicUser } from '@marutime/db';
import { errors } from '../errors';
import { recordActivity } from './activity';
import { createNotification } from './notifications';

export async function followUser(db: DbExecutor, followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) throw errors.validation('You cannot follow yourself');
  const [target] = await db.select({ id: users.id, status: users.status }).from(users).where(eq(users.id, followeeId)).limit(1);
  if (!target || target.status !== 'active') throw errors.notFound('User');
  const inserted = await db.insert(userFollows).values({ followerId, followeeId }).onConflictDoNothing().returning({ followerId: userFollows.followerId });
  if (inserted.length === 0) return;
  await createNotification(db, { userId: followeeId, type: 'new_follower', actorId: followerId });
  await recordActivity(db, { userId: followerId, type: 'followed_user', targetUserId: followeeId });
}

export async function unfollowUser(db: DbExecutor, followerId: string, followeeId: string): Promise<void> {
  await db.delete(userFollows).where(and(eq(userFollows.followerId, followerId), eq(userFollows.followeeId, followeeId)));
}

export async function getFollowers(db: DbExecutor, userId: string, limit = 50, offset = 0): Promise<PublicUser[]> {
  const rows = await db
    .select(publicUserColumns)
    .from(userFollows)
    .innerJoin(users, eq(userFollows.followerId, users.id))
    .where(eq(userFollows.followeeId, userId))
    .orderBy(desc(userFollows.createdAt))
    .limit(limit)
    .offset(offset);
  return rows as PublicUser[];
}

export async function getFollowing(db: DbExecutor, userId: string, limit = 50, offset = 0): Promise<PublicUser[]> {
  const rows = await db
    .select(publicUserColumns)
    .from(userFollows)
    .innerJoin(users, eq(userFollows.followeeId, users.id))
    .where(eq(userFollows.followerId, userId))
    .orderBy(desc(userFollows.createdAt))
    .limit(limit)
    .offset(offset);
  return rows as PublicUser[];
}

export async function getFollowingIds(db: DbExecutor, userId: string): Promise<string[]> {
  const rows = await db.select({ id: userFollows.followeeId }).from(userFollows).where(eq(userFollows.followerId, userId));
  return rows.map((r) => r.id);
}

export async function getFollowStateForUsers(db: DbExecutor, viewerId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .select({ id: userFollows.followeeId })
    .from(userFollows)
    .where(and(eq(userFollows.followerId, viewerId), inArray(userFollows.followeeId, userIds)));
  return new Set(rows.map((r) => r.id));
}

export async function getFollowCounts(db: DbExecutor, userId: string): Promise<{ followers: number; following: number }> {
  const [a] = await db.select({ n: count() }).from(userFollows).where(eq(userFollows.followeeId, userId));
  const [b] = await db.select({ n: count() }).from(userFollows).where(eq(userFollows.followerId, userId));
  return { followers: a?.n ?? 0, following: b?.n ?? 0 };
}
