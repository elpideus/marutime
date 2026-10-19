import type { MediaCategory } from '@marutime/config';
import { getMetadataProvider, type DiscoverSort, type MediaSummary, type MetadataProvider, type PagedResult } from '@marutime/metadata';
import { mediaHref } from './category';

export type DiscoverSection = { key: string; title: string; items: MediaSummary[] };

export type SummaryWithHref = MediaSummary & { href: string };

export function withHref(items: MediaSummary[]): SummaryWithHref[] {
  return items.map((m) => ({ ...m, href: mediaHref({ type: m.type, externalId: m.externalId, title: m.title }) }));
}

export async function searchMedia(query: string, opts: { type?: 'show' | 'movie' | 'all'; page?: number; provider?: MetadataProvider } = {}): Promise<PagedResult<SummaryWithHref>> {
  const provider = opts.provider ?? getMetadataProvider();
  const res = await provider.search(query, { type: opts.type ?? 'all', page: opts.page ?? 1 });
  return { ...res, results: withHref(res.results) };
}

export async function discover(category: MediaCategory, sort: DiscoverSort, page = 1, provider = getMetadataProvider()): Promise<PagedResult<SummaryWithHref>> {
  const res = await provider.discover(category, sort, page);
  return { ...res, results: withHref(res.results) };
}

/** Sections for the Discover page of a category. */
export async function discoverSections(category: MediaCategory, provider = getMetadataProvider()): Promise<DiscoverSection[]> {
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
  return specs.map((s, i) => {
    const r = results[i];
    const items = r && r.status === 'fulfilled' ? r.value.results : [];
    return { key: s.key, title: s.title, items: withHref(category === 'anime' ? items.filter((m) => m.isAnime || m.genreIds.includes(16)) : items) };
  });
}

export async function trendingAll(provider = getMetadataProvider()): Promise<SummaryWithHref[]> {
  const res = await provider.trending('all', 'week', 1);
  return withHref(res.results);
}
