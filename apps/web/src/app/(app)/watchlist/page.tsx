import type { MediaCategory } from '@marutime/config';
import { getWatchlist } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, EmptyState } from '@marutime/ui';
import { Bookmark } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { WatchlistFilter } from '@/components/tracking/watchlist-filter';
import { WatchlistGrid } from '@/components/tracking/watchlist-grid';
import { cardFromMedia } from '@/lib/media-card';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Watchlist' };

export default async function WatchlistPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireUser('/watchlist');
  const sp = await searchParams;
  const category: MediaCategory | 'all' = sp.c === 'shows' || sp.c === 'movies' || sp.c === 'anime' ? sp.c : 'all';
  const all = await getWatchlist(getDb(), user.id);
  const items = category === 'all' ? all : all.filter((i) => i.category === category);
  const counts = { all: all.length, shows: all.filter((i) => i.category === 'shows').length, movies: all.filter((i) => i.category === 'movies').length, anime: all.filter((i) => i.category === 'anime').length };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Watchlist" description="Things you want to watch. Marking something watched removes it automatically." action={<WatchlistFilter value={category} counts={counts} />} />
      {items.length === 0 ? (
        <EmptyState icon={<Bookmark />} title="Your watchlist is empty" description="Tap the bookmark on any show or movie to save it for later." action={<Link href="/discover"><Button tabIndex={-1}>Discover something</Button></Link>} />
      ) : (
        <WatchlistGrid items={items.map((i) => ({ card: cardFromMedia(i.media), mediaId: i.media.id }))} />
      )}
    </div>
  );
}
