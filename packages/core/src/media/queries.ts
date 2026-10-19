import {
  and,
  animeDetails,
  asc,
  characters,
  desc,
  episodeCharacters,
  episodes,
  eq,
  ilike,
  inArray,
  media,
  or,
  seasons,
  sql,
  type AnimeDetails,
  type Character,
  type DbExecutor,
  type Episode,
  type Media,
  type Season,
} from '@marutime/db';

export async function getMediaByExternalId(db: DbExecutor, type: 'show' | 'movie', externalId: number, provider = 'tmdb'): Promise<Media | null> {
  const rows = await db
    .select()
    .from(media)
    .where(and(eq(media.provider, provider), eq(media.externalId, externalId), eq(media.type, type)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMediaById(db: DbExecutor, id: number): Promise<Media | null> {
  const rows = await db.select().from(media).where(eq(media.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getMediaByIds(db: DbExecutor, ids: number[]): Promise<Map<number, Media>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(media).where(inArray(media.id, Array.from(new Set(ids))));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function getSeasons(db: DbExecutor, mediaId: number): Promise<Season[]> {
  return db.select().from(seasons).where(eq(seasons.mediaId, mediaId)).orderBy(asc(seasons.seasonNumber));
}

export async function getSeason(db: DbExecutor, mediaId: number, seasonNumber: number): Promise<Season | null> {
  const rows = await db.select().from(seasons).where(and(eq(seasons.mediaId, mediaId), eq(seasons.seasonNumber, seasonNumber))).limit(1);
  return rows[0] ?? null;
}

export async function getEpisodesForMedia(db: DbExecutor, mediaId: number): Promise<Episode[]> {
  return db
    .select()
    .from(episodes)
    .where(eq(episodes.mediaId, mediaId))
    .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));
}

export type EpisodePage = { items: Episode[]; total: number };

/** One page of a season's episodes, in order (long seasons load as you scroll). */
export async function getEpisodesPage(db: DbExecutor, mediaId: number, seasonNumber: number, offset = 0, limit = 40): Promise<EpisodePage> {
  const where = and(eq(episodes.mediaId, mediaId), eq(episodes.seasonNumber, seasonNumber));
  const [items, [total]] = await Promise.all([
    db.select().from(episodes).where(where).orderBy(asc(episodes.episodeNumber)).offset(offset).limit(limit),
    db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(episodes).where(where),
  ]);
  return { items, total: total?.n ?? 0 };
}

export type SeasonCounts = { seasonNumber: number; total: number; aired: number };

/** Episode and aired-episode counts per season, for tabs and progress bars. */
export async function getSeasonSummaries(db: DbExecutor, mediaId: number, today = new Date().toISOString().slice(0, 10)): Promise<SeasonCounts[]> {
  return db
    .select({
      seasonNumber: episodes.seasonNumber,
      total: sql<number>`count(*)`.mapWith(Number),
      aired: sql<number>`count(*) filter (where ${episodes.airDate} is not null and ${episodes.airDate} <= ${today})`.mapWith(Number),
    })
    .from(episodes)
    .where(eq(episodes.mediaId, mediaId))
    .groupBy(episodes.seasonNumber)
    .orderBy(asc(episodes.seasonNumber));
}

export async function getEpisodesForSeason(db: DbExecutor, mediaId: number, seasonNumber: number): Promise<Episode[]> {
  return db
    .select()
    .from(episodes)
    .where(and(eq(episodes.mediaId, mediaId), eq(episodes.seasonNumber, seasonNumber)))
    .orderBy(asc(episodes.episodeNumber));
}

export async function getEpisode(db: DbExecutor, mediaId: number, seasonNumber: number, episodeNumber: number): Promise<Episode | null> {
  const rows = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.mediaId, mediaId), eq(episodes.seasonNumber, seasonNumber), eq(episodes.episodeNumber, episodeNumber)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getEpisodeById(db: DbExecutor, id: number): Promise<Episode | null> {
  const rows = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getEpisodesByIds(db: DbExecutor, ids: number[]): Promise<Map<number, Episode>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(episodes).where(inArray(episodes.id, Array.from(new Set(ids))));
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * Previous and next episode in order, for episode page navigation. Regular
 * episodes step through every season; specials step through season 0.
 */
export async function getAdjacentEpisodes(db: DbExecutor, episode: Episode): Promise<{ prev: Episode | null; next: Episode | null }> {
  const pos = sql`(${episodes.seasonNumber}, ${episodes.episodeNumber})`;
  const here = sql`(${episode.seasonNumber}, ${episode.episodeNumber})`;
  const scope = and(eq(episodes.mediaId, episode.mediaId), episode.seasonNumber > 0 ? sql`${episodes.seasonNumber} > 0` : eq(episodes.seasonNumber, 0));
  const [prev, next] = await Promise.all([
    db.select().from(episodes).where(and(scope, sql`${pos} < ${here}`)).orderBy(desc(episodes.seasonNumber), desc(episodes.episodeNumber)).limit(1),
    db.select().from(episodes).where(and(scope, sql`${pos} > ${here}`)).orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber)).limit(1),
  ]);
  return { prev: prev[0] ?? null, next: next[0] ?? null };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Characters available for "favorite character" picks on a title. When AniList
 * data exists, its characters (with character art) come first and TMDB
 * entries describing the same character are dropped.
 */
export async function getCharactersForMedia(db: DbExecutor, mediaId: number, opts: { kind?: 'main' | 'guest' | 'all'; limit?: number } = {}): Promise<Character[]> {
  const kind = opts.kind ?? 'main';
  const rows = await db
    .select()
    .from(characters)
    .where(kind === 'all' ? eq(characters.mediaId, mediaId) : and(eq(characters.mediaId, mediaId), eq(characters.kind, kind)))
    .orderBy(asc(characters.sortOrder));
  return dedupeCharacters(rows).slice(0, opts.limit ?? 60);
}

export function dedupeCharacters(rows: Character[]): Character[] {
  const anilist = rows.filter((r) => r.source === 'anilist');
  if (anilist.length === 0) return rows;
  const roleOrder: Record<string, number> = { MAIN: 0, SUPPORTING: 1, BACKGROUND: 2 };
  anilist.sort((a, b) => (roleOrder[a.role ?? ''] ?? 3) - (roleOrder[b.role ?? ''] ?? 3) || a.sortOrder - b.sortOrder);
  const seen = new Set<string>();
  for (const c of anilist) {
    seen.add(normalizeName(c.name));
    const parts = normalizeName(c.name).split(' ');
    if (parts.length === 2) seen.add(`${parts[1]} ${parts[0]}`);
  }
  const rest = rows.filter((r) => r.source !== 'anilist' && !seen.has(normalizeName(r.name)));
  return [...anilist, ...rest];
}

/** Main cast plus the guest stars credited on this specific episode. */
export async function getCharactersForEpisode(db: DbExecutor, mediaId: number, episodeId: number): Promise<{ main: Character[]; guests: Character[] }> {
  const main = await getCharactersForMedia(db, mediaId, { kind: 'main', limit: 40 });
  const guests = await db
    .select({ c: characters })
    .from(episodeCharacters)
    .innerJoin(characters, eq(episodeCharacters.characterId, characters.id))
    .where(eq(episodeCharacters.episodeId, episodeId))
    .orderBy(asc(characters.sortOrder));
  return { main, guests: guests.map((g) => g.c) };
}

export async function getCharacterById(db: DbExecutor, id: number): Promise<Character | null> {
  const rows = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAnimeDetails(db: DbExecutor, mediaId: number): Promise<AnimeDetails | null> {
  const rows = await db.select().from(animeDetails).where(eq(animeDetails.mediaId, mediaId)).limit(1);
  return rows[0] ?? null;
}

/** Local search over already-imported titles (instant results while TMDB loads). */
export async function searchLocalMedia(db: DbExecutor, query: string, limit = 10): Promise<Media[]> {
  const q = `%${query.trim().replace(/[%_]/g, '')}%`;
  if (q.length <= 2) return [];
  return db
    .select()
    .from(media)
    .where(or(ilike(media.title, q), ilike(media.originalTitle, q)))
    .orderBy(desc(media.popularity))
    .limit(limit);
}

export async function listPopularLocalMedia(db: DbExecutor, opts: { type?: 'show' | 'movie'; anime?: boolean; limit?: number } = {}): Promise<Media[]> {
  const conds = [];
  if (opts.type) conds.push(eq(media.type, opts.type));
  if (opts.anime !== undefined) conds.push(eq(media.isAnime, opts.anime));
  return db
    .select()
    .from(media)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(media.popularity))
    .limit(opts.limit ?? 20);
}
