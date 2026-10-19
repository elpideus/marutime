import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { activityTypeEnum, commentTargetEnum, notificationTypeEnum } from './enums';
import { lists } from './lists';
import { episodes, media } from './media';
import { users } from './users';

export type CommentImage = { url: string; width: number; height: number; alt?: string };

/**
 * Comments form a feed under each episode, movie and list. Replies reference
 * `parentId`; `rootId` points at the top-level comment for cheap thread loads.
 */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: commentTargetEnum('target_type').notNull(),
    episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
    mediaId: integer('media_id').references(() => media.id, { onDelete: 'cascade' }),
    listId: uuid('list_id').references(() => lists.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    rootId: uuid('root_id'),
    body: text('body').notNull(),
    isSpoiler: boolean('is_spoiler').notNull().default(false),
    images: jsonb('images').$type<CommentImage[]>().notNull().default([]),
    likeCount: integer('like_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenReason: text('hidden_reason'),
  },
  (t) => [
    index('comments_episode_idx').on(t.episodeId, t.createdAt),
    index('comments_media_idx').on(t.mediaId, t.createdAt),
    index('comments_list_idx').on(t.listId, t.createdAt),
    index('comments_root_idx').on(t.rootId, t.createdAt),
    index('comments_user_idx').on(t.userId),
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id], name: 'comments_parent_fk' }).onDelete('cascade'),
    foreignKey({ columns: [t.rootId], foreignColumns: [t.id], name: 'comments_root_fk' }).onDelete('cascade'),
    check(
      'comments_single_target',
      sql`(
        (case when ${t.episodeId} is null then 0 else 1 end) +
        (case when ${t.mediaId} is null then 0 else 1 end) +
        (case when ${t.listId} is null then 0 else 1 end)
      ) = 1`,
    ),
  ],
);

export const commentLikes = pgTable(
  'comment_likes',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] }), index('comment_likes_user_idx').on(t.userId)],
);

export const userFollows = pgTable(
  'user_follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index('user_follows_followee_idx').on(t.followeeId),
    check('user_follows_not_self', sql`${t.followerId} <> ${t.followeeId}`),
  ],
);

/** Public-safe activity stream entries (never include private check-in fields). */
export const activities = pgTable(
  'activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: activityTypeEnum('type').notNull(),
    mediaId: integer('media_id').references(() => media.id, { onDelete: 'cascade' }),
    episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
    listId: uuid('list_id').references(() => lists.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activities_user_created_idx').on(t.userId, t.createdAt), index('activities_created_idx').on(t.createdAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.readAt, t.createdAt)],
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
