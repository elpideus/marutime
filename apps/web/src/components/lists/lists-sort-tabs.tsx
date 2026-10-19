'use client';

import { Segmented } from '@marutime/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function ListsSortTabs({ value }: { value: 'popular' | 'trending' | 'new' }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <Segmented
      size="sm"
      value={value}
      aria-label="Sort"
      items={[{ value: 'popular', label: 'Most loved' }, { value: 'trending', label: 'Trending' }, { value: 'new', label: 'Newest' }]}
      onChange={(next) => {
        const params = new URLSearchParams(sp.toString());
        params.set('sort', next);
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    />
  );
}
