import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { characterKindEnum, mediaTypeEnum } from './enums';

export type MediaGenre = { id: number; name: string };
export type MediaNetwork = { id: number; name: string; logoPath: string | null };

/**
 * A show or a movie. `provider` + `externalId` identify the record at the
 * metadata source (TMDB by default) so other providers can be added later.
 */
export const media = pgTable(
  'media',
  {
    id: serial('id').primaryKey(),
    type: mediaTypeEnum('type').notNull(),
    provider: text('provider').notNull().default('tmdb'),
    externalId: integer('external_id').notNull(),
    imdbId: text('imdb_id'),
    tvdbId: integer('tvdb_id'),
    title: text('title').notNull(),
    originalTitle: text('original_title'),
    slug: text('slug').notNull(),
    overview: text('overview'),
    tagline: text('tagline'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    releaseDate: date('release_date'),
    lastAirDate: date('last_air_date'),
    nextEpisodeAirDate: date('next_episode_air_date'),
    status: text('status'),
    genres: jsonb('genres').$type<MediaGenre[]>().notNull().default([]),
    networks: jsonb('networks').$type<MediaNetwork[]>().notNull().default([]),
    originCountries: jsonb('origin_countries').$type<string[]>().notNull().default([]),
    originalLanguage: text('original_language'),
    isAnime: boolean('is_anime').notNull().default(false),
    runtime: integer('runtime'),
    seasonCount: integer('season_count'),
    episodeCount: integer('episode_count'),
    popularity: real('popularity').notNull().default(0),
    voteAverage: real('vote_average').notNull().default(0),
    voteCount: integer('vote_count').notNull().default(0),
    homepage: text('homepage'),
    trailerKey: text('trailer_key'),
    certification: text('certification'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('media_provider_external_idx').on(t.provider, t.externalId, t.type),
    index('media_type_idx').on(t.type),
    index('media_anime_idx').on(t.isAnime),
    index('media_popularity_idx').on(t.popularity),
    index('media_title_idx').on(t.title),
  ],
);

export const seasons = pgTable(
  'seasons',
  {
    id: serial('id').primaryKey(),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    externalId: integer('external_id'),
    name: text('name'),
    overview: text('overview'),
    posterPath: text('poster_path'),
    airDate: date('air_date'),
    episodeCount: integer('episode_count').notNull().default(0),
  },
  (t) => [uniqueIndex('seasons_media_number_idx').on(t.mediaId, t.seasonNumber)],
);

export const episodes = pgTable(
  'episodes',
  {
    id: serial('id').primaryKey(),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    seasonId: integer('season_id')
      .notNull()
      .references(() => seasons.id, { onDelete: 'cascade' }),
    seasonNumber: integer('season_number').notNull(),
    episodeNumber: integer('episode_number').notNull(),
    externalId: integer('external_id'),
    name: text('name'),
    overview: text('overview'),
    stillPath: text('still_path'),
    airDate: date('air_date'),
    runtime: integer('runtime'),
    voteAverage: real('vote_average').notNull().default(0),
    guestStarsSyncedAt: timestamp('guest_stars_synced_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('episodes_media_season_episode_idx').on(t.mediaId, t.seasonNumber, t.episodeNumber),
    index('episodes_media_air_date_idx').on(t.mediaId, t.airDate),
    index('episodes_air_date_idx').on(t.airDate),
  ],
);

/**
 * Characters of a show or movie, used for "favorite character" picks.
 * `source` is the metadata provider the row came from (tmdb, anilist) and
 * `externalKey` is stable within that source so re-syncs upsert cleanly.
 */
export const characters = pgTable(
  'characters',
  {
    id: serial('id').primaryKey(),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('tmdb'),
    externalKey: text('external_key').notNull(),
    externalPersonId: integer('external_person_id'),
    externalCharacterId: integer('external_character_id'),
    name: text('name').notNull(),
    nativeName: text('native_name'),
    actorName: text('actor_name'),
    profilePath: text('profile_path'),
    imageUrl: text('image_url'),
    role: text('role'),
    sortOrder: integer('sort_order').notNull().default(0),
    kind: characterKindEnum('kind').notNull().default('main'),
    episodeCount: integer('episode_count'),
  },
  (t) => [
    uniqueIndex('characters_media_source_key_idx').on(t.mediaId, t.source, t.externalKey),
    index('characters_media_idx').on(t.mediaId),
  ],
);

/** Guest characters appearing in a specific episode. */
export const episodeCharacters = pgTable(
  'episode_characters',
  {
    episodeId: integer('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    characterId: integer('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.characterId] })],
);

export type AnimeTag = { name: string; rank: number; isSpoiler: boolean };
export type AnimeStudio = { name: string; isMain: boolean };

/** AniList enrichment for anime titles, keyed by our media row. */
export const animeDetails = pgTable(
  'anime_details',
  {
    mediaId: integer('media_id')
      .primaryKey()
      .references(() => media.id, { onDelete: 'cascade' }),
    anilistId: integer('anilist_id').notNull(),
    malId: integer('mal_id'),
    titleRomaji: text('title_romaji'),
    titleEnglish: text('title_english'),
    titleNative: text('title_native'),
    format: text('format'),
    status: text('status'),
    season: text('season'),
    seasonYear: integer('season_year'),
    episodes: integer('episodes'),
    duration: integer('duration'),
    averageScore: integer('average_score'),
    meanScore: integer('mean_score'),
    popularity: integer('popularity'),
    favourites: integer('favourites'),
    genres: jsonb('genres').$type<string[]>().notNull().default([]),
    tags: jsonb('tags').$type<AnimeTag[]>().notNull().default([]),
    studios: jsonb('studios').$type<AnimeStudio[]>().notNull().default([]),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    bannerImageUrl: text('banner_image_url'),
    color: text('color'),
    siteUrl: text('site_url'),
    nextAiringAt: timestamp('next_airing_at', { withTimezone: true }),
    nextAiringEpisode: integer('next_airing_episode'),
    matchConfidence: real('match_confidence').notNull().default(0),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('anime_details_anilist_idx').on(t.anilistId)],
);

export type Media = typeof media.$inferSelect;
export type AnimeDetails = typeof animeDetails.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Season = typeof seasons.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type Character = typeof characters.$inferSelect;
