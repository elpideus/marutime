import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { userRoleEnum, userStatusEnum } from './enums';

export type SocialLink = { platform: string; url: string; label?: string };

export type UserPreferences = {
  theme?: 'dark' | 'light' | 'system';
  listsCategory?: 'shows' | 'movies' | 'anime';
  profileVisibility?: 'public' | 'followers' | 'private';
  showActivity?: boolean;
  showStats?: boolean;
  hideSpoilersByDefault?: boolean;
  emailNotifications?: boolean;
  defaultDeviceId?: number | null;
  defaultServiceId?: number | null;
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    passwordHash: text('password_hash'),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    coverUrl: text('cover_url'),
    favoriteCharacterName: text('favorite_character_name'),
    favoriteCharacterMediaId: integer('favorite_character_media_id'),
    favoriteCharacterImageUrl: text('favorite_character_image_url'),
    socialLinks: jsonb('social_links').$type<SocialLink[]>().notNull().default([]),
    preferences: jsonb('preferences').$type<UserPreferences>().notNull().default({}),
    role: userRoleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    suspendedReason: text('suspended_reason'),
    ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true }),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
    isPrivate: boolean('is_private').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
    uniqueIndex('users_username_idx').on(t.username),
    index('users_role_idx').on(t.role),
    index('users_created_at_idx').on(t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** Public projection of a user; never leak email/password hash to clients. */
export type PublicUser = Pick<
  User,
  | 'id'
  | 'username'
  | 'displayName'
  | 'bio'
  | 'avatarUrl'
  | 'coverUrl'
  | 'favoriteCharacterName'
  | 'favoriteCharacterMediaId'
  | 'favoriteCharacterImageUrl'
  | 'socialLinks'
  | 'role'
  | 'isPrivate'
  | 'createdAt'
>;

export const publicUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  avatarUrl: users.avatarUrl,
  coverUrl: users.coverUrl,
  favoriteCharacterName: users.favoriteCharacterName,
  favoriteCharacterMediaId: users.favoriteCharacterMediaId,
  favoriteCharacterImageUrl: users.favoriteCharacterImageUrl,
  socialLinks: users.socialLinks,
  role: users.role,
  isPrivate: users.isPrivate,
  createdAt: users.createdAt,
};
