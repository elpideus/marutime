'use client';

import type { MediaCategory } from '@marutime/config';
import { Segmented } from '@marutime/ui';
import { Clapperboard, Film, Tv } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { setListsCategoryAction } from '@/actions/preferences';

/** Shows / Movies / Anime switch. Remembers the choice in a cookie (and account). */
export function CategoryTabs({ value, param = 'c', remember = true, size = 'md' }: { value: MediaCategory; param?: string; remember?: boolean; size?: 'sm' | 'md' }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, start] = useTransition();
  return (
    <Segmented
      size={size}
      value={value}
      aria-label="Category"
      items={[
        { value: 'shows', label: 'Shows', icon: <Tv className="size-4" /> },
        { value: 'movies', label: 'Movies', icon: <Film className="size-4" /> },
        { value: 'anime', label: 'Anime', icon: <Clapperboard className="size-4" /> },
      ]}
      onChange={(next) => {
        const params = new URLSearchParams(sp.toString());
        params.set(param, next);
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
        if (remember) start(() => setListsCategoryAction(next));
      }}
    />
  );
}
