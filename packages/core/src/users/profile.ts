import { LIMITS, type ProfileVisibility } from '@marutime/config';
import {
  and,
  count,
  eq,
  isNotNull,
  isNull,
  lists,
  publicUserColumns,
  sql,
  userFollows,
  users,
  watches,
  type DbExecutor,
  type PublicUser,
  type User,
  type UserPreferences,
} from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { parseInput, safeUrl } from '../utils';
import { bioSchema, displayNameSchema, socialLinksSchema, usernameSchema } from '../validation';
import { isUsernameTaken } from './username';

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  displayName: displayNameSchema.optional(),
  bio: bioSchema.optional(),
  favoriteCharacterName: z.string().trim().max(LIMITS.favoriteCharacterMax).nullable().optional(),
  favoriteCharacterMediaId: z.number().int().positive().nullable().optional(),
  favoriteCharacterImageUrl: z.string().max(400).nullable().optional(),
  socialLinks: socialLinksSchema.optional(),
  isPrivate: z.boolean().optional(),
});

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  listsCategory: z.enum(['shows', 'movies', 'anime']).optional(),
  profileVisibility: z.enum(['public', 'followers', 'private']).optional(),
  showActivity: z.boolean().optional(),
  showStats: z.boolean().optional(),
  hideSpoilersByDefault: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  defaultDeviceId: z.number().int().nullable().optional(),
  defaultServiceId: z.number().int().nullable().optional(),
});

export async function updateProfile(db: DbExecutor, userId: string, rawInput: UpdateProfileInput): Promise<User> {
  const input = parseInput(updateProfileSchema, rawInput);
  if (input.username) {
    const [current] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1);
    if (current && current.username !== input.username && (await isUsernameTaken(db, input.username))) {
      throw errors.conflict('That username is taken');
    }
  }
  const socialLinks = input.socialLinks?.map((l) => ({ ...l, url: safeUrl(l.url) ?? '' })).filter((l) => l.url);
  const [user] = await db
    .update(users)
    .set({
      ...(input.username !== undefined ? { username: input.username } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
      ...(input.favoriteCharacterName !== undefined ? { favoriteCharacterName: input.favoriteCharacterName || null } : {}),
      ...(input.favoriteCharacterMediaId !== undefined ? { favoriteCharacterMediaId: input.favoriteCharacterMediaId } : {}),
      ...(input.favoriteCharacterImageUrl !== undefined ? { favoriteCharacterImageUrl: input.favoriteCharacterImageUrl } : {}),
      ...(socialLinks !== undefined ? { socialLinks } : {}),
      ...(input.isPrivate !== undefined ? { isPrivate: input.isPrivate } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw errors.notFound('User');
  return user;
}

export async function updatePreferences(db: DbExecutor, userId: string, rawPatch: unknown): Promise<UserPreferences> {
  const patch = parseInput(preferencesSchema, rawPatch);
  const [current] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
  const next: UserPreferences = { ...(current?.preferences ?? {}), ...patch };
  await db.update(users).set({ preferences: next, isPrivate: patch.profileVisibility ? patch.profileVisibility !== 'public' : undefined, updatedAt: new Date() }).where(eq(users.id, userId));
  return next;
}

export type ProfileView = {
  user: PublicUser;
  stats: { followers: number; following: number; episodes: number; movies: number; minutes: number; lists: number };
  viewer: { isSelf: boolean; isFollowing: boolean; canViewContent: boolean };
  visibility: ProfileVisibility;
};

export async function isFollowing(db: DbExecutor, followerId: string, followeeId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql`1` })
    .from(userFollows)
    .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followeeId, followeeId)))
    .limit(1);
  return rows.length > 0;
}

export async function getProfile(db: DbExecutor, username: string, viewerId: string | null): Promise<ProfileView | null> {
  const [row] = await db
    .select({ ...publicUserColumns, preferences: users.preferences, status: users.status })
    .from(users)
    .where(and(eq(users.username, username.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);
  if (!row || row.status === 'deleted') return null;
  const { preferences, status: _status, ...user } = row;
  const visibility: ProfileVisibility = preferences.profileVisibility ?? (user.isPrivate ? 'followers' : 'public');
  const isSelf = viewerId === user.id;
  const following = viewerId && !isSelf ? await isFollowing(db, viewerId, user.id) : false;
  const canViewContent = isSelf || visibility === 'public' || (visibility === 'followers' && following);

  const [followers] = await db.select({ n: count() }).from(userFollows).where(eq(userFollows.followeeId, user.id));
  const [followingCount] = await db.select({ n: count() }).from(userFollows).where(eq(userFollows.followerId, user.id));
  const [episodes] = await db.select({ n: count() }).from(watches).where(and(eq(watches.userId, user.id), isNotNull(watches.episodeId)));
  const [movies] = await db.select({ n: count() }).from(watches).where(and(eq(watches.userId, user.id), isNull(watches.episodeId)));
  const [minutes] = await db
    .select({ n: sql<number>`coalesce(sum(coalesce(e.runtime, m.runtime, 0)), 0)::int` })
    .from(watches)
    .leftJoin(sql`episodes e`, sql`e.id = ${watches.episodeId}`)
    .leftJoin(sql`media m`, sql`m.id = ${watches.mediaId}`)
    .where(eq(watches.userId, user.id));
  const [listCount] = await db
    .select({ n: count() })
    .from(lists)
    .where(and(eq(lists.ownerId, user.id), isNull(lists.deletedAt), isSelf ? sql`true` : eq(lists.visibility, 'public')));

  return {
    user,
    stats: {
      followers: followers?.n ?? 0,
      following: followingCount?.n ?? 0,
      episodes: episodes?.n ?? 0,
      movies: movies?.n ?? 0,
      minutes: Number(minutes?.n ?? 0),
      lists: listCount?.n ?? 0,
    },
    viewer: { isSelf, isFollowing: following, canViewContent },
    visibility,
  };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    favoriteCharacterName: user.favoriteCharacterName,
    favoriteCharacterMediaId: user.favoriteCharacterMediaId,
    favoriteCharacterImageUrl: user.favoriteCharacterImageUrl,
    socialLinks: user.socialLinks,
    role: user.role,
    isPrivate: user.isPrivate,
    createdAt: user.createdAt,
  };
}
