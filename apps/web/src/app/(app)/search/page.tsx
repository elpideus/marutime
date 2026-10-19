import { searchMedia } from '@marutime/core';
import { Button } from '@marutime/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MediaGrid } from '@/components/media/media-row';
import { PageHeader } from '@/components/page-header';
import { SearchBar } from '@/components/shell/search-bar';
import { SearchTypeTabs } from '@/components/media/search-type-tabs';
import { cardFromSummary } from '@/lib/media-card';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const type = sp.type === 'show' || sp.type === 'movie' || sp.type === 'anime' ? sp.type : 'all';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  // TMDB cannot filter anime; search everything and keep the anime.
  const result = q ? await searchMedia(q, { type: type === 'anime' ? 'all' : type, page }).catch(() => null) : null;
  const items = (type === 'anime' ? result?.results.filter((r) => r.isAnime) : result?.results)?.map(cardFromSummary) ?? [];
  const qs = (p: number) => `/search?q=${encodeURIComponent(q)}&type=${type}&page=${p}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={q ? `Results for “${q}”` : 'Search'} description={result ? `${result.totalResults.toLocaleString()} titles` : 'Find any show, movie or anime.'} />
      <div className="sm:hidden">
        <SearchBar autoFocus={!q} />
      </div>
      {q ? (
        <>
          <SearchTypeTabs value={type} />
          {result === null ? <p className="text-sm text-danger">Search is unavailable right now.</p> : items.length === 0 ? <p className="text-sm text-fg-muted">No matches. Try a different spelling or the original title.</p> : <MediaGrid items={items} />}
          {result && result.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3 pt-2">
              {page > 1 ? (
                <Link href={qs(page - 1)}>
                  <Button variant="secondary" size="sm" tabIndex={-1}>Previous</Button>
                </Link>
              ) : null}
              <span className="text-sm text-fg-muted">
                Page {page} of {result.totalPages}
              </span>
              {page < result.totalPages ? (
                <Link href={qs(page + 1)}>
                  <Button variant="secondary" size="sm" tabIndex={-1}>Next</Button>
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
