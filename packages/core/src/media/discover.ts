import type { MediaCategory } from '@marutime/config';
import type { DiscoverSort, Genre, MediaSummary, MetadataProvider, PagedResult } from '@marutime/metadata';
import { mediaHref } from './category';
import { getProvider } from './provider';

export type DiscoverSection = { key: string; title: string; items: SummaryWithHref[] };

export type SummaryWithHref = MediaSummary & { href: string };

export function withHref(items: MediaSummary[]): SummaryWithHref[] {
  return items.map((m) => ({ ...m, href: mediaHref({ type: m.type, externalId: m.externalId, title: m.title }) }));
}

export async function searchMedia(query: string, opts: { type?: 'show' | 'movie' | 'all'; page?: number; provider?: MetadataProvider } = {}): Promise<PagedResult<SummaryWithHref>> {
  const provider = opts.provider ?? getProvider();
  const res = await provider.search(query, { type: opts.type ?? 'all', page: opts.page ?? 1 });
  return { ...res, results: withHref(res.results) };
}

export async function discover(category: MediaCategory, sort: DiscoverSort, page = 1, provider = getProvider()): Promise<PagedResult<SummaryWithHref>> {
  const res = await provider.discover(category, sort, page);
  return { ...res, results: withHref(res.results) };
}

/** Sections for the Discover page of a category. Empty sections are dropped. */
export async function discoverSections(category: MediaCategory, provider = getProvider()): Promise<DiscoverSection[]> {
  const specs: Array<{ key: DiscoverSort; title: string }> =
    category === 'movies'
      ? [
          { key: 'trending', title: 'Trending this week' },
          { key: 'airing', title: 'Now in cinemas' },
          { key: 'upcoming', title: 'Coming soon' },
          { key: 'top_rated', title: 'All-time favourites' },
        ]
      : category === 'anime'
        ? [
            { key: 'popular', title: 'Popular anime' },
            { key: 'airing', title: 'Airing today' },
            { key: 'top_rated', title: 'Highest rated' },
            { key: 'upcoming', title: 'Upcoming' },
          ]
        : [
            { key: 'trending', title: 'Trending this week' },
            { key: 'airing', title: 'On the air' },
            { key: 'popular', title: 'Popular right now' },
            { key: 'top_rated', title: 'All-time favourites' },
          ];
  const results = await Promise.allSettled(specs.map((s) => provider.discover(category, s.key, 1)));
  return specs
    .map((s, i) => {
      const r = results[i];
      const items = r && r.status === 'fulfilled' ? r.value.results : [];
      return { key: s.key, title: s.title, items: withHref(category === 'anime' ? items.filter((m) => m.isAnime || m.genreIds.includes(16)) : items) };
    })
    .filter((s) => s.items.length > 0);
}

export const BROWSE_SORTS = ['popular', 'top_rated', 'newest', 'upcoming'] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

/** Genre-filtered, sorted browsing for a category (Discover → Browse). */
export async function browseMedia(category: MediaCategory, opts: { genreIds?: number[]; sort?: BrowseSort; page?: number } = {}, provider = getProvider()): Promise<PagedResult<SummaryWithHref>> {
  const res = await provider.discover(category, opts.sort ?? 'popular', opts.page ?? 1, { genreIds: opts.genreIds ?? [] });
  const results = category === 'anime' ? res.results.filter((m) => m.isAnime || m.genreIds.includes(16)) : res.results;
  return { ...res, results: withHref(results) };
}

/** Genres that make sense to filter a category by. */
export async function genresFor(category: MediaCategory, provider = getProvider()): Promise<Genre[]> {
  const list = await provider.getGenres(category === 'movies' ? 'movie' : 'show').catch(() => []);
  // Every anime is animated; the filter would be a no-op.
  return category === 'anime' ? list.filter((g) => g.id !== 16) : list;
}

export async function trendingAll(provider = getProvider()): Promise<SummaryWithHref[]> {
  const res = await provider.trending('all', 'week', 1);
  return withHref(res.results);
}
