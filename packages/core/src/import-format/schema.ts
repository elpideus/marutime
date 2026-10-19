import { z } from 'zod';

/**
 * The normalised shape every importer produces. Browser-safe: the TV Time
 * zip is unpacked and parsed client-side, and only this (much smaller) shape
 * is sent to the server, which validates it again.
 */

export const IMPORT_LIMITS = { items: 6000, viewingsPerShow: 6000, viewings: 150_000, listItems: 1000 } as const;

/** Epoch seconds (2100 at the latest), or null when the source has no date. */
const epoch = z.number().int().min(0).max(4_102_444_800).nullable();
const key = z.string().min(1).max(80);
const title = z.string().max(300);

/** One viewing: [season, episode, watchedAt, TheTVDB episode id]. Rewatches repeat the episode. */
export const episodeViewingSchema = z.tuple([z.number().int().min(0).max(5000), z.number().int().min(0).max(100_000), epoch, z.number().int().positive().nullable()]);

/**
 * "The first `count` episodes after `offset`" of a season (or of the whole
 * show in airing order when `season` is null), as trackers like AniList
 * record progress. `year`, when set, is the year the source says this part
 * started; the episodes are only placed if the matched show agrees.
 */
export const progressSchema = z.object({
  season: z.number().int().min(0).nullable(),
  offset: z.number().int().min(0).max(100_000),
  count: z.number().int().min(0).max(IMPORT_LIMITS.viewingsPerShow),
  watchedAt: epoch,
  year: z.number().int().optional(),
});

const ids = z.object({
  tmdb: z.number().int().positive().optional(),
  tvdb: z.number().int().positive().optional(),
  imdb: z.string().regex(/^tt\d+$/).optional(),
  anilist: z.number().int().positive().optional(),
});

export const importShowSchema = z.object({
  kind: z.literal('show'),
  key,
  title,
  altTitles: z.array(title).max(5).default([]),
  year: z.number().int().optional(),
  ids,
  /** Explicit status from the source; otherwise derived from what was watched. */
  status: z.enum(['watching', 'on_hold', 'dropped', 'completed']).optional(),
  follow: z.boolean().default(false),
  watchlist: z.boolean().default(false),
  favorite: z.boolean().default(false),
  addedAt: epoch.optional(),
  episodes: z.array(episodeViewingSchema).max(IMPORT_LIMITS.viewingsPerShow).default([]),
  progress: z.array(progressSchema).max(100).default([]),
});

export const importMovieSchema = z.object({
  kind: z.literal('movie'),
  key,
  title,
  altTitles: z.array(title).max(5).default([]),
  year: z.number().int().optional(),
  /** Minutes; helps pick between remakes with the same title. */
  runtime: z.number().int().positive().optional(),
  ids,
  watches: z.array(epoch).max(200).default([]),
  watchlist: z.boolean().default(false),
  /** 1–10. */
  rating: z.number().min(1).max(10).optional(),
});

export const importListSchema = z.object({
  kind: z.literal('list'),
  key,
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  /** Keys of shows and movies in this import, in list order. */
  items: z.array(key).max(IMPORT_LIMITS.listItems),
});

export const importItemSchema = z.discriminatedUnion('kind', [importShowSchema, importMovieSchema, importListSchema]);

export const importItemsSchema = z
  .array(importItemSchema)
  .min(1, 'Nothing to import')
  .max(IMPORT_LIMITS.items)
  .refine((items) => items.reduce((n, i) => n + (i.kind === 'show' ? i.episodes.length : i.kind === 'movie' ? i.watches.length : 0), 0) <= IMPORT_LIMITS.viewings, 'That is more history than one import can take');

export type ImportShow = z.output<typeof importShowSchema>;
export type ImportMovie = z.output<typeof importMovieSchema>;
export type ImportList = z.output<typeof importListSchema>;
export type ImportItem = z.output<typeof importItemSchema>;
export type ImportItemInput = z.input<typeof importItemSchema>;

export type ImportSummary = { shows: number; movies: number; viewings: number; watchlist: number; lists: number };

export function summarize(items: ImportItemInput[]): ImportSummary {
  const s: ImportSummary = { shows: 0, movies: 0, viewings: 0, watchlist: 0, lists: 0 };
  for (const i of items) {
    if (i.kind === 'show') {
      s.shows++;
      s.viewings += (i.episodes?.length ?? 0) + (i.progress ?? []).reduce((n, p) => n + p.count, 0);
      if (i.watchlist) s.watchlist++;
    } else if (i.kind === 'movie') {
      s.movies++;
      s.viewings += i.watches?.length ?? 0;
      if (i.watchlist) s.watchlist++;
    } else s.lists++;
  }
  return s;
}
