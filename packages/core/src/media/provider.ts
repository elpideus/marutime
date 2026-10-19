import { AniListClient, getMetadataProvider, type AniListCharacterDetails, type AniListStaffDetails, type MetadataProvider } from '@marutime/metadata';
import { cached, TTL } from '../cache';
import { todayIso } from '../utils';

const wrapped = new WeakMap<MetadataProvider, MetadataProvider>();

/**
 * The metadata provider behind MaruTime's cache. List-style calls (search,
 * trending, discover, people, genres) are cached in memory and Postgres with
 * stale-while-revalidate, so each upstream response is fetched once and then
 * refreshed occasionally in the background. Full show/movie details are not
 * cached here: `ensureMedia` persists them as rows, which is the cache.
 */
export function getProvider(inner: MetadataProvider = getMetadataProvider()): MetadataProvider {
  const existing = wrapped.get(inner);
  if (existing) return existing;
  const ns = `md:${inner.id}`;
  const provider: MetadataProvider = {
    id: inner.id,
    search: (query, options = {}) =>
      cached(
        `${ns}:search:${options.type ?? 'all'}:${options.page ?? 1}:${options.year ?? ''}:${query.trim().toLowerCase()}`,
        { ttl: 6 * TTL.hour, staleTtl: 3 * TTL.day, persist: true },
        () => inner.search(query, options),
      ),
    trending: (type, window = 'week', page = 1) =>
      cached(`${ns}:trending:${type}:${window}:${page}`, { ttl: 3 * TTL.hour, staleTtl: 2 * TTL.day, persist: true }, () => inner.trending(type, window, page)),
    discover: (category, sort, page = 1, filters = {}) => {
      // Date-relative lists ("airing today", "upcoming") must never serve yesterday's answer.
      const dated = sort === 'airing' || sort === 'upcoming' || sort === 'newest' ? `:${todayIso()}` : '';
      const genres = (filters.genreIds ?? []).slice().sort((a, b) => a - b).join('.');
      return cached(
        `${ns}:discover:${category}:${sort}:${page}:${genres}${dated}`,
        { ttl: sort === 'airing' ? 2 * TTL.hour : 6 * TTL.hour, staleTtl: dated ? 6 * TTL.hour : 2 * TTL.day, persist: true },
        () => inner.discover(category, sort, page, filters),
      );
    },
    getShow: (externalId, options) => inner.getShow(externalId, options),
    getMovie: (externalId) => inner.getMovie(externalId),
    getSeason: (showExternalId, seasonNumber) =>
      cached(`${ns}:season:${showExternalId}:${seasonNumber}`, { ttl: TTL.day, staleTtl: TTL.week, persist: true, nullTtl: TTL.hour }, () => inner.getSeason(showExternalId, seasonNumber)),
    getEpisodeGuestStars: (showExternalId, seasonNumber, episodeNumber) =>
      cached(`${ns}:guests:${showExternalId}:${seasonNumber}:${episodeNumber}`, { ttl: TTL.week, staleTtl: 4 * TTL.week, persist: true }, () => inner.getEpisodeGuestStars(showExternalId, seasonNumber, episodeNumber)),
    getPerson: (externalId) =>
      cached(`${ns}:person:${externalId}`, { ttl: TTL.week, staleTtl: 4 * TTL.week, persist: true, nullTtl: TTL.day }, () => inner.getPerson(externalId)),
    getGenres: (type) => cached(`${ns}:genres:${type}`, { ttl: 4 * TTL.week, staleTtl: 12 * TTL.week, persist: true }, () => inner.getGenres(type)),
  };
  wrapped.set(inner, provider);
  return provider;
}

let anilist: AniListClient | null = null;
function anilistClient(): AniListClient {
  anilist ??= new AniListClient();
  return anilist;
}

/** AniList character details (cached for a week, shared across instances). */
export function getAniListCharacter(id: number): Promise<AniListCharacterDetails | null> {
  return cached(`al:character:${id}`, { ttl: TTL.week, staleTtl: 4 * TTL.week, persist: true, nullTtl: TTL.day }, () => anilistClient().getCharacter(id));
}

/** AniList staff (voice actor) details (cached for a week, shared across instances). */
export function getAniListStaff(id: number): Promise<AniListStaffDetails | null> {
  return cached(`al:staff:${id}`, { ttl: TTL.week, staleTtl: 4 * TTL.week, persist: true, nullTtl: TTL.day }, () => anilistClient().getStaff(id));
}
