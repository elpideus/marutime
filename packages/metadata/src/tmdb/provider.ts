import type {
  CastMember,
  DiscoverCategory,
  DiscoverFilters,
  DiscoverSort,
  Genre,
  MediaSummary,
  MediaType,
  MetadataProvider,
  MovieDetails,
  PagedResult,
  PersonCredit,
  PersonDetails,
  SearchOptions,
  SeasonDetails,
  SeasonSelection,
  ShowDetails,
  TrendingWindow,
  ExternalMatches,
  ExternalSource,
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

type RawPersonCredit = RawSummary & {
  media_type?: 'tv' | 'movie';
  character?: string;
  job?: string;
  episode_count?: number;
  credit_id?: string;
};

type RawPerson = {
  id: number;
  name: string;
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  known_for_department?: string | null;
  also_known_as?: string[];
  homepage?: string | null;
  imdb_id?: string | null;
  images?: { profiles?: Array<{ file_path: string }> };
  combined_credits?: { cast?: RawPersonCredit[]; crew?: RawPersonCredit[] };
};

/** TV genres that are not "works" in the fan sense: talk shows, news, reality. */
const NON_FICTION_TV = new Set([10767, 10763, 10764]);

function mapPerson(raw: RawPerson): PersonDetails {
  const byKey = new Map<string, PersonCredit>();
  const add = (c: RawPersonCredit, department: 'cast' | 'crew') => {
    const type: MediaType | null = c.media_type === 'tv' ? 'show' : c.media_type === 'movie' ? 'movie' : null;
    if (!type) return;
    const summary = mapSummary(c, type);
    if (!summary) return;
    const role = department === 'cast' ? c.character?.trim() || null : c.job?.trim() || null;
    const key = `${type}:${c.id}`;
    const existing = byKey.get(key);
    if (existing) {
      if (role && existing.role && !existing.role.includes(role)) existing.role = `${existing.role}, ${role}`;
      else if (role && !existing.role) existing.role = role;
      if (department === 'cast') existing.department = 'cast';
      existing.episodeCount = Math.max(existing.episodeCount ?? 0, c.episode_count ?? 0) || null;
      return;
    }
    byKey.set(key, {
      type,
      externalId: c.id,
      title: summary.title,
      posterPath: summary.posterPath,
      backdropPath: summary.backdropPath,
      releaseDate: summary.releaseDate,
      role,
      department,
      episodeCount: c.episode_count ?? null,
      popularity: summary.popularity,
      voteAverage: summary.voteAverage,
      voteCount: summary.voteCount,
      genreIds: summary.genreIds,
      isAnime: summary.isAnime,
    });
  };
  for (const c of raw.combined_credits?.cast ?? []) add(c, 'cast');
  for (const c of raw.combined_credits?.crew ?? []) add(c, 'crew');
  const all = Array.from(byKey.values());
  const fiction = all.filter((c) => !(c.type === 'show' && c.genreIds.some((g) => NON_FICTION_TV.has(g))));
  const credits = (fiction.length >= 3 ? fiction : all)
    .sort((a, b) => b.voteCount - a.voteCount || b.popularity - a.popularity)
    .slice(0, 80);
  return {
    provider: PROVIDER_ID,
    externalId: raw.id,
    name: raw.name,
    biography: raw.biography?.trim() || null,
    birthday: raw.birthday || null,
    deathday: raw.deathday || null,
    placeOfBirth: raw.place_of_birth || null,
    profilePath: raw.profile_path ?? null,
    knownForDepartment: raw.known_for_department ?? null,
    alsoKnownAs: (raw.also_known_as ?? []).slice(0, 6),
    homepage: raw.homepage || null,
    imdbId: raw.imdb_id || null,
    images: (raw.images?.profiles ?? []).map((p) => p.file_path).filter((p) => p !== raw.profile_path).slice(0, 6),
    credits,
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
    if (type === 'show') return mapPaged(await this.client.get<RawPaged<RawSummary>>('/search/tv', { ...params, first_air_date_year: options.year, year: undefined }), 'show');
    if (type === 'movie') return mapPaged(await this.client.get<RawPaged<RawSummary>>('/search/movie', params), 'movie');
    return mapPaged(await this.client.get<RawPaged<RawSummary>>('/search/multi', { query: q, page, include_adult: false }));
  }

  async trending(type: MediaType | 'all', window: TrendingWindow = 'week', page = 1): Promise<PagedResult<MediaSummary>> {
    const seg = type === 'show' ? 'tv' : type === 'movie' ? 'movie' : 'all';
    return mapPaged(await this.client.get<RawPaged<RawSummary>>(`/trending/${seg}/${window}`, { page }), type === 'all' ? undefined : type);
  }

  async discover(category: DiscoverCategory, sort: DiscoverSort, page = 1, filters: DiscoverFilters = {}): Promise<PagedResult<MediaSummary>> {
    const today = new Date().toISOString().slice(0, 10);
    const genres = filters.genreIds ?? [];
    if (category !== 'anime' && genres.length === 0 && sort !== 'newest') {
      if (category === 'shows') {
        const path =
          sort === 'trending' ? '/trending/tv/week' : sort === 'popular' ? '/tv/popular' : sort === 'top_rated' ? '/tv/top_rated' : sort === 'airing' ? '/tv/on_the_air' : '/tv/airing_today';
        return mapPaged(await this.client.get<RawPaged<RawSummary>>(path, { page }), 'show');
      }
      const path =
        sort === 'trending' ? '/trending/movie/week' : sort === 'popular' ? '/movie/popular' : sort === 'top_rated' ? '/movie/top_rated' : sort === 'upcoming' ? '/movie/upcoming' : '/movie/now_playing';
      return mapPaged(await this.client.get<RawPaged<RawSummary>>(path, { page }), 'movie');
    }

    // Everything filtered (and all anime) goes through /discover so genres apply.
    const isMovie = category === 'movies';
    const dateField = isMovie ? 'primary_release_date' : 'first_air_date';
    const params: Record<string, string | number | boolean | undefined> = { page, include_adult: false, sort_by: 'popularity.desc', 'vote_count.gte': 10 };
    const withGenres = category === 'anime' ? [16, ...genres.filter((g) => g !== 16)] : genres;
    if (withGenres.length) params.with_genres = withGenres.join(',');
    if (category === 'anime') params.with_origin_country = 'JP';
    if (sort === 'top_rated') {
      params.sort_by = 'vote_average.desc';
      params['vote_count.gte'] = category === 'anime' ? 200 : 300;
    } else if (sort === 'newest') {
      params.sort_by = `${dateField}.desc`;
      params[`${dateField}.lte`] = today;
      params['vote_count.gte'] = 5;
    } else if (sort === 'upcoming') {
      params[`${dateField}.gte`] = today;
      params['vote_count.gte'] = undefined;
    } else if (sort === 'airing') {
      if (isMovie) {
        params['primary_release_date.gte'] = new Date(Date.now() - 35 * 86_400_000).toISOString().slice(0, 10);
        params['primary_release_date.lte'] = today;
      } else {
        params['air_date.gte'] = today;
        params['air_date.lte'] = today;
      }
      params['vote_count.gte'] = undefined;
    }
    return mapPaged(await this.client.get<RawPaged<RawSummary>>(isMovie ? '/discover/movie' : '/discover/tv', params), isMovie ? 'movie' : 'show');
  }

  async findByExternalId(source: ExternalSource, id: string | number): Promise<ExternalMatches> {
    type RawFind = { movie_results?: { id: number }[]; tv_results?: { id: number }[]; tv_episode_results?: { show_id: number; season_number: number; episode_number: number }[] };
    const raw = await this.client.get<RawFind | null>(`/find/${encodeURIComponent(String(id))}`, { external_source: source === 'tvdb' ? 'tvdb_id' : 'imdb_id' });
    return {
      shows: (raw?.tv_results ?? []).map((r) => r.id),
      movies: (raw?.movie_results ?? []).map((r) => r.id),
      episodes: (raw?.tv_episode_results ?? []).map((r) => ({ showId: r.show_id, seasonNumber: r.season_number, episodeNumber: r.episode_number })),
    };
  }

  async getShow(externalId: number, options: { seasons?: SeasonSelection } = {}): Promise<ShowDetails | null> {
    const base = ['external_ids', 'aggregate_credits', 'content_ratings', 'videos', 'keywords'];
    const raw = await this.client.get<RawShow | null>(`/tv/${externalId}`, { append_to_response: base.join(',') });
    if (!raw) return null;
    const show = mapShow(raw);
    const selection = options.seasons ?? [];
    const wanted = selection === 'all' ? show.seasons.map((s) => s.seasonNumber) : typeof selection === 'function' ? selection(show.seasons) : selection;
    if (wanted.length > 0) {
      const chunks: number[][] = [];
      for (let i = 0; i < wanted.length; i += SEASON_APPEND_LIMIT) chunks.push(wanted.slice(i, i + SEASON_APPEND_LIMIT));
      // Chunks are independent, so fetch them in parallel.
      const pages = await Promise.all(
        chunks.map((chunk) => this.client.get<Record<string, RawSeason> | null>(`/tv/${externalId}`, { append_to_response: chunk.map((n) => `season/${n}`).join(',') })),
      );
      const details: SeasonDetails[] = [];
      pages.forEach((extra, i) => {
        if (!extra) return;
        for (const n of chunks[i]!) {
          const s = extra[`season/${n}`];
          if (s && s.episodes) details.push(mapSeason(s));
        }
      });
      show.seasonDetails = details;
    }
    return show;
  }

  async getSeason(showExternalId: number, seasonNumber: number): Promise<SeasonDetails | null> {
    const raw = await this.client.get<RawSeason | null>(`/tv/${showExternalId}/season/${seasonNumber}`, {});
    return raw ? mapSeason(raw) : null;
  }

  async getMovie(externalId: number): Promise<MovieDetails | null> {
    const raw = await this.client.get<RawMovie | null>(
      `/movie/${externalId}`,
      { append_to_response: 'credits,release_dates,videos,keywords' },
    );
    return raw ? mapMovie(raw) : null;
  }

  async getEpisodeGuestStars(showExternalId: number, seasonNumber: number, episodeNumber: number): Promise<CastMember[]> {
    const raw = await this.client.get<{ guest_stars?: RawCast[]; cast?: RawCast[] } | null>(
      `/tv/${showExternalId}/season/${seasonNumber}/episode/${episodeNumber}/credits`,
      {},
    );
    return mapCast(raw?.guest_stars);
  }

  async getPerson(externalId: number): Promise<PersonDetails | null> {
    const raw = await this.client.get<RawPerson | null>(`/person/${externalId}`, { append_to_response: 'combined_credits,images' });
    return raw ? mapPerson(raw) : null;
  }

  async getGenres(type: MediaType): Promise<Genre[]> {
    const raw = await this.client.get<{ genres?: Genre[] } | null>(`/genre/${type === 'show' ? 'tv' : 'movie'}/list`);
    return raw?.genres ?? [];
  }
}

export const tmdbInternals = { mapSummary, mapShow, mapMovie, mapSeason, mapPerson };
