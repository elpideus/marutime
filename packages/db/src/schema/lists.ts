import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listCategoryEnum, listVisibilityEnum } from './enums';
import { media } from './media';
import { users } from './users';

export const lists = pgTable(
  'lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    coverUrl: text('cover_url'),
    visibility: listVisibilityEnum('visibility').notNull().default('public'),
    shareToken: text('share_token').notNull(),
    category: listCategoryEnum('category').notNull().default('mixed'),
    isRanked: boolean('is_ranked').notNull().default(false),
    likeCount: integer('like_count').notNull().default(0),
    itemCount: integer('item_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('lists_owner_slug_idx').on(t.ownerId, t.slug),
    uniqueIndex('lists_share_token_idx').on(t.shareToken),
    index('lists_visibility_category_idx').on(t.visibility, t.category, t.likeCount),
    index('lists_owner_idx').on(t.ownerId),
  ],
);

export const listItems = pgTable(
  'list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    note: text('note'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('list_items_list_media_idx').on(t.listId, t.mediaId), index('list_items_media_idx').on(t.mediaId)],
);

export const listLikes = pgTable(
  'list_likes',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.listId, t.userId] }), index('list_likes_user_idx').on(t.userId)],
);

export type List = typeof lists.$inferSelect;
export type NewList = typeof lists.$inferInsert;
export type ListItem = typeof listItems.$inferSelect;
