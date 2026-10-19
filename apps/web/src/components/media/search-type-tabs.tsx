'use client';

import { Segmented } from '@marutime/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SearchTypeTabs({ value }: { value: 'all' | 'show' | 'movie' | 'anime' }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <Segmented
      size="sm"
      value={value}
      aria-label="Type"
      items={[
        { value: 'all', label: 'Everything' },
        { value: 'show', label: 'Shows', icon: <span className="size-1.5 rounded-full bg-show" aria-hidden /> },
        { value: 'movie', label: 'Movies', icon: <span className="size-1.5 rounded-full bg-movie" aria-hidden /> },
        { value: 'anime', label: 'Anime', icon: <span className="size-1.5 rounded-full bg-anime" aria-hidden /> },
      ]}
      onChange={(next) => {
        const params = new URLSearchParams(sp.toString());
        params.set('type', next);
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
