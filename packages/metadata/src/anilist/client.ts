import { MetadataError } from '../types';

const ENDPOINT = 'https://graphql.anilist.co';

export type AnimeCharacter = {
  anilistId: number;
  name: string;
  nativeName: string | null;
  imageUrl: string | null;
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
  voiceActor: string | null;
  voiceActorId: number | null;
  voiceActorImageUrl: string | null;
};

export type AniListMediaRef = {
  anilistId: number;
  title: string;
  coverImageUrl: string | null;
  format: string | null;
  year: number | null;
  type: 'ANIME' | 'MANGA';
};

export type AniListVoiceActor = { anilistId: number; name: string; nativeName: string | null; imageUrl: string | null; language: string | null };

export type AniListCharacterDetails = {
  anilistId: number;
  name: string;
  nativeName: string | null;
  alternativeNames: string[];
  imageUrl: string | null;
  description: string | null;
  gender: string | null;
  age: string | null;
  dateOfBirth: string | null;
  bloodType: string | null;
  favourites: number | null;
  siteUrl: string | null;
  appearances: Array<AniListMediaRef & { role: string | null; voiceActors: AniListVoiceActor[] }>;
};

export type AniListStaffDetails = {
  anilistId: number;
  name: string;
  nativeName: string | null;
  imageUrl: string | null;
  description: string | null;
  occupations: string[];
  gender: string | null;
  age: number | null;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  homeTown: string | null;
  yearsActive: number[];
  language: string | null;
  favourites: number | null;
  siteUrl: string | null;
  roles: Array<{ character: { anilistId: number; name: string; imageUrl: string | null }; media: AniListMediaRef; role: string | null }>;
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
      voiceActors: Array<{ id: number; name: { full: string | null }; image: { large: string | null } | null }>;
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
    edges { role node { id name { full native } image { large } } voiceActors(language: JAPANESE) { id name { full } image { large } } }
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
        voiceActorId: e.voiceActors?.[0]?.id ?? null,
        voiceActorImageUrl: e.voiceActors?.[0]?.image?.large ?? null,
      })),
  };
}

type RawMediaRef = { id: number; type: 'ANIME' | 'MANGA'; format: string | null; title: { userPreferred: string | null; english: string | null; romaji: string | null }; coverImage: { large: string | null } | null; startDate: { year: number | null } | null };
type RawFuzzyDate = { year: number | null; month: number | null; day: number | null } | null;

const MEDIA_REF_FIELDS = 'id type format title { userPreferred english romaji } coverImage { large } startDate { year }';

function mapMediaRef(m: RawMediaRef): AniListMediaRef {
  return {
    anilistId: m.id,
    title: m.title.english ?? m.title.userPreferred ?? m.title.romaji ?? 'Untitled',
    coverImageUrl: m.coverImage?.large ?? null,
    format: m.format,
    year: m.startDate?.year ?? null,
    type: m.type,
  };
}

function fuzzyDate(d: RawFuzzyDate, withYear = true): string | null {
  if (!d || (!d.month && !d.year)) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = [d.day ? String(d.day) : null, d.month ? months[d.month - 1] : null, withYear && d.year ? String(d.year) : null].filter(Boolean);
  return parts.join(' ') || null;
}

/** AniList markdown: drop spoiler blocks (~!...!~), links and emphasis. */
function cleanBio(input: string | null): string | null {
  if (!input) return null;
  const text = input
    .replace(/~!([\s\S]*?)!~/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || null;
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

export type AniListListStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

/** One title on a user's anime list. Dates are ISO (yyyy-mm-dd), times are epoch seconds. */
export type AniListListEntry = {
  status: AniListListStatus;
  progress: number;
  repeat: number;
  /** 0–10, 0 when unscored. */
  score: number;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: number | null;
  createdAt: number | null;
  media: {
    id: number;
    idMal: number | null;
    format: string | null;
    episodes: number | null;
    titleRomaji: string | null;
    titleEnglish: string | null;
    titleNative: string | null;
    startDate: string | null;
  };
};

type RawDate = { year: number | null; month: number | null; day: number | null } | null;
function isoDate(d: RawDate): string | null {
  if (!d?.year) return null;
  return `${d.year}-${String(d.month ?? 1).padStart(2, '0')}-${String(d.day ?? 1).padStart(2, '0')}`;
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
      if (!res.ok) {
        const detail = await res
          .json()
          .then((b: { errors?: Array<{ message: string }> }) => b.errors?.[0]?.message)
          .catch(() => undefined);
        throw new MetadataError(detail ? `AniList: ${detail}` : `AniList request failed (${res.status})`, res.status);
      }
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

  /** A user's public anime list, or null when there is no such user. Throws a MetadataError mentioning "private" for private lists. */
  async getUserAnimeList(userName: string): Promise<{ user: { id: number; name: string }; entries: AniListListEntry[] } | null> {
    type RawEntry = {
      status: AniListListStatus;
      progress: number | null;
      repeat: number | null;
      score: number | null;
      startedAt: RawDate;
      completedAt: RawDate;
      updatedAt: number | null;
      createdAt: number | null;
      media: { id: number; idMal: number | null; format: string | null; episodes: number | null; title: { romaji: string | null; english: string | null; native: string | null }; startDate: RawDate };
    };
    type Raw = { MediaListCollection: { user: { id: number; name: string } | null; lists: Array<{ isCustomList: boolean; entries: RawEntry[] }> } | null };
    let data: Raw;
    try {
      data = await this.query<Raw>(
        `query ($name: String) { MediaListCollection(userName: $name, type: ANIME) { user { id name } lists { isCustomList entries { status progress repeat score(format: POINT_10_DECIMAL) startedAt { year month day } completedAt { year month day } updatedAt createdAt media { id idMal format episodes title { romaji english native } startDate { year month day } } } } } }`,
        { name: userName },
      );
    } catch (err) {
      // Private lists are reported as such; anything else that is a 404 means there is no such user.
      if (err instanceof MetadataError && /private/i.test(err.message)) throw err;
      if (err instanceof MetadataError && (err.status === 404 || /not found/i.test(err.message))) return null;
      throw err;
    }
    const col = data.MediaListCollection;
    if (!col?.user) return null;
    // Custom lists repeat entries from the status lists, so take each title once.
    const seen = new Map<number, AniListListEntry>();
    for (const list of [...col.lists].sort((a, b) => Number(a.isCustomList) - Number(b.isCustomList))) {
      for (const e of list.entries) {
        if (seen.has(e.media.id)) continue;
        seen.set(e.media.id, {
          status: e.status,
          progress: e.progress ?? 0,
          repeat: e.repeat ?? 0,
          score: e.score ?? 0,
          startedAt: isoDate(e.startedAt),
          completedAt: isoDate(e.completedAt),
          updatedAt: e.updatedAt || null,
          createdAt: e.createdAt || null,
          media: { id: e.media.id, idMal: e.media.idMal, format: e.media.format, episodes: e.media.episodes, titleRomaji: e.media.title.romaji, titleEnglish: e.media.title.english, titleNative: e.media.title.native, startDate: isoDate(e.media.startDate) },
        });
      }
    }
    return { user: col.user, entries: [...seen.values()] };
  }

  /** Episode counts and start dates for many titles (50 per request). */
  async getEpisodeCounts(ids: number[]): Promise<Map<number, { episodes: number | null; startDate: string | null }>> {
    const out = new Map<number, { episodes: number | null; startDate: string | null }>();
    const unique = [...new Set(ids)];
    for (let i = 0; i < unique.length; i += 50) {
      const data = await this.query<{ Page: { media: Array<{ id: number; episodes: number | null; startDate: RawDate }> } }>(
        `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id episodes startDate { year month day } } } }`,
        { ids: unique.slice(i, i + 50) },
      );
      for (const m of data.Page.media) out.set(m.id, { episodes: m.episodes, startDate: isoDate(m.startDate) });
    }
    return out;
  }

  async getById(id: number): Promise<AnimeEnrichment | null> {
    const data = await this.query<{ Media: RawMedia | null }>(`query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`, { id });
    return data.Media ? mapMedia(data.Media) : null;
  }

  async getByMalId(idMal: number): Promise<AnimeEnrichment | null> {
    const data = await this.query<{ Media: RawMedia | null }>(`query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${MEDIA_FIELDS} } }`, { idMal });
    return data.Media ? mapMedia(data.Media) : null;
  }

  async getCharacter(id: number): Promise<AniListCharacterDetails | null> {
    type Raw = {
      id: number;
      name: { full: string | null; native: string | null; alternative: string[] | null };
      image: { large: string | null } | null;
      description: string | null;
      gender: string | null;
      age: string | null;
      bloodType: string | null;
      dateOfBirth: RawFuzzyDate;
      favourites: number | null;
      siteUrl: string | null;
      media: { edges: Array<{ characterRole: string | null; node: RawMediaRef; voiceActors: Array<{ id: number; name: { full: string | null; native: string | null }; image: { large: string | null } | null; languageV2: string | null }> }> } | null;
    };
    const data = await this.query<{ Character: Raw | null }>(
      `query ($id: Int) { Character(id: $id) {
        id name { full native alternative } image { large } description(asHtml: false) gender age bloodType dateOfBirth { year month day } favourites siteUrl
        media(sort: [POPULARITY_DESC], perPage: 25) { edges { characterRole node { ${MEDIA_REF_FIELDS} } voiceActors { id name { full native } image { large } languageV2 } } }
      } }`,
      { id },
    );
    const c = data.Character;
    if (!c || !c.name.full) return null;
    return {
      anilistId: c.id,
      name: c.name.full,
      nativeName: c.name.native,
      alternativeNames: (c.name.alternative ?? []).filter(Boolean).slice(0, 6),
      imageUrl: c.image?.large ?? null,
      description: cleanBio(c.description),
      gender: c.gender,
      age: c.age,
      dateOfBirth: fuzzyDate(c.dateOfBirth, false),
      bloodType: c.bloodType,
      favourites: c.favourites,
      siteUrl: c.siteUrl,
      appearances: (c.media?.edges ?? []).map((e) => ({
        ...mapMediaRef(e.node),
        role: e.characterRole,
        voiceActors: (e.voiceActors ?? [])
          .filter((v) => v.name.full)
          .map((v) => ({ anilistId: v.id, name: v.name.full!, nativeName: v.name.native, imageUrl: v.image?.large ?? null, language: v.languageV2 })),
      })),
    };
  }

  async getStaff(id: number): Promise<AniListStaffDetails | null> {
    type Raw = {
      id: number;
      name: { full: string | null; native: string | null };
      image: { large: string | null } | null;
      description: string | null;
      primaryOccupations: string[] | null;
      gender: string | null;
      age: number | null;
      dateOfBirth: RawFuzzyDate;
      dateOfDeath: RawFuzzyDate;
      homeTown: string | null;
      yearsActive: number[] | null;
      languageV2: string | null;
      favourites: number | null;
      siteUrl: string | null;
      characterMedia: { edges: Array<{ characterRole: string | null; node: RawMediaRef; characters: Array<{ id: number; name: { full: string | null }; image: { large: string | null } | null } | null> }> } | null;
    };
    const data = await this.query<{ Staff: Raw | null }>(
      `query ($id: Int) { Staff(id: $id) {
        id name { full native } image { large } description(asHtml: false) primaryOccupations gender age dateOfBirth { year month day } dateOfDeath { year month day } homeTown yearsActive languageV2 favourites siteUrl
        characterMedia(sort: [POPULARITY_DESC], perPage: 40) { edges { characterRole node { ${MEDIA_REF_FIELDS} } characters { id name { full } image { large } } } }
      } }`,
      { id },
    );
    const s = data.Staff;
    if (!s || !s.name.full) return null;
    const roles: AniListStaffDetails['roles'] = [];
    for (const e of s.characterMedia?.edges ?? []) {
      for (const ch of e.characters ?? []) {
        if (!ch?.name.full) continue;
        roles.push({ character: { anilistId: ch.id, name: ch.name.full, imageUrl: ch.image?.large ?? null }, media: mapMediaRef(e.node), role: e.characterRole });
      }
    }
    return {
      anilistId: s.id,
      name: s.name.full,
      nativeName: s.name.native,
      imageUrl: s.image?.large ?? null,
      description: cleanBio(s.description),
      occupations: s.primaryOccupations ?? [],
      gender: s.gender,
      age: s.age,
      dateOfBirth: fuzzyDate(s.dateOfBirth),
      dateOfDeath: fuzzyDate(s.dateOfDeath),
      homeTown: s.homeTown,
      yearsActive: s.yearsActive ?? [],
      language: s.languageV2,
      favourites: s.favourites,
      siteUrl: s.siteUrl,
      roles,
    };
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
