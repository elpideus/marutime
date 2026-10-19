import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export type ImportSource = 'tvtime' | 'anilist';
export type ImportStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ImportJobStats = {
  shows: number;
  movies: number;
  /** Viewings added (episodes and movies, rewatches included). */
  watches: number;
  watchlist: number;
  lists: number;
  /** Episodes in the source that have no match upstream (specials, renumbered seasons). */
  skippedEpisodes: number;
  unmatched: Array<{ kind: 'show' | 'movie'; title: string; reason: string }>;
};

/**
 * An import from another tracker. The normalised items wait in `payload`
 * and are worked through in short steps (resumable, so a closed tab or a
 * serverless timeout only pauses it); `cursor` is the next item to import.
 */
export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').$type<ImportSource>().notNull(),
    label: text('label').notNull(),
    status: text('status').$type<ImportStatus>().notNull().default('pending'),
    payload: jsonb('payload').$type<unknown[]>(),
    cursor: integer('cursor').notNull().default(0),
    total: integer('total').notNull().default(0),
    stats: jsonb('stats').$type<ImportJobStats>().notNull(),
    /** Item key → media id, so imported lists can point at what was matched. */
    resolved: jsonb('resolved').$type<Record<string, number>>().notNull().default({}),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('import_jobs_user_idx').on(t.userId, t.createdAt)],
);

export type ImportJob = typeof importJobs.$inferSelect;
