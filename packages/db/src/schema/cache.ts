import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Shared second-level cache for responses from slow or rate-limited upstreams
 * (TMDB lists, people, AniList). Every server instance reads it, so a value
 * is fetched once and reused until `staleUntil`. Between `freshUntil` and
 * `staleUntil` the old value is served while one instance refreshes it.
 * Also holds short-lived leases (keys starting with `lease:`).
 */
export const cacheEntries = pgTable(
  'cache_entries',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').$type<unknown>().notNull(),
    freshUntil: timestamp('fresh_until', { withTimezone: true }).notNull(),
    staleUntil: timestamp('stale_until', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('cache_entries_stale_until_idx').on(t.staleUntil)],
);

export type CacheEntry = typeof cacheEntries.$inferSelect;
