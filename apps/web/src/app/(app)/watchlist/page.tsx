import type { MediaCategory } from '@marutime/config';
import { getWatchlist } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, EmptyState } from '@marutime/ui';
import { Bookmark } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { LibraryControls, type LibrarySort } from '@/components/tracking/library-controls';
import { WatchlistFilter } from '@/components/tracking/watchlist-filter';
import { WatchlistGrid } from '@/components/tracking/watchlist-grid';
import { cardFromMedia } from '@/lib/media-card';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Watchlist' };

export default async function WatchlistPage({ searchParams }: { searchParams: Promise<{ c?: string; g?: string; sort?: string }> }) {
  const user = await requireUser('/watchlist');
  const sp = await searchParams;
  const category: MediaCategory | 'all' = sp.c === 'shows' || sp.c === 'movies' || sp.c === 'anime' ? sp.c : 'all';
  const sort: LibrarySort = sp.sort === 'title' || sp.sort === 'release' || sp.sort === 'rating' ? sp.sort : 'added';
  const all = await getWatchlist(getDb(), user.id);
  const inCategory = category === 'all' ? all : all.filter((i) => i.category === category);
  // Genres present in this view, most common first.
  const genreCounts = new Map<number, { id: number; name: string; count: number }>();
  for (const i of inCategory) for (const g of i.media.genres) genreCounts.set(g.id, { id: g.id, name: g.name, count: (genreCounts.get(g.id)?.count ?? 0) + 1 });
  const genres = Array.from(genreCounts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const genre = genreCounts.has(Number(sp.g)) ? Number(sp.g) : null;
  const items = (genre ? inCategory.filter((i) => i.media.genres.some((g) => g.id === genre)) : inCategory).slice().sort((a, b) =>
    sort === 'title' ? a.media.title.localeCompare(b.media.title) : sort === 'release' ? (b.media.releaseDate ?? '').localeCompare(a.media.releaseDate ?? '') : sort === 'rating' ? b.media.voteAverage - a.media.voteAverage : 0,
  );
  const counts = { all: all.length, shows: all.filter((i) => i.category === 'shows').length, movies: all.filter((i) => i.category === 'movies').length, anime: all.filter((i) => i.category === 'anime').length };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Watchlist" description="Things you want to watch. Marking something watched removes it automatically." action={<WatchlistFilter value={category} counts={counts} />} />
      {inCategory.length > 1 ? <LibraryControls genres={genres} genre={genre} sort={sort} /> : null}
      {items.length === 0 ? (
        <EmptyState icon={<Bookmark />} title="Your watchlist is empty" description="Tap the bookmark on any show or movie to save it for later." action={<Link href="/discover"><Button tabIndex={-1}>Discover something</Button></Link>} />
      ) : (
        <WatchlistGrid items={items.map((i) => ({ card: cardFromMedia(i.media), mediaId: i.media.id }))} />
      )}
    </div>
  );
}
