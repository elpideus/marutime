import {
  and,
  animeDetails,
  characters,
  episodeCharacters,
  episodes,
  eq,
  media,
  seasons,
  type DbExecutor,
  type Media,
} from '@marutime/db';
import {
  AniListClient,
  getMetadataProvider,
  type AnimeEnrichment,
  type CastMember,
  type MediaDetails,
  type MetadataProvider,
  type ShowDetails,
} from '@marutime/metadata';
import { sql } from 'drizzle-orm';
import { errors } from '../errors';
import { chunk } from '../utils';

/** Reference the proposed row inside ON CONFLICT DO UPDATE. */
const excluded = (column: string) => sql.raw(`excluded.${column}`);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type EnsureMediaOptions = {
  force?: boolean;
  provider?: MetadataProvider;
  anilist?: AniListClient | null;
  /** Skip AniList enrichment (e.g. in bulk jobs). */
  skipEnrichment?: boolean;
};

function ttlFor(row: Pick<Media, 'type' | 'status' | 'releaseDate' | 'nextEpisodeAirDate'>): number {
  if (row.type === 'movie') {
    const upcoming = row.releaseDate && row.releaseDate >= new Date().toISOString().slice(0, 10);
    return upcoming ? DAY : 7 * DAY;
  }
  if (row.status === 'Ended' || row.status === 'Canceled') return 7 * DAY;
  return 12 * HOUR;
}

export function isStale(row: Media): boolean {
  if (!row.syncedAt) return true;
  return Date.now() - row.syncedAt.getTime() > ttlFor(row);
}

function cleanCharacterName(name: string): string {
  return name.replace(/\s*\((?:voice|uncredited|archive footage)[^)]*\)\s*/gi, '').trim() || name;
}

/**
 * Fetch (or refresh) a show/movie from the metadata provider and persist it
 * with seasons, episodes and characters. Cheap when the row is fresh.
 */
export async function ensureMedia(db: DbExecutor, type: 'show' | 'movie', externalId: number, opts: EnsureMediaOptions = {}): Promise<Media> {
  const provider = opts.provider ?? getMetadataProvider();
  const existing = await db
    .select()
    .from(media)
    .where(and(eq(media.provider, provider.id), eq(media.externalId, externalId), eq(media.type, type)))
    .limit(1);
  const current = existing[0] ?? null;
  if (current && !opts.force && !isStale(current)) return current;

  const details = type === 'show' ? await provider.getShow(externalId, { seasons: 'all' }) : await provider.getMovie(externalId);
  if (!details) {
    if (current) return current;
    throw errors.notFound(type === 'show' ? 'Show' : 'Movie');
  }
  return syncMediaDetails(db, details, opts);
}

export async function syncMediaDetails(db: DbExecutor, details: MediaDetails, opts: EnsureMediaOptions = {}): Promise<Media> {
  const now = new Date();
  const base = {
    type: details.type,
    provider: details.provider,
    externalId: details.externalId,
    imdbId: details.imdbId,
    title: details.title,
    originalTitle: details.originalTitle,
    slug: details.slug,
    overview: details.overview,
    tagline: details.tagline,
    posterPath: details.posterPath,
    backdropPath: details.backdropPath,
    releaseDate: details.releaseDate,
    status: details.status,
    genres: details.genres,
    originCountries: details.originCountries,
    originalLanguage: details.originalLanguage,
    isAnime: details.isAnime,
    popularity: details.popularity,
    voteAverage: details.voteAverage,
    voteCount: details.voteCount,
    homepage: details.homepage,
    trailerKey: details.trailerKey,
    certification: details.certification,
    syncedAt: now,
    updatedAt: now,
  };
  const extra =
    details.type === 'show'
      ? {
          tvdbId: details.tvdbId,
          lastAirDate: details.lastAirDate,
          nextEpisodeAirDate: details.nextEpisodeAirDate,
          networks: details.networks,
          runtime: details.episodeRuntime,
          seasonCount: details.seasonCount,
          episodeCount: details.episodeCount,
        }
      : { runtime: details.runtime, networks: [], seasonCount: null, episodeCount: null, lastAirDate: null, nextEpisodeAirDate: null, tvdbId: null };

  const [row] = await db
    .insert(media)
    .values({ ...base, ...extra })
    .onConflictDoUpdate({ target: [media.provider, media.externalId, media.type], set: { ...base, ...extra } })
    .returning();
  const saved = row!;

  if (details.type === 'show') await syncSeasons(db, saved.id, details);
  await syncCharacters(db, saved.id, details.cast, 'main');

  if (saved.isAnime && !opts.skipEnrichment && opts.anilist !== null) {
    try {
      await enrichAnime(db, saved, opts.anilist ?? new AniListClient());
    } catch (err) {
      console.warn(`[media] AniList enrichment failed for ${saved.title}:`, (err as Error).message);
    }
  }
  return saved;
}

async function syncSeasons(db: DbExecutor, mediaId: number, show: ShowDetails): Promise<void> {
  if (show.seasons.length === 0) return;
  const seasonRows = await db
    .insert(seasons)
    .values(
      show.seasons.map((s) => ({
        mediaId,
        seasonNumber: s.seasonNumber,
        externalId: s.externalId,
        name: s.name,
        overview: s.overview,
        posterPath: s.posterPath,
        airDate: s.airDate,
        episodeCount: s.episodeCount,
      })),
    )
    .onConflictDoUpdate({
      target: [seasons.mediaId, seasons.seasonNumber],
      set: {
        externalId: excluded('external_id'),
        name: excluded('name'),
        overview: excluded('overview'),
        posterPath: excluded('poster_path'),
        airDate: excluded('air_date'),
        episodeCount: excluded('episode_count'),
      },
    })
    .returning({ id: seasons.id, seasonNumber: seasons.seasonNumber });
  const seasonIdByNumber = new Map(seasonRows.map((s) => [s.seasonNumber, s.id]));

  const guestLinks: Array<{ seasonNumber: number; episodeNumber: number; guests: CastMember[] }> = [];
  for (const season of show.seasonDetails) {
    const seasonId = seasonIdByNumber.get(season.seasonNumber);
    if (!seasonId || season.episodes.length === 0) continue;
    for (const batch of chunk(season.episodes, 200)) {
      const values = batch.map((e) => ({
        mediaId,
        seasonId,
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        externalId: e.externalId,
        name: e.name,
        overview: e.overview,
        stillPath: e.stillPath,
        airDate: e.airDate,
        runtime: e.runtime,
        voteAverage: e.voteAverage,
      }));
      await db
        .insert(episodes)
        .values(values)
        .onConflictDoUpdate({
          target: [episodes.mediaId, episodes.seasonNumber, episodes.episodeNumber],
          set: {
            seasonId: excluded('season_id'),
            externalId: excluded('external_id'),
            name: excluded('name'),
            overview: excluded('overview'),
            stillPath: excluded('still_path'),
            airDate: excluded('air_date'),
            runtime: excluded('runtime'),
            voteAverage: excluded('vote_average'),
          },
        });
    }
    for (const e of season.episodes) {
      if (e.guestStars.length > 0) guestLinks.push({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber, guests: e.guestStars });
    }
  }

  if (guestLinks.length > 0) {
    const allGuests = guestLinks.flatMap((g) => g.guests);
    const guestIds = await syncCharacters(db, mediaId, allGuests, 'guest');
    const episodeRows = await db
      .select({ id: episodes.id, seasonNumber: episodes.seasonNumber, episodeNumber: episodes.episodeNumber })
      .from(episodes)
      .where(eq(episodes.mediaId, mediaId));
    const episodeId = new Map(episodeRows.map((e) => [`${e.seasonNumber}:${e.episodeNumber}`, e.id]));
    const links: Array<{ episodeId: number; characterId: number }> = [];
    for (const g of guestLinks) {
      const eid = episodeId.get(`${g.seasonNumber}:${g.episodeNumber}`);
      if (!eid) continue;
      for (const guest of g.guests) {
        const cid = guestIds.get(characterKey(guest));
        if (cid) links.push({ episodeId: eid, characterId: cid });
      }
    }
    for (const batch of chunk(links, 500)) {
      if (batch.length) await db.insert(episodeCharacters).values(batch).onConflictDoNothing();
    }
  }
}

function characterKey(c: CastMember): string {
  return `${c.externalPersonId ?? 'x'}:${cleanCharacterName(c.character).toLowerCase()}`;
}

/** Upsert TMDB characters; returns a map of externalKey → character id. */
async function syncCharacters(db: DbExecutor, mediaId: number, cast: CastMember[], kind: 'main' | 'guest'): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const seen = new Set<string>();
  const values = [];
  for (const c of cast) {
    const key = characterKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    values.push({
      mediaId,
      source: 'tmdb',
      externalKey: key,
      externalPersonId: c.externalPersonId,
      name: cleanCharacterName(c.character),
      actorName: c.name,
      profilePath: c.profilePath,
      sortOrder: c.order,
      kind,
      episodeCount: c.episodeCount,
    });
  }
  for (const batch of chunk(values, 200)) {
    if (batch.length === 0) continue;
    const rows = await db
      .insert(characters)
      .values(batch)
      .onConflictDoUpdate({
        target: [characters.mediaId, characters.source, characters.externalKey],
        set: {
          actorName: excluded('actor_name'),
          profilePath: excluded('profile_path'),
          sortOrder: excluded('sort_order'),
          episodeCount: excluded('episode_count'),
        },
      })
      .returning({ id: characters.id, externalKey: characters.externalKey });
    for (const r of rows) out.set(r.externalKey, r.id);
  }
  return out;
}

export async function enrichAnime(db: DbExecutor, row: Media, client: AniListClient): Promise<AnimeEnrichment | null> {
  const existing = await db.select().from(animeDetails).where(eq(animeDetails.mediaId, row.id)).limit(1);
  const fresh = existing[0] && Date.now() - existing[0].syncedAt.getTime() < 2 * DAY;
  if (fresh) return null;

  let enrichment: AnimeEnrichment | null = null;
  let confidence = existing[0]?.matchConfidence ?? 0;
  if (existing[0]) {
    enrichment = await client.getById(existing[0].anilistId);
  } else {
    const year = row.releaseDate ? Number(row.releaseDate.slice(0, 4)) : null;
    const match = await client.match({ titles: [row.title, row.originalTitle ?? ''], year, isMovie: row.type === 'movie' });
    if (!match) return null;
    enrichment = match.result;
    confidence = match.confidence;
  }
  if (!enrichment) return null;

  const values = {
    mediaId: row.id,
    anilistId: enrichment.anilistId,
    malId: enrichment.malId,
    titleRomaji: enrichment.titleRomaji,
    titleEnglish: enrichment.titleEnglish,
    titleNative: enrichment.titleNative,
    format: enrichment.format,
    status: enrichment.status,
    season: enrichment.season,
    seasonYear: enrichment.seasonYear,
    episodes: enrichment.episodes,
    duration: enrichment.duration,
    averageScore: enrichment.averageScore,
    meanScore: enrichment.meanScore,
    popularity: enrichment.popularity,
    favourites: enrichment.favourites,
    genres: enrichment.genres,
    tags: enrichment.tags,
    studios: enrichment.studios,
    description: enrichment.description,
    coverImageUrl: enrichment.coverImageUrl,
    bannerImageUrl: enrichment.bannerImageUrl,
    color: enrichment.color,
    siteUrl: enrichment.siteUrl,
    nextAiringAt: enrichment.nextAiringAt,
    nextAiringEpisode: enrichment.nextAiringEpisode,
    matchConfidence: confidence,
    syncedAt: new Date(),
  };
  await db.insert(animeDetails).values(values).onConflictDoUpdate({ target: animeDetails.mediaId, set: values });

  const chars = enrichment.characters.map((c, i) => ({
    mediaId: row.id,
    source: 'anilist',
    externalKey: String(c.anilistId),
    externalCharacterId: c.anilistId,
    name: c.name,
    nativeName: c.nativeName,
    actorName: c.voiceActor,
    imageUrl: c.imageUrl,
    role: c.role,
    sortOrder: i,
    kind: 'main' as const,
  }));
  for (const batch of chunk(chars, 100)) {
    if (batch.length === 0) continue;
    await db
      .insert(characters)
      .values(batch)
      .onConflictDoUpdate({
        target: [characters.mediaId, characters.source, characters.externalKey],
        set: { name: excluded('name'), nativeName: excluded('native_name'), actorName: excluded('actor_name'), imageUrl: excluded('image_url'), role: excluded('role'), sortOrder: excluded('sort_order') },
      });
  }
  return enrichment;
}
