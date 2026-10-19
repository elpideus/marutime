/**
 * Provider-agnostic metadata types. Every provider maps its payloads to these
 * shapes so the rest of the system never depends on a specific API.
 */

export type MediaType = 'show' | 'movie';

export type Genre = { id: number; name: string };
export type Network = { id: number; name: string; logoPath: string | null };

export type MediaSummary = {
  provider: string;
  externalId: number;
  type: MediaType;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
  originCountries: string[];
  originalLanguage: string | null;
  isAnime: boolean;
};

export type CastMember = {
  externalPersonId: number | null;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
  episodeCount: number | null;
};

export type SeasonSummary = {
  externalId: number | null;
  seasonNumber: number;
  name: string | null;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodeCount: number;
};

export type EpisodeDetails = {
  externalId: number | null;
  seasonNumber: number;
  episodeNumber: number;
  name: string | null;
  overview: string | null;
  stillPath: string | null;
  airDate: string | null;
  runtime: number | null;
  voteAverage: number;
  guestStars: CastMember[];
};

export type SeasonDetails = SeasonSummary & { episodes: EpisodeDetails[] };

type BaseDetails = {
  provider: string;
  externalId: number;
  imdbId: string | null;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  tagline: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  status: string | null;
  genres: Genre[];
  originCountries: string[];
  originalLanguage: string | null;
  isAnime: boolean;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  homepage: string | null;
  trailerKey: string | null;
  certification: string | null;
  cast: CastMember[];
};

export type ShowDetails = BaseDetails & {
  type: 'show';
  tvdbId: number | null;
  lastAirDate: string | null;
  nextEpisodeAirDate: string | null;
  networks: Network[];
  episodeRuntime: number | null;
  seasonCount: number;
  episodeCount: number;
  seasons: SeasonSummary[];
  /** Seasons whose episodes were fetched alongside the show (may be partial). */
  seasonDetails: SeasonDetails[];
};

export type MovieDetails = BaseDetails & {
  type: 'movie';
  runtime: number | null;
};

export type MediaDetails = ShowDetails | MovieDetails;

export type PersonCredit = {
  type: MediaType;
  externalId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  /** Character played (cast) or job (crew). */
  role: string | null;
  department: 'cast' | 'crew';
  episodeCount: number | null;
  popularity: number;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
  isAnime: boolean;
};

export type PersonDetails = {
  provider: string;
  externalId: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownForDepartment: string | null;
  alsoKnownAs: string[];
  homepage: string | null;
  imdbId: string | null;
  /** Up to a few extra portraits. */
  images: string[];
  /** Deduplicated works, most notable first. */
  credits: PersonCredit[];
};

export type DiscoverFilters = {
  /** All of these genres must match. */
  genreIds?: number[];
};

export type SearchOptions = { type?: MediaType | 'all'; page?: number; year?: number };
export type PagedResult<T> = { page: number; totalPages: number; totalResults: number; results: T[] };

export type TrendingWindow = 'day' | 'week';

export type DiscoverCategory = 'shows' | 'movies' | 'anime';
export type DiscoverSort = 'trending' | 'popular' | 'top_rated' | 'upcoming' | 'airing' | 'newest';

export interface MetadataProvider {
  readonly id: string;
  search(query: string, options?: SearchOptions): Promise<PagedResult<MediaSummary>>;
  trending(type: MediaType | 'all', window?: TrendingWindow, page?: number): Promise<PagedResult<MediaSummary>>;
  discover(category: DiscoverCategory, sort: DiscoverSort, page?: number, filters?: DiscoverFilters): Promise<PagedResult<MediaSummary>>;
  /**
   * `seasons` picks which seasons' episodes to fetch: none, all, a fixed list,
   * or a function of the season list (for incremental refreshes).
   */
  getShow(externalId: number, options?: { seasons?: SeasonSelection }): Promise<ShowDetails | null>;
  getSeason(showExternalId: number, seasonNumber: number): Promise<SeasonDetails | null>;
  getMovie(externalId: number): Promise<MovieDetails | null>;
  getEpisodeGuestStars(showExternalId: number, seasonNumber: number, episodeNumber: number): Promise<CastMember[]>;
  getPerson(externalId: number): Promise<PersonDetails | null>;
  getGenres(type: MediaType): Promise<Genre[]>;
}

export type SeasonSelection = number[] | 'all' | ((seasons: SeasonSummary[]) => number[]);

export class MetadataError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'MetadataError';
  }
}
