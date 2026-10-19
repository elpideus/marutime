'use client';

import { Segmented } from '@marutime/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function SearchTypeTabs({ value }: { value: 'all' | 'show' | 'movie' }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <Segmented
      size="sm"
      value={value}
      aria-label="Type"
      items={[{ value: 'all', label: 'Everything' }, { value: 'show', label: 'Shows' }, { value: 'movie', label: 'Movies' }]}
      onChange={(next) => {
        const params = new URLSearchParams(sp.toString());
        params.set('type', next);
        params.delete('page');
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
