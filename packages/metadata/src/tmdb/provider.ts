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
import { classifyAnime, emptyPage, slugify } from '../util';
import { TmdbClient, type TmdbAuth } from './client';

/* ---------- Raw TMDB payload shapes (only the fields we read) ---------- */

type RawGenre = { id: number; name: string };
type RawNetwork = { id: number; name: string; logo_path: string | null };

type RawSummary = {
  id: number;
  media_type?: 'tv' | 'movie' | 'person';
  name?: string;
  title?: string;
  original_name?: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  release_date?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  origin_country?: string[];
  original_language?: string;
};

type RawPaged<T> = { page: number; total_pages: number; total_results: number; results: T[] };

type RawCast = { id: number; name: string; character?: string; profile_path: string | null; order?: number };
type RawAggregateCast = {
  id: number;
  name: string;
  profile_path: string | null;
  order?: number;
  total_episode_count?: number;
  roles?: Array<{ character: string; episode_count: number }>;
};

type RawEpisode = {
  id: number;
  season_number: number;
  episode_number: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  air_date?: string | null;
  runtime?: number | null;
  vote_average?: number;
  guest_stars?: RawCast[];
};

type RawSeason = {
  id: number;
  season_number: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  air_date?: string | null;
  episode_count?: number;
  episodes?: RawEpisode[];
};

type RawVideos = { results?: Array<{ key: string; site: string; type: string; official?: boolean }> };

type RawShow = RawSummary & {
  status?: string;
  tagline?: string;
  genres?: RawGenre[];
  networks?: RawNetwork[];
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  last_air_date?: string | null;
  next_episode_to_air?: { air_date?: string | null } | null;
  homepage?: string;
  seasons?: RawSeason[];
  external_ids?: { imdb_id?: string | null; tvdb_id?: number | null };
  aggregate_credits?: { cast?: RawAggregateCast[] };
  content_ratings?: { results?: Array<{ iso_3166_1: string; rating: string }> };
  videos?: RawVideos;
  keywords?: { results?: Array<{ id: number }> };
} & Record<string, unknown>;

type RawMovie = RawSummary & {
  status?: string;
  tagline?: string;
  genres?: RawGenre[];
  runtime?: number | null;
  imdb_id?: string | null;
  homepage?: string;
  production_countries?: Array<{ iso_3166_1: string }>;
  credits?: { cast?: RawCast[] };
  release_dates?: { results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> };
  videos?: RawVideos;
  keywords?: { keywords?: Array<{ id: number }> };
};

/* ---------- Mappers ---------- */

const PROVIDER_ID = 'tmdb';
const SEASON_APPEND_LIMIT = 20;

function pickTrailer(videos?: RawVideos): string | null {
  const list = videos?.results ?? [];
  const yt = list.filter((v) => v.site === 'YouTube');
  return (
    yt.find((v) => v.type === 'Trailer' && v.official)?.key ??
    yt.find((v) => v.type === 'Trailer')?.key ??
    yt.find((v) => v.type === 'Teaser')?.key ??
    null
  );
}

function mapSummary(raw: RawSummary, forcedType?: MediaType): MediaSummary | null {
  const type: MediaType | null = forcedType ?? (raw.media_type === 'tv' ? 'show' : raw.media_type === 'movie' ? 'movie' : null);
  if (!type) return null;
  const title = (type === 'show' ? raw.name : raw.title) ?? raw.name ?? raw.title ?? 'Untitled';
  const genreIds = raw.genre_ids ?? [];
  const originCountries = raw.origin_country ?? [];
  return {
    provider: PROVIDER_ID,
    externalId: raw.id,
    type,
    title,
    originalTitle: (type === 'show' ? raw.original_name : raw.original_title) ?? null,
    overview: raw.overview || null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    releaseDate: (type === 'show' ? raw.first_air_date : raw.release_date) || null,
    popularity: raw.popularity ?? 0,
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    genreIds,
    originCountries,
    originalLanguage: raw.original_language ?? null,
    isAnime: classifyAnime({ genreIds, originCountries, originalLanguage: raw.original_language ?? null }),
  };
}

function mapPaged(raw: RawPaged<RawSummary> | null, forcedType?: MediaType): PagedResult<MediaSummary> {
  if (!raw) return emptyPage();
  return {
    page: raw.page,
    totalPages: Math.min(raw.total_pages, 500),
    totalResults: raw.total_results,
    results: raw.results.map((r) => mapSummary(r, forcedType)).filter((r): r is MediaSummary => r !== null),
  };
}

function mapCast(raw: RawCast[] | undefined): CastMember[] {
  return (raw ?? []).slice(0, 60).map((c, i) => ({
    externalPersonId: c.id,
    name: c.name,
    character: c.character?.trim() || 'Unknown role',
    profilePath: c.profile_path,
    order: c.order ?? i,
    episodeCount: null,
  }));
}

function mapAggregateCast(raw: RawAggregateCast[] | undefined): CastMember[] {
  const out: CastMember[] = [];
  for (const c of (raw ?? []).slice(0, 80)) {
    const roles = (c.roles ?? []).filter((r) => r.character?.trim());
    if (roles.length === 0) {
      out.push({ externalPersonId: c.id, name: c.name, character: 'Unknown role', profilePath: c.profile_path, order: c.order ?? out.length, episodeCount: c.total_episode_count ?? null });
      continue;
    }
    for (const role of roles.slice(0, 3)) {
      out.push({
        externalPersonId: c.id,
        name: c.name,
        character: role.character.trim(),
        profilePath: c.profile_path,
        order: c.order ?? out.length,
        episodeCount: role.episode_count,
      });
    }
  }
  return out;
}

function mapEpisode(raw: RawEpisode): SeasonDetails['episodes'][number] {
  return {
    externalId: raw.id,
    seasonNumber: raw.season_number,
    episodeNumber: raw.episode_number,
    name: raw.name || null,
    overview: raw.overview || null,
    stillPath: raw.still_path ?? null,
    airDate: raw.air_date || null,
    runtime: raw.runtime ?? null,
    voteAverage: raw.vote_average ?? 0,
    guestStars: mapCast(raw.guest_stars),
  };
}

function mapSeason(raw: RawSeason): SeasonDetails {
  return {
    externalId: raw.id,
    seasonNumber: raw.season_number,
    name: raw.name || null,
    overview: raw.overview || null,
    posterPath: raw.poster_path ?? null,
    airDate: raw.air_date || null,
    episodeCount: raw.episode_count ?? raw.episodes?.length ?? 0,
    episodes: (raw.episodes ?? []).map(mapEpisode),
  };
}

function mapShow(raw: RawShow): ShowDetails {
  const genres = raw.genres ?? [];
  const genreIds = genres.map((g) => g.id);
  const originCountries = raw.origin_country ?? [];
  const keywordIds = raw.keywords?.results?.map((k) => k.id) ?? [];
  const title = raw.name ?? 'Untitled';
  const seasons = (raw.seasons ?? []).map((s) => ({ ...mapSeason(s), episodes: [] }));
  const seasonDetails: SeasonDetails[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith('season/') && value && typeof value === 'object' && 'episodes' in (value as object)) {
      seasonDetails.push(mapSeason(value as RawSeason));
    }
  }
  const ratings = raw.content_ratings?.results ?? [];
  const certification = ratings.find((r) => r.iso_3166_1 === 'US')?.rating ?? ratings[0]?.rating ?? null;
  return {
    type: 'show',
    provider: PROVIDER_ID,
    externalId: raw.id,
    imdbId: raw.external_ids?.imdb_id ?? null,
    tvdbId: raw.external_ids?.tvdb_id ?? null,
    title,
    originalTitle: raw.original_name ?? null,
    slug: slugify(title),
    overview: raw.overview || null,
    tagline: raw.tagline || null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    releaseDate: raw.first_air_date || null,
    lastAirDate: raw.last_air_date || null,
    nextEpisodeAirDate: raw.next_episode_to_air?.air_date || null,
    status: raw.status ?? null,
    genres,
    networks: (raw.networks ?? []).map((n) => ({ id: n.id, name: n.name, logoPath: n.logo_path })),
    originCountries,
    originalLanguage: raw.original_language ?? null,
    isAnime: classifyAnime({ genreIds, originCountries, originalLanguage: raw.original_language ?? null, keywordIds }),
    popularity: raw.popularity ?? 0,
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    homepage: raw.homepage || null,
    trailerKey: pickTrailer(raw.videos),
    certification,
    cast: mapAggregateCast(raw.aggregate_credits?.cast),
    episodeRuntime: raw.episode_run_time?.[0] ?? null,
    seasonCount: raw.number_of_seasons ?? seasons.filter((s) => s.seasonNumber > 0).length,
    episodeCount: raw.number_of_episodes ?? 0,
    seasons,
    seasonDetails,
  };
}

function mapMovie(raw: RawMovie): MovieDetails {
  const genres = raw.genres ?? [];
  const genreIds = genres.map((g) => g.id);
  const originCountries = (raw.production_countries ?? []).map((c) => c.iso_3166_1);
  const keywordIds = raw.keywords?.keywords?.map((k) => k.id) ?? [];
  const title = raw.title ?? 'Untitled';
  const releases = raw.release_dates?.results ?? [];
  const us = releases.find((r) => r.iso_3166_1 === 'US');
  const certification = us?.release_dates.find((d) => d.certification)?.certification ?? null;
  return {
    type: 'movie',
    provider: PROVIDER_ID,
    externalId: raw.id,
    imdbId: raw.imdb_id ?? null,
    title,
    originalTitle: raw.original_title ?? null,
    slug: slugify(title),
    overview: raw.overview || null,
    tagline: raw.tagline || null,
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    releaseDate: raw.release_date || null,
    status: raw.status ?? null,
    genres,
    originCountries,
    originalLanguage: raw.original_language ?? null,
    isAnime: classifyAnime({ genreIds, originCountries, originalLanguage: raw.original_language ?? null, keywordIds }),
    popularity: raw.popularity ?? 0,
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    homepage: raw.homepage || null,
    trailerKey: pickTrailer(raw.videos),
    certification,
    cast: mapCast(raw.credits?.cast),
    runtime: raw.runtime ?? null,
  };
}

/* ---------- Provider ---------- */

export class TmdbProvider implements MetadataProvider {
  readonly id = PROVIDER_ID;
  private readonly client: TmdbClient;

  constructor(auth: TmdbAuth, options: { language?: string } = {}) {
    this.client = new TmdbClient(auth, options);
  }

  async search(query: string, options: SearchOptions = {}): Promise<PagedResult<MediaSummary>> {
    const q = query.trim();
    if (!q) return emptyPage();
    const page = options.page ?? 1;
    const type = options.type ?? 'all';
    const params = { query: q, page, include_adult: false, year: options.year };
    if (type === 'show') return mapPaged(await this.client.get<RawPaged<RawSummary>>('/search/tv', { ...params, first_air_date_year: options.year, year: undefined }, { revalidate: 600 }), 'show');
    if (type === 'movie') return mapPaged(await this.client.get<RawPaged<RawSummary>>('/search/movie', params, { revalidate: 600 }), 'movie');
    return mapPaged(await this.client.get<RawPaged<RawSummary>>('/search/multi', { query: q, page, include_adult: false }, { revalidate: 600 }));
  }

  async trending(type: MediaType | 'all', window: TrendingWindow = 'week', page = 1): Promise<PagedResult<MediaSummary>> {
    const seg = type === 'show' ? 'tv' : type === 'movie' ? 'movie' : 'all';
    return mapPaged(await this.client.get<RawPaged<RawSummary>>(`/trending/${seg}/${window}`, { page }, { revalidate: 3600 }), type === 'all' ? undefined : type);
  }

  async discover(category: DiscoverCategory, sort: DiscoverSort, page = 1): Promise<PagedResult<MediaSummary>> {
    const today = new Date().toISOString().slice(0, 10);
    if (category === 'anime') {
      const sortBy = sort === 'top_rated' ? 'vote_average.desc' : 'popularity.desc';
      const common = { page, with_genres: 16, with_origin_country: 'JP', sort_by: sortBy, 'vote_count.gte': sort === 'top_rated' ? 200 : 20, include_adult: false };
      if (sort === 'upcoming') {
        return mapPaged(await this.client.get<RawPaged<RawSummary>>('/discover/tv', { ...common, 'first_air_date.gte': today, sort_by: 'popularity.desc' }, { revalidate: 3600 }), 'show');
      }
      if (sort === 'airing') {
        return mapPaged(await this.client.get<RawPaged<RawSummary>>('/discover/tv', { ...common, 'air_date.gte': today, 'air_date.lte': today, sort_by: 'popularity.desc' }, { revalidate: 3600 }), 'show');
      }
      return mapPaged(await this.client.get<RawPaged<RawSummary>>('/discover/tv', common, { revalidate: 3600 }), 'show');
    }
    if (category === 'shows') {
      const path =
        sort === 'trending' ? '/trending/tv/week' : sort === 'popular' ? '/tv/popular' : sort === 'top_rated' ? '/tv/top_rated' : sort === 'airing' ? '/tv/on_the_air' : '/tv/airing_today';
      return mapPaged(await this.client.get<RawPaged<RawSummary>>(path, { page }, { revalidate: 3600 }), 'show');
    }
    const path =
      sort === 'trending' ? '/trending/movie/week' : sort === 'popular' ? '/movie/popular' : sort === 'top_rated' ? '/movie/top_rated' : sort === 'upcoming' ? '/movie/upcoming' : '/movie/now_playing';
    return mapPaged(await this.client.get<RawPaged<RawSummary>>(path, { page }, { revalidate: 3600 }), 'movie');
  }

  async getShow(externalId: number, options: { seasons?: number[] | 'all' } = {}): Promise<ShowDetails | null> {
    const base = ['external_ids', 'aggregate_credits', 'content_ratings', 'videos', 'keywords'];
    const raw = await this.client.get<RawShow | null>(`/tv/${externalId}`, { append_to_response: base.join(',') }, { revalidate: 3600 });
    if (!raw) return null;
    const show = mapShow(raw);
    const wanted =
      options.seasons === 'all'
        ? show.seasons.map((s) => s.seasonNumber)
        : (options.seasons ?? []);
    if (wanted.length > 0) {
      const chunks: number[][] = [];
      for (let i = 0; i < wanted.length; i += SEASON_APPEND_LIMIT) chunks.push(wanted.slice(i, i + SEASON_APPEND_LIMIT));
      const details: SeasonDetails[] = [];
      for (const chunk of chunks) {
        const extra = await this.client.get<Record<string, RawSeason> | null>(
          `/tv/${externalId}`,
          { append_to_response: chunk.map((n) => `season/${n}`).join(',') },
          { revalidate: 3600 },
        );
        if (!extra) continue;
        for (const n of chunk) {
          const s = extra[`season/${n}`];
          if (s && s.episodes) details.push(mapSeason(s));
        }
      }
      show.seasonDetails = details;
    }
    return show;
  }

  async getSeason(showExternalId: number, seasonNumber: number): Promise<SeasonDetails | null> {
    const raw = await this.client.get<RawSeason | null>(`/tv/${showExternalId}/season/${seasonNumber}`, {}, { revalidate: 3600 });
    return raw ? mapSeason(raw) : null;
  }

  async getMovie(externalId: number): Promise<MovieDetails | null> {
    const raw = await this.client.get<RawMovie | null>(
      `/movie/${externalId}`,
      { append_to_response: 'credits,release_dates,videos,keywords' },
      { revalidate: 3600 },
    );
    return raw ? mapMovie(raw) : null;
  }

  async getEpisodeGuestStars(showExternalId: number, seasonNumber: number, episodeNumber: number): Promise<CastMember[]> {
    const raw = await this.client.get<{ guest_stars?: RawCast[]; cast?: RawCast[] } | null>(
      `/tv/${showExternalId}/season/${seasonNumber}/episode/${episodeNumber}/credits`,
      {},
      { revalidate: 86400 },
    );
    return mapCast(raw?.guest_stars);
  }
}

export const tmdbInternals = { mapSummary, mapShow, mapMovie, mapSeason };
