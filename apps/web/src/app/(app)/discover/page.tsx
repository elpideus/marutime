import { LISTS_CATEGORY_COOKIE, type MediaCategory } from '@marutime/config';
import { BROWSE_SORTS, browseMedia, discoverSections, genresFor, type BrowseSort } from '@marutime/core';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BrowseFilters, BrowseGrid } from '@/components/media/browse';
import { CategoryTabs } from '@/components/media/category-tabs';
import { MediaRow } from '@/components/media/media-row';
import { PageHeader } from '@/components/page-header';
import { cardFromSummary } from '@/lib/media-card';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Discover' };

function pickCategory(value: string | undefined, fallback: string | undefined): MediaCategory {
  const v = value ?? fallback;
  return v === 'movies' || v === 'anime' ? v : 'shows';
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ c?: string; g?: string; sort?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const cookieCategory = (await cookies()).get(LISTS_CATEGORY_COOKIE)?.value ?? user?.preferences.listsCategory;
  const category = pickCategory(sp.c, cookieCategory);
  const genreIds = (sp.g ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 6);
  const sort: BrowseSort = (BROWSE_SORTS as readonly string[]).includes(sp.sort ?? '') ? (sp.sort as BrowseSort) : 'popular';
  // Picking a genre or a sort switches from curated shelves to a browsable grid.
  const browsing = genreIds.length > 0 || Boolean(sp.sort);
  const [genres, sections, browse] = await Promise.all([
    genresFor(category),
    browsing ? Promise.resolve([]) : discoverSections(category).catch(() => []),
    browsing ? browseMedia(category, { genreIds, sort }).catch(() => null) : Promise.resolve(null),
  ]);
  const query = new URLSearchParams({ c: category, sort, ...(genreIds.length ? { g: genreIds.join(',') } : {}) }).toString();
  const names = genres.filter((g) => genreIds.includes(g.id)).map((g) => g.name);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Discover" description="Trending, airing and all-time favourites. Pick a lane; MaruTime remembers it." action={<CategoryTabs value={category} />} />
      {genres.length > 0 ? <BrowseFilters genres={genres} selected={genreIds} sort={sort} active={browsing} /> : null}
      {browsing ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-fg">{names.length ? names.join(' + ') : 'Everything'}</h2>
          {browse ? <BrowseGrid key={query} initial={browse.results.map(cardFromSummary)} query={query} totalPages={browse.totalPages} /> : <p className="text-sm text-fg-muted">The metadata service is unavailable right now. Try again in a minute.</p>}
        </section>
      ) : (
        <>
          {sections.length === 0 ? <p className="text-sm text-fg-muted">The metadata service is unavailable right now. Try again in a minute.</p> : null}
          {sections.map((s) => (
            <MediaRow key={s.key} title={s.title} items={s.items.map(cardFromSummary)} />
          ))}
        </>
      )}
    </div>
  );
}
