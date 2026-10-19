import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { trackingStatusEnum, watchSourceEnum } from './enums';
import { episodes, media, characters } from './media';
import { users } from './users';

/** Devices a viewer can report watching on. Admin-editable. */
export const devices = pgTable('devices', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  icon: text('icon'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

/** Streaming services / sources. Admin-editable. */
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  color: text('color'),
  iconUrl: text('icon_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

/**
 * A show the user is following. Progress ("watch next", "up to date") is
 * derived from `watches`; this row holds the user's intent and overrides.
 */
export const showTracking = pgTable(
  'show_tracking',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    status: trackingStatusEnum('status').notNull().default('watching'),
    isFavorite: boolean('is_favorite').notNull().default(false),
    lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.mediaId] }),
    index('show_tracking_user_status_idx').on(t.userId, t.status),
    index('show_tracking_media_idx').on(t.mediaId),
  ],
);

/** "I want to watch this" for shows and movies. */
export const watchlist = pgTable(
  'watchlist',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    note: text('note'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mediaId] }), index('watchlist_media_idx').on(t.mediaId)],
);

/**
 * One row per viewing. Rewatches create additional rows.
 * `deviceId`, `serviceId`, `emotions` and `favoriteCharacterId` are private:
 * they feed anonymous aggregate stats and are never shown attributed to a user.
 */
export const watches = pgTable(
  'watches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    episodeId: integer('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
    watchedAt: timestamp('watched_at', { withTimezone: true }).notNull().defaultNow(),
    deviceId: integer('device_id').references(() => devices.id, { onDelete: 'set null' }),
    serviceId: integer('service_id').references(() => services.id, { onDelete: 'set null' }),
    emotions: jsonb('emotions').$type<string[]>().notNull().default([]),
    favoriteCharacterId: integer('favorite_character_id').references(() => characters.id, {
      onDelete: 'set null',
    }),
    rating: smallint('rating'),
    note: text('note'),
    source: watchSourceEnum('source').notNull().default('web'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('watches_user_media_idx').on(t.userId, t.mediaId),
    index('watches_user_episode_idx').on(t.userId, t.episodeId),
    index('watches_episode_idx').on(t.episodeId),
    index('watches_media_idx').on(t.mediaId),
    index('watches_user_watched_at_idx').on(t.userId, t.watchedAt),
  ],
);

export type Device = typeof devices.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ShowTracking = typeof showTracking.$inferSelect;
export type WatchlistEntry = typeof watchlist.$inferSelect;
export type Watch = typeof watches.$inferSelect;
export type NewWatch = typeof watches.$inferInsert;
