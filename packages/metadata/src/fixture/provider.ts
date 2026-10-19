import type {
  CastMember,
  DiscoverCategory,
  DiscoverSort,
  MediaSummary,
  MediaType,
  MetadataProvider,
  MovieDetails,
  PagedResult,
  SearchOptions,
  SeasonDetails,
  ShowDetails,
  TrendingWindow,
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
    tvdbId: null,
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
    trailerKey: null,
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
    tvdbId: null,
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
];

const MOVIES: MovieDetails[] = [
  {
    type: 'movie',
    provider: 'fixture',
    externalId: 101,
    imdbId: null,
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
    imdbId: null,
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

  async discover(category: DiscoverCategory, _sort: DiscoverSort): Promise<PagedResult<MediaSummary>> {
    const all = [...SHOWS, ...MOVIES];
    const filtered =
      category === 'anime' ? all.filter((m) => m.isAnime) : category === 'shows' ? all.filter((m) => m.type === 'show' && !m.isAnime) : all.filter((m) => m.type === 'movie' && !m.isAnime);
    return page(filtered.map(summary));
  }

  async getShow(externalId: number): Promise<ShowDetails | null> {
    const s = SHOWS.find((x) => x.externalId === externalId);
    return s ? structuredClone(s) : null;
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

  async getEpisodeGuestStars(showExternalId: number, seasonNumber: number, episodeNumber: number): Promise<CastMember[]> {
    const season = await this.getSeason(showExternalId, seasonNumber);
    return season?.episodes.find((e) => e.episodeNumber === episodeNumber)?.guestStars ?? [];
  }
}
