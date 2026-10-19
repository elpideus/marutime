import {
  activities,
  and,
  desc,
  episodes,
  eq,
  inArray,
  lists,
  lt,
  media,
  publicUserColumns,
  sql,
  users,
  alias,
  type Activity,
  type DbExecutor,
  type Episode,
  type List,
  type Media,
  type PublicUser,
} from '@marutime/db';
import { getFollowingIds } from './follows';

export type FeedItem = {
  activity: Activity;
  user: PublicUser;
  media: Media | null;
  episode: Episode | null;
  list: Pick<List, 'id' | 'title' | 'slug' | 'visibility' | 'ownerId'> | null;
  targetUser: PublicUser | null;
};

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

const targetUsers = alias(users, 'target_users');

async function loadFeed(db: DbExecutor, where: ReturnType<typeof and>, limit: number): Promise<FeedPage> {
  const rows = await db
    .select({
      activity: activities,
      user: publicUserColumns,
      preferences: users.preferences,
      media,
      episode: episodes,
      list: { id: lists.id, title: lists.title, slug: lists.slug, visibility: lists.visibility, ownerId: lists.ownerId, deletedAt: lists.deletedAt },
      targetUser: {
        id: targetUsers.id,
        username: targetUsers.username,
        displayName: targetUsers.displayName,
        bio: targetUsers.bio,
        avatarUrl: targetUsers.avatarUrl,
        coverUrl: targetUsers.coverUrl,
        favoriteCharacterName: targetUsers.favoriteCharacterName,
        favoriteCharacterMediaId: targetUsers.favoriteCharacterMediaId,
        favoriteCharacterImageUrl: targetUsers.favoriteCharacterImageUrl,
        socialLinks: targetUsers.socialLinks,
        role: targetUsers.role,
        isPrivate: targetUsers.isPrivate,
        createdAt: targetUsers.createdAt,
      },
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .leftJoin(media, eq(activities.mediaId, media.id))
    .leftJoin(episodes, eq(activities.episodeId, episodes.id))
    .leftJoin(lists, eq(activities.listId, lists.id))
    .leftJoin(targetUsers, eq(activities.targetUserId, targetUsers.id))
    .where(where)
    .orderBy(desc(activities.createdAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const items: FeedItem[] = page
    .filter((r) => r.preferences.showActivity !== false)
    .filter((r) => !r.list || !r.list.id || (r.list.visibility === 'public' && !r.list.deletedAt))
    .map((r) => ({
      activity: r.activity,
      user: r.user as PublicUser,
      media: r.media,
      episode: r.episode,
      list: r.list && r.list.id ? { id: r.list.id, title: r.list.title, slug: r.list.slug, visibility: r.list.visibility, ownerId: r.list.ownerId } : null,
      targetUser: r.targetUser && r.targetUser.id ? (r.targetUser as PublicUser) : null,
    }));
  const last = page[page.length - 1];
  return { items, nextCursor: rows.length > limit && last ? last.activity.createdAt.toISOString() : null };
}

/** Activities from people the user follows (never their own: that is what the profile is for). */
export async function getHomeFeed(db: DbExecutor, userId: string, opts: { limit?: number; before?: string | null } = {}): Promise<FeedPage> {
  const limit = Math.min(opts.limit ?? 25, 60);
  const ids = (await getFollowingIds(db, userId)).filter((id) => id !== userId);
  if (ids.length === 0) return { items: [], nextCursor: null };
  const where = and(inArray(activities.userId, ids), opts.before ? lt(activities.createdAt, new Date(opts.before)) : undefined, eq(users.status, 'active'));
  return loadFeed(db, where, limit);
}

export async function getUserActivity(db: DbExecutor, targetUserId: string, opts: { limit?: number; before?: string | null } = {}): Promise<FeedPage> {
  const limit = Math.min(opts.limit ?? 25, 60);
  const where = and(eq(activities.userId, targetUserId), opts.before ? lt(activities.createdAt, new Date(opts.before)) : undefined);
  return loadFeed(db, where, limit);
}

/** Public, site-wide recent activity (used on the landing page when logged out). */
export async function getGlobalActivity(db: DbExecutor, limit = 20): Promise<FeedPage> {
  const where = and(eq(users.status, 'active'), eq(users.isPrivate, false), sql`${users.deletedAt} is null`);
  return loadFeed(db, where, limit);
}
