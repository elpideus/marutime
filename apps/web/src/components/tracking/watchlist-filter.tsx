'use client';

import { Segmented } from '@marutime/ui';
import { usePathname, useRouter } from 'next/navigation';

export function WatchlistFilter({ value, counts }: { value: 'all' | 'shows' | 'movies' | 'anime'; counts: Record<'all' | 'shows' | 'movies' | 'anime', number> }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Segmented
      size="sm"
      value={value}
      aria-label="Filter"
      items={[
        { value: 'all', label: 'All', count: counts.all },
        { value: 'shows', label: 'Shows', count: counts.shows },
        { value: 'movies', label: 'Movies', count: counts.movies },
        { value: 'anime', label: 'Anime', count: counts.anime },
      ]}
      onChange={(next) => router.push(next === 'all' ? pathname : `${pathname}?c=${next}`, { scroll: false })}
    />
  );
}
