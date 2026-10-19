import {
  and,
  animeDetails,
  characters,
  count,
  episodeCharacters,
  episodes,
  eq,
  getDb,
  max,
  media,
  seasons,
  type DbExecutor,
  type Episode,
  type Media,
} from '@marutime/db';
import {
  AniListClient,
  getMetadataProvider,
  type AnimeEnrichment,
  type CastMember,
  type MediaDetails,
  type MetadataProvider,
  type SeasonSummary,
  type ShowDetails,
} from '@marutime/metadata';
import { sql } from 'drizzle-orm';
import { acquireLease, releaseLease, runInBackground } from '../cache';
import { errors } from '../errors';
import { chunk, todayIso } from '../utils';
import { getEpisode } from './queries';

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
  /** Block on a refresh of stale data instead of serving it and refreshing in the background. */
  wait?: boolean;
};

const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

/**
 * How long a synced title stays fresh. Old, finished things almost never
 * change upstream, so they are refreshed rarely; anything airing is checked
 * often enough to pick up new episodes the day they are listed.
 */
function ttlFor(row: Pick<Media, 'type' | 'status' | 'releaseDate' | 'lastAirDate' | 'nextEpisodeAirDate'>): number {
  const today = todayIso();
  if (row.type === 'movie') {
    if (!row.releaseDate || row.releaseDate >= today) return DAY;
    if (row.releaseDate >= daysAgo(60)) return 3 * DAY;
    return 30 * DAY;
  }
  if (row.status === 'Ended' || row.status === 'Canceled') return 30 * DAY;
  const soon = row.nextEpisodeAirDate && row.nextEpisodeAirDate <= new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10);
  const recent = row.lastAirDate && row.lastAirDate >= daysAgo(14);
  return soon || recent ? 12 * HOUR : 3 * DAY;
}

export function isStale(row: Media): boolean {
  if (!row.syncedAt) return true;
  return Date.now() - row.syncedAt.getTime() > ttlFor(row);
}

function cleanCharacterName(name: string): string {
  return name.replace(/\s*\((?:voice|uncredited|archive footage)[^)]*\)\s*/gi, '').trim() || name;
}

const refreshing = new Set<string>();

/**
 * Fetch (or refresh) a show/movie from the metadata provider and persist it
 * with seasons, episodes and characters.
 *
 * Fresh rows return immediately. Stale rows are also returned immediately and
 * refreshed in the background by one server instance at a time
 * (stale-while-revalidate), so a page never waits on TMDB for a title it has
 * seen before. Only never-seen titles (or `force`/`wait`) block.
 */
export async function ensureMedia(db: DbExecutor, type: 'show' | 'movie', externalId: number, opts: EnsureMediaOptions = {}): Promise<Media> {
  const provider = opts.provider ?? getMetadataProvider();
  const existing = await db
    .select()
    .from(media)
    .where(and(eq(media.provider, provider.id), eq(media.externalId, externalId), eq(media.type, type)))
    .limit(1);
  const current = existing[0] ?? null;
  if (current && !opts.force) {
    if (!isStale(current)) return current;
    if (!opts.wait) {
      scheduleRefresh(current, opts);
      return current;
    }
  }
  return syncFromProvider(db, type, externalId, current, opts);
}

/**
 * Episode lookup for scrobblers and deep links: when the episode is not known
 * yet (it may have been listed upstream minutes ago), re-sync the show once
 * and look again. Throttled to one forced sync per show per hour.
 */
export async function ensureEpisode(db: DbExecutor, showExternalId: number, seasonNumber: number, episodeNumber: number): Promise<{ media: Media; episode: Episode | null }> {
  let show = await ensureMedia(db, 'show', showExternalId);
  let episode = await getEpisode(db, show.id, seasonNumber, episodeNumber);
  if (!episode && (!show.syncedAt || Date.now() - show.syncedAt.getTime() > HOUR)) {
    show = await ensureMedia(db, 'show', showExternalId, { force: true });
    episode = await getEpisode(db, show.id, seasonNumber, episodeNumber);
  }
  return { media: show, episode };
}

function scheduleRefresh(current: Media, opts: EnsureMediaOptions): void {
  const key = `sync:${current.provider}:${current.type}:${current.externalId}`;
  if (refreshing.has(key)) return;
  refreshing.add(key);
  runInBackground(async () => {
    try {
      if (!(await acquireLease(key, 180))) return;
      try {
        await syncFromProvider(getDb(), current.type, current.externalId, current, opts);
      } finally {
        await releaseLease(key);
      }
    } finally {
      refreshing.delete(key);
    }
  });
}

async function syncFromProvider(db: DbExecutor, type: 'show' | 'movie', externalId: number, current: Media | null, opts: EnsureMediaOptions): Promise<Media> {
  const provider = opts.provider ?? getMetadataProvider();
  let details: MediaDetails | null;
  if (type === 'show') {
    // First import and forced re-syncs take every season. Routine refreshes
    // only re-fetch seasons that can still change, plus a full pass monthly.
    const fullKey = `fullsync:${provider.id}:${externalId}`;
    const monthly = 30 * 24 * 60 * 60;
    const full = !current || opts.force ? await acquireLease(fullKey, monthly, { force: true }) : await acquireLease(fullKey, monthly);
    details = await provider.getShow(externalId, { seasons: full || !current ? 'all' : await seasonsToRefresh(db, current.id) });
  } else {
    details = await provider.getMovie(externalId);
  }
  if (!details) {
    if (current) {
      // Removed or temporarily missing upstream: keep serving what we have.
      await db.update(media).set({ syncedAt: new Date() }).where(eq(media.id, current.id));
      return current;
    }
    throw errors.notFound(type === 'show' ? 'Show' : 'Movie');
  }
  return syncMediaDetails(db, details, opts);
}

/**
 * Pick the seasons worth re-fetching on a routine refresh: new seasons,
 * seasons whose episode count changed, the latest season, and any season with
 * episodes that aired recently or have no date yet (names, synopses and stills
 * for those are still being filled in upstream).
 */
async function seasonsToRefresh(db: DbExecutor, mediaId: number): Promise<(list: SeasonSummary[]) => number[]> {
  const stored = await db
    .select({
      seasonNumber: episodes.seasonNumber,
      n: count(),
      lastAir: max(episodes.airDate),
      undated: sql<number>`count(*) filter (where ${episodes.airDate} is null)`.mapWith(Number),
    })
    .from(episodes)
    .where(eq(episodes.mediaId, mediaId))
    .groupBy(episodes.seasonNumber);
  const bySeason = new Map(stored.map((r) => [r.seasonNumber, r]));
  const recent = daysAgo(120);
  return (list) => {
    const latest = Math.max(0, ...list.filter((s) => s.seasonNumber > 0).map((s) => s.seasonNumber));
    return list
      .filter((s) => {
        const have = bySeason.get(s.seasonNumber);
        if (!have) return true;
        if (have.n !== s.episodeCount) return true;
        if (s.seasonNumber >= latest) return true;
        if (have.undated > 0) return true;
        return Boolean(have.lastAir && have.lastAir >= recent);
      })
      .map((s) => s.seasonNumber);
  };
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

  // Main cast first so a regular who also appears as a guest star keeps kind = main.
  await syncCharacters(db, saved.id, details.cast, 'main');
  if (details.type === 'show') await syncSeasons(db, saved.id, details);

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
    const rows =
      kind === 'main'
        ? await db
            .insert(characters)
            .values(batch)
            .onConflictDoUpdate({
              target: [characters.mediaId, characters.source, characters.externalKey],
              set: {
                actorName: excluded('actor_name'),
                profilePath: excluded('profile_path'),
                sortOrder: excluded('sort_order'),
                episodeCount: excluded('episode_count'),
                kind: sql.raw(`'main'`),
              },
            })
            .returning({ id: characters.id, externalKey: characters.externalKey })
        : await db
            .insert(characters)
            .values(batch)
            .onConflictDoNothing({ target: [characters.mediaId, characters.source, characters.externalKey] })
            .returning({ id: characters.id, externalKey: characters.externalKey });
    for (const r of rows) out.set(r.externalKey, r.id);
  }
  // ON CONFLICT DO NOTHING returns no row for existing characters; look those up.
  if (out.size < values.length) {
    const existing = await db
      .select({ id: characters.id, externalKey: characters.externalKey })
      .from(characters)
      .where(and(eq(characters.mediaId, mediaId), eq(characters.source, 'tmdb')));
    for (const r of existing) if (!out.has(r.externalKey)) out.set(r.externalKey, r.id);
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
    voiceActorId: c.voiceActorId,
    voiceActorImageUrl: c.voiceActorImageUrl,
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
        set: {
          name: excluded('name'),
          nativeName: excluded('native_name'),
          actorName: excluded('actor_name'),
          voiceActorId: excluded('voice_actor_id'),
          voiceActorImageUrl: excluded('voice_actor_image_url'),
          imageUrl: excluded('image_url'),
          role: excluded('role'),
          sortOrder: excluded('sort_order'),
        },
      });
  }
  return enrichment;
}
