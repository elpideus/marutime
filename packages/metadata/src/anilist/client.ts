import { MetadataError } from '../types';

const ENDPOINT = 'https://graphql.anilist.co';

export type AnimeCharacter = {
  anilistId: number;
  name: string;
  nativeName: string | null;
  imageUrl: string | null;
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
  voiceActor: string | null;
};

export type AnimeEnrichment = {
  anilistId: number;
  malId: number | null;
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  startYear: number | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  genres: string[];
  tags: Array<{ name: string; rank: number; isSpoiler: boolean }>;
  studios: Array<{ name: string; isMain: boolean }>;
  description: string | null;
  coverImageUrl: string | null;
  bannerImageUrl: string | null;
  color: string | null;
  siteUrl: string | null;
  nextAiringAt: Date | null;
  nextAiringEpisode: number | null;
  characters: AnimeCharacter[];
};

type RawMedia = {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  startDate: { year: number | null } | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  genres: string[] | null;
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null } | null;
  bannerImage: string | null;
  siteUrl: string | null;
  studios: { edges: Array<{ isMain: boolean; node: { name: string } }> } | null;
  tags: Array<{ name: string; rank: number; isMediaSpoiler: boolean }> | null;
  nextAiringEpisode: { airingAt: number; episode: number } | null;
  characters: {
    edges: Array<{
      role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
      node: { id: number; name: { full: string | null; native: string | null }; image: { large: string | null } | null };
      voiceActors: Array<{ name: { full: string | null } }>;
    }>;
  } | null;
};

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  format status season seasonYear startDate { year }
  episodes duration averageScore meanScore popularity favourites genres
  description(asHtml: false)
  coverImage { extraLarge large color }
  bannerImage siteUrl
  studios { edges { isMain node { name } } }
  tags { name rank isMediaSpoiler }
  nextAiringEpisode { airingAt episode }
  characters(sort: [ROLE, RELEVANCE], perPage: 30) {
    edges { role node { id name { full native } image { large } } voiceActors(language: JAPANESE) { name { full } } }
  }
`;

function stripHtml(input: string | null): string | null {
  if (!input) return null;
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mapMedia(raw: RawMedia): AnimeEnrichment {
  return {
    anilistId: raw.id,
    malId: raw.idMal,
    titleRomaji: raw.title.romaji,
    titleEnglish: raw.title.english,
    titleNative: raw.title.native,
    format: raw.format,
    status: raw.status,
    season: raw.season,
    seasonYear: raw.seasonYear,
    startYear: raw.startDate?.year ?? null,
    episodes: raw.episodes,
    duration: raw.duration,
    averageScore: raw.averageScore,
    meanScore: raw.meanScore,
    popularity: raw.popularity,
    favourites: raw.favourites,
    genres: raw.genres ?? [],
    tags: (raw.tags ?? []).filter((t) => t.rank >= 40).slice(0, 20).map((t) => ({ name: t.name, rank: t.rank, isSpoiler: t.isMediaSpoiler })),
    studios: (raw.studios?.edges ?? []).map((e) => ({ name: e.node.name, isMain: e.isMain })),
    description: stripHtml(raw.description),
    coverImageUrl: raw.coverImage?.extraLarge ?? raw.coverImage?.large ?? null,
    bannerImageUrl: raw.bannerImage,
    color: raw.coverImage?.color ?? null,
    siteUrl: raw.siteUrl,
    nextAiringAt: raw.nextAiringEpisode ? new Date(raw.nextAiringEpisode.airingAt * 1000) : null,
    nextAiringEpisode: raw.nextAiringEpisode?.episode ?? null,
    characters: (raw.characters?.edges ?? [])
      .filter((e) => e.node.name.full)
      .map((e) => ({
        anilistId: e.node.id,
        name: e.node.name.full!,
        nativeName: e.node.name.native,
        imageUrl: e.node.image?.large ?? null,
        role: e.role,
        voiceActor: e.voiceActors?.[0]?.name.full ?? null,
      })),
  };
}

function normalizeTitle(t: string | null | undefined): string {
  return (t ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, ' ')
    .trim();
}

/** 0..1 similarity based on normalised title equality / containment. */
function titleScore(candidate: AnimeEnrichment, titles: string[]): number {
  const mine = [candidate.titleRomaji, candidate.titleEnglish, candidate.titleNative].map(normalizeTitle).filter(Boolean);
  let best = 0;
  for (const want of titles.map(normalizeTitle).filter(Boolean)) {
    for (const have of mine) {
      if (have === want) best = Math.max(best, 1);
      else if (have.startsWith(want) || want.startsWith(have)) best = Math.max(best, 0.75);
      else if (have.includes(want) || want.includes(have)) best = Math.max(best, 0.55);
    }
  }
  return best;
}

export class AniListClient {
  constructor(private readonly options: { userAgent?: string } = {}) {}

  private async query<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let attempt = 0;
    for (;;) {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': this.options.userAgent ?? 'MaruTime/0.1 (+https://github.com/elpideus/marutime)',
        },
        body: JSON.stringify({ query, variables }),
        cache: 'no-store',
      });
      if (res.status === 429 && attempt < 2) {
        const retry = Number(res.headers.get('retry-after') ?? '2');
        await new Promise((r) => setTimeout(r, Math.min(retry, 10) * 1000));
        attempt += 1;
        continue;
      }
      if (!res.ok) throw new MetadataError(`AniList request failed (${res.status})`, res.status);
      const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
      if (body.errors?.length) throw new MetadataError(`AniList error: ${body.errors[0]!.message}`);
      return body.data as T;
    }
  }

  async search(search: string, perPage = 8): Promise<AnimeEnrichment[]> {
    const data = await this.query<{ Page: { media: RawMedia[] } }>(
      `query ($search: String, $perPage: Int) { Page(perPage: $perPage) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} } } }`,
      { search, perPage },
    );
    return data.Page.media.map(mapMedia);
  }

  async getById(id: number): Promise<AnimeEnrichment | null> {
    const data = await this.query<{ Media: RawMedia | null }>(`query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`, { id });
    return data.Media ? mapMedia(data.Media) : null;
  }

  async getByMalId(idMal: number): Promise<AnimeEnrichment | null> {
    const data = await this.query<{ Media: RawMedia | null }>(`query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${MEDIA_FIELDS} } }`, { idMal });
    return data.Media ? mapMedia(data.Media) : null;
  }

  /**
   * Find the AniList entry best matching a TMDB title. Prefers exact title
   * matches, then closeness of the first-air year, then TV formats.
   */
  async match(input: { titles: string[]; year: number | null; isMovie?: boolean }): Promise<{ result: AnimeEnrichment; confidence: number } | null> {
    const queries = Array.from(new Set(input.titles.filter(Boolean))).slice(0, 2);
    const seen = new Map<number, AnimeEnrichment>();
    for (const q of queries) {
      try {
        for (const m of await this.search(q)) seen.set(m.anilistId, m);
      } catch (err) {
        if (seen.size === 0 && q === queries[queries.length - 1]) throw err;
      }
    }
    let best: { result: AnimeEnrichment; confidence: number } | null = null;
    for (const c of seen.values()) {
      let score = titleScore(c, input.titles);
      if (score === 0) continue;
      const year = c.seasonYear ?? c.startYear;
      if (input.year && year) {
        const diff = Math.abs(year - input.year);
        score += diff === 0 ? 0.3 : diff === 1 ? 0.15 : diff <= 3 ? 0 : -0.3;
      }
      const tvFormats = ['TV', 'TV_SHORT', 'ONA'];
      if (input.isMovie ? c.format === 'MOVIE' : tvFormats.includes(c.format ?? '')) score += 0.15;
      if (!best || score > best.confidence) best = { result: c, confidence: score };
    }
    if (!best || best.confidence < 0.6) return null;
    return { result: best.result, confidence: Math.min(1, best.confidence / 1.45) };
  }
}
