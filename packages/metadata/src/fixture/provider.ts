import type {
  CastMember,
  DiscoverCategory,
  DiscoverFilters,
  DiscoverSort,
  Genre,
  PersonDetails,
  SeasonSelection,
  MediaSummary,
  MediaType,
  MetadataProvider,
  MovieDetails,
  PagedResult,
  SearchOptions,
  SeasonDetails,
  ShowDetails,
  TrendingWindow,
  ExternalMatches,
  ExternalSource,
} from '../types';
import { slugify } from '../util';

/**
 * Deterministic offline provider for development, tests and demos.
 * Titles are fictional; IDs are stable so fixtures can be referenced in tests.
 */

function cast(list: Array<[string, string]>, startId = 1000): CastMember[] {
  return list.map(([character, name], i) => ({
    externalPersonId: startId + i,
    name,
    character,
    profilePath: null,
    order: i,
    episodeCount: null,
  }));
}

function episodes(season: number, count: number, startDate: string, baseId: number, names?: string[]): SeasonDetails['episodes'] {
  const start = new Date(startDate);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    return {
      externalId: baseId + i,
      seasonNumber: season,
      episodeNumber: i + 1,
      name: names?.[i] ?? `Episode ${i + 1}`,
      overview: `Season ${season}, episode ${i + 1} of a fictional story used for development.`,
      stillPath: null,
      airDate: d.toISOString().slice(0, 10),
      runtime: 45,
      voteAverage: 7.5 + ((i * 37) % 20) / 10,
      guestStars: i % 3 === 0 ? cast([[`Guest ${i + 1}`, `Performer ${i + 1}`]], 5000 + i) : [],
    };
  });
}

const SHOWS: ShowDetails[] = [
  {
    type: 'show',
    provider: 'fixture',
    externalId: 1,
    imdbId: null,
    tvdbId: 9001,
    title: 'Harbor Lights',
    originalTitle: 'Harbor Lights',
    slug: slugify('Harbor Lights'),
    overview: 'A lighthouse keeper and a marine biologist uncover a town-wide secret one tide at a time.',
    tagline: 'Every tide tells a story.',
    posterPath: null,
    backdropPath: null,
    releaseDate: '2024-01-07',
    lastAirDate: '2025-04-20',
    nextEpisodeAirDate: null,
    status: 'Returning Series',
    genres: [{ id: 18, name: 'Drama' }, { id: 9648, name: 'Mystery' }],
    networks: [{ id: 1, name: 'Fixture TV', logoPath: null }],
    originCountries: ['US'],
    originalLanguage: 'en',
    isAnime: false,
    popularity: 420,
    voteAverage: 8.2,
    voteCount: 1200,
    homepage: null,
    trailerKey: 'aqz-KE-bpKQ',
    certification: 'TV-14',
    cast: cast([
      ['June Calder', 'Mara Quinn'],
      ['Elias Brandt', 'Theo Marsh'],
      ['Ollie', 'Sam Ferreira'],
    ]),
    episodeRuntime: 45,
    seasonCount: 2,
    episodeCount: 16,
    seasons: [
      { externalId: 11, seasonNumber: 1, name: 'Season 1', overview: null, posterPath: null, airDate: '2024-01-07', episodeCount: 8 },
      { externalId: 12, seasonNumber: 2, name: 'Season 2', overview: null, posterPath: null, airDate: '2025-03-02', episodeCount: 8 },
    ],
    seasonDetails: [
      { externalId: 11, seasonNumber: 1, name: 'Season 1', overview: null, posterPath: null, airDate: '2024-01-07', episodeCount: 8, episodes: episodes(1, 8, '2024-01-07', 1100, ['Low Tide', 'The Keeper', 'Salt', 'Fog Signal', 'Undertow', 'Driftwood', 'Beacon', 'High Water']) },
      { externalId: 12, seasonNumber: 2, name: 'Season 2', overview: null, posterPath: null, airDate: '2025-03-02', episodeCount: 8, episodes: episodes(2, 8, '2025-03-02', 1200) },
    ],
  },
  {
    type: 'show',
    provider: 'fixture',
    externalId: 2,
    imdbId: null,
    tvdbId: 9002,
    title: 'Paper Lantern Academy',
    originalTitle: '紙提灯学園',
    slug: slugify('Paper Lantern Academy'),
    overview: 'First-years at a school for lantern makers discover their creations can hold memories.',
    tagline: null,
    posterPath: null,
    backdropPath: null,
    releaseDate: '2025-04-05',
    lastAirDate: '2025-06-28',
    nextEpisodeAirDate: null,
    status: 'Ended',
    genres: [{ id: 16, name: 'Animation' }, { id: 18, name: 'Drama' }],
    networks: [{ id: 2, name: 'Fixture Anime', logoPath: null }],
    originCountries: ['JP'],
    originalLanguage: 'ja',
    isAnime: true,
    popularity: 610,
    voteAverage: 8.7,
    voteCount: 900,
    homepage: null,
    trailerKey: null,
    certification: 'TV-PG',
    cast: cast([
      ['Hikari Sato', 'Aoi Tanaka'],
      ['Ren Mochizuki', 'Kenta Ishida'],
      ['Headmistress Oda', 'Yumi Kobayashi'],
    ], 2000),
    episodeRuntime: 24,
    seasonCount: 1,
    episodeCount: 12,
    seasons: [{ externalId: 21, seasonNumber: 1, name: 'Season 1', overview: null, posterPath: null, airDate: '2025-04-05', episodeCount: 12 }],
    seasonDetails: [
      { externalId: 21, seasonNumber: 1, name: 'Season 1', overview: null, posterPath: null, airDate: '2025-04-05', episodeCount: 12, episodes: episodes(1, 12, '2025-04-05', 2100).map((e) => ({ ...e, runtime: 24 })) },
    ],
  },
  {
    type: 'show',
    provider: 'fixture',
    externalId: 3,
    imdbId: null,
    tvdbId: 9003,
    title: 'Endless Tide',
    originalTitle: '終わらない潮',
    slug: slugify('Endless Tide'),
    overview: 'A crew of misfits sails an ocean that never ends, one island and one episode at a time.',
    tagline: 'The horizon keeps moving.',
    posterPath: null,
    backdropPath: null,
    releaseDate: '2018-01-07',
    lastAirDate: '2026-10-11',
    nextEpisodeAirDate: '2026-10-25',
    status: 'Returning Series',
    genres: [{ id: 16, name: 'Animation' }, { id: 10759, name: 'Action & Adventure' }, { id: 35, name: 'Comedy' }],
    networks: [{ id: 2, name: 'Fixture Anime', logoPath: null }],
    originCountries: ['JP'],
    originalLanguage: 'ja',
    isAnime: true,
    popularity: 880,
    voteAverage: 8.6,
    voteCount: 4200,
    homepage: null,
    trailerKey: null,
    certification: 'TV-14',
    cast: cast([
      ['Captain Mio', 'Sora Aikawa'],
      ['Navigator Tetsu', 'Daichi Mori'],
      ['Cook Benji', 'Akira Fujii'],
      ['Doctor Ume', 'Mei Hoshino'],
      ['Shipwright Gan', 'Ryo Kuroda'],
      ['Sniper Kiko', 'Nana Ueda'],
      ['Archaeologist Rei', 'Emi Sakurai'],
      ['Swordsman Jin', 'Takumi Oda'],
      ['Musician Bones', 'Hiro Yamada'],
      ['Helmsman Kai', 'Jun Nishida'],
    ], 6000),
    episodeRuntime: 24,
    seasonCount: 3,
    episodeCount: 450,
    seasons: [
      { externalId: 31, seasonNumber: 1, name: 'East Sea', overview: null, posterPath: null, airDate: '2018-01-07', episodeCount: 150 },
      { externalId: 32, seasonNumber: 2, name: 'Grand Current', overview: null, posterPath: null, airDate: '2020-11-29', episodeCount: 150 },
      { externalId: 33, seasonNumber: 3, name: 'New World', overview: null, posterPath: null, airDate: '2023-10-22', episodeCount: 150 },
    ],
    seasonDetails: [1, 2, 3].map((n) => {
      const start = ['2018-01-07', '2020-11-29', '2023-10-22'][n - 1]!;
      return { externalId: 30 + n, seasonNumber: n, name: ['East Sea', 'Grand Current', 'New World'][n - 1]!, overview: null, posterPath: null, airDate: start, episodeCount: 150, episodes: episodes(n, 150, start, 30000 + n * 1000).map((e) => ({ ...e, runtime: 24 })) };
    }),
  },
  // A long-running procedural: 24 seasons, for layouts that must cope with many seasons.
  (() => {
    const seasonStart = (n: number) => `${1990 + n}-09-15`;
    const numbers = Array.from({ length: 24 }, (_, i) => i + 1);
    return {
      type: 'show' as const,
      provider: 'fixture',
      externalId: 4,
      imdbId: null,
      tvdbId: 9004,
      title: 'Precinct Nine',
      originalTitle: 'Precinct Nine',
      slug: slugify('Precinct Nine'),
      overview: 'Two dozen years of cases at the busiest station house in a fictional city.',
      tagline: 'Every shift has a story.',
      posterPath: null,
      backdropPath: null,
      releaseDate: seasonStart(1),
      lastAirDate: '2015-05-20',
      nextEpisodeAirDate: null,
      status: 'Ended',
      genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }],
      networks: [{ id: 3, name: 'Fixture Broadcasting', logoPath: null }],
      originCountries: ['US'],
      originalLanguage: 'en',
      isAnime: false,
      popularity: 120,
      voteAverage: 7.8,
      voteCount: 900,
      homepage: null,
      trailerKey: null,
      certification: 'TV-14',
      cast: cast([['Captain Ortiz', 'Dana Wells'], ['Detective Hale', 'Marcus Lee']], 7000),
      episodeRuntime: 44,
      seasonCount: 24,
      episodeCount: 96,
      seasons: numbers.map((n) => ({ externalId: 400 + n, seasonNumber: n, name: `Season ${n}`, overview: null, posterPath: null, airDate: seasonStart(n), episodeCount: 4 })),
      seasonDetails: numbers.map((n) => ({ externalId: 400 + n, seasonNumber: n, name: `Season ${n}`, overview: null, posterPath: null, airDate: seasonStart(n), episodeCount: 4, episodes: episodes(n, 4, seasonStart(n), 40000 + n * 100) })),
    } satisfies ShowDetails;
  })(),
];

const MOVIES: MovieDetails[] = [
  {
    type: 'movie',
    provider: 'fixture',
    externalId: 101,
    imdbId: 'tt9000101',
    title: 'The Quiet Orbit',
    originalTitle: 'The Quiet Orbit',
    slug: slugify('The Quiet Orbit'),
    overview: 'Two engineers on a decommissioned station have one week to bring it home.',
    tagline: 'Gravity is optional. Letting go is not.',
    posterPath: null,
    backdropPath: null,
    releaseDate: '2025-02-14',
    status: 'Released',
    genres: [{ id: 878, name: 'Science Fiction' }, { id: 18, name: 'Drama' }],
    originCountries: ['GB'],
    originalLanguage: 'en',
    isAnime: false,
    popularity: 380,
    voteAverage: 7.9,
    voteCount: 2100,
    homepage: null,
    trailerKey: null,
    certification: 'PG-13',
    cast: cast([
      ['Dr. Imani Rowe', 'Zadie Clarke'],
      ['Pavel Sorin', 'Luka Petrov'],
    ], 3000),
    runtime: 118,
  },
  {
    type: 'movie',
    provider: 'fixture',
    externalId: 102,
    imdbId: 'tt9000102',
    title: 'Summer of the Fox',
    originalTitle: '狐の夏',
    slug: slugify('Summer of the Fox'),
    overview: 'A girl spends one last summer in her grandmother’s village, where a fox keeps returning her lost things.',
    tagline: null,
    posterPath: null,
    backdropPath: null,
    releaseDate: '2024-07-19',
    status: 'Released',
    genres: [{ id: 16, name: 'Animation' }, { id: 10751, name: 'Family' }],
    originCountries: ['JP'],
    originalLanguage: 'ja',
    isAnime: true,
    popularity: 290,
    voteAverage: 8.4,
    voteCount: 1500,
    homepage: null,
    trailerKey: null,
    certification: 'PG',
    cast: cast([
      ['Nao', 'Rin Takahashi'],
      ['The Fox', 'Haru Nakamura'],
    ], 4000),
    runtime: 96,
  },
];

function summary(d: ShowDetails | MovieDetails): MediaSummary {
  return {
    provider: d.provider,
    externalId: d.externalId,
    type: d.type,
    title: d.title,
    originalTitle: d.originalTitle,
    overview: d.overview,
    posterPath: d.posterPath,
    backdropPath: d.backdropPath,
    releaseDate: d.releaseDate,
    popularity: d.popularity,
    voteAverage: d.voteAverage,
    voteCount: d.voteCount,
    genreIds: d.genres.map((g) => g.id),
    originCountries: d.originCountries,
    originalLanguage: d.originalLanguage,
    isAnime: d.isAnime,
  };
}

function page(results: MediaSummary[]): PagedResult<MediaSummary> {
  return { page: 1, totalPages: 1, totalResults: results.length, results };
}

export class FixtureProvider implements MetadataProvider {
  readonly id = 'fixture';

  async search(query: string, options: SearchOptions = {}): Promise<PagedResult<MediaSummary>> {
    const q = query.trim().toLowerCase();
    const all = [...SHOWS, ...MOVIES].filter((m) => !options.type || options.type === 'all' || m.type === options.type);
    return page(all.filter((m) => !q || m.title.toLowerCase().includes(q) || (m.originalTitle ?? '').toLowerCase().includes(q)).map(summary));
  }

  async trending(type: MediaType | 'all', _window: TrendingWindow = 'week'): Promise<PagedResult<MediaSummary>> {
    const all = [...SHOWS, ...MOVIES].filter((m) => type === 'all' || m.type === type);
    return page(all.sort((a, b) => b.popularity - a.popularity).map(summary));
  }

  async discover(category: DiscoverCategory, sort: DiscoverSort, _page = 1, filters: DiscoverFilters = {}): Promise<PagedResult<MediaSummary>> {
    const all = [...SHOWS, ...MOVIES];
    const today = new Date().toISOString().slice(0, 10);
    let filtered =
      category === 'anime' ? all.filter((m) => m.isAnime) : category === 'shows' ? all.filter((m) => m.type === 'show' && !m.isAnime) : all.filter((m) => m.type === 'movie' && !m.isAnime);
    if (filters.genreIds?.length) filtered = filtered.filter((m) => filters.genreIds!.every((g) => m.genres.some((x) => x.id === g)));
    if (sort === 'upcoming') filtered = filtered.filter((m) => m.releaseDate && m.releaseDate > today);
    if (sort === 'airing') filtered = filtered.filter((m) => m.type === 'show' && m.status === 'Returning Series');
    if (sort === 'top_rated') filtered.sort((a, b) => b.voteAverage - a.voteAverage);
    else if (sort === 'newest') filtered.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
    else filtered.sort((a, b) => b.popularity - a.popularity);
    return page(filtered.map(summary));
  }

  async getShow(externalId: number, options: { seasons?: SeasonSelection } = {}): Promise<ShowDetails | null> {
    const s = SHOWS.find((x) => x.externalId === externalId);
    if (!s) return null;
    const copy = structuredClone(s);
    const selection = options.seasons ?? 'all';
    const wanted = selection === 'all' ? null : typeof selection === 'function' ? selection(copy.seasons) : selection;
    if (wanted) copy.seasonDetails = copy.seasonDetails.filter((d) => wanted.includes(d.seasonNumber));
    return copy;
  }

  async getSeason(showExternalId: number, seasonNumber: number): Promise<SeasonDetails | null> {
    const s = SHOWS.find((x) => x.externalId === showExternalId);
    const season = s?.seasonDetails.find((x) => x.seasonNumber === seasonNumber);
    return season ? structuredClone(season) : null;
  }

  async getMovie(externalId: number): Promise<MovieDetails | null> {
    const m = MOVIES.find((x) => x.externalId === externalId);
    return m ? structuredClone(m) : null;
  }

  /** Fixture TheTVDB episode ids are `showTvdbId * 10000 + season * 1000 + episode`. */
  async findByExternalId(source: ExternalSource, id: string | number): Promise<ExternalMatches> {
    const none: ExternalMatches = { shows: [], movies: [], episodes: [] };
    if (source === 'imdb') return { ...none, movies: MOVIES.filter((m) => m.imdbId === String(id)).map((m) => m.externalId) };
    const n = Number(id);
    const show = SHOWS.find((x) => x.tvdbId === n);
    if (show) return { ...none, shows: [show.externalId] };
    const owner = SHOWS.find((x) => x.tvdbId === Math.floor(n / 10000));
    if (!owner) return none;
    const seasonNumber = Math.floor((n % 10000) / 1000);
    const episodeNumber = n % 1000;
    const exists = owner.seasonDetails.some((d) => d.seasonNumber === seasonNumber && d.episodes.some((e) => e.episodeNumber === episodeNumber));
    return exists ? { ...none, episodes: [{ showId: owner.externalId, seasonNumber, episodeNumber }] } : none;
  }

  async getEpisodeGuestStars(showExternalId: number, seasonNumber: number, episodeNumber: number): Promise<CastMember[]> {
    const season = await this.getSeason(showExternalId, seasonNumber);
    return season?.episodes.find((e) => e.episodeNumber === episodeNumber)?.guestStars ?? [];
  }

  async getPerson(externalId: number): Promise<PersonDetails | null> {
    const roles = [...SHOWS, ...MOVIES].flatMap((m) => m.cast.filter((c) => c.externalPersonId === externalId).map((c) => ({ m, c })));
    const first = roles[0];
    if (!first) return null;
    return {
      provider: 'fixture',
      externalId,
      name: first.c.name,
      biography: `${first.c.name} is a fictional performer used for development. Best known as ${first.c.character} in ${first.m.title}.`,
      birthday: '1990-04-12',
      deathday: null,
      placeOfBirth: 'Fixture City',
      profilePath: null,
      knownForDepartment: 'Acting',
      alsoKnownAs: [],
      homepage: null,
      imdbId: null,
      images: [],
      credits: roles.map(({ m, c }) => ({
        type: m.type,
        externalId: m.externalId,
        title: m.title,
        posterPath: m.posterPath,
        backdropPath: m.backdropPath,
        releaseDate: m.releaseDate,
        role: c.character,
        department: 'cast' as const,
        episodeCount: c.episodeCount,
        popularity: m.popularity,
        voteAverage: m.voteAverage,
        voteCount: m.voteCount,
        genreIds: m.genres.map((g) => g.id),
        isAnime: m.isAnime,
      })),
    };
  }

  async getGenres(type: MediaType): Promise<Genre[]> {
    const seen = new Map<number, Genre>();
    for (const m of [...SHOWS, ...MOVIES]) if (m.type === type) for (const g of m.genres) seen.set(g.id, g);
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }
}
