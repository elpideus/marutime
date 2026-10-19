'use client';

import { Tabs } from '@marutime/ui';
import { usePathname, useRouter } from 'next/navigation';

type Bucket = 'watching' | 'up_to_date' | 'upcoming' | 'completed' | 'on_hold' | 'dropped';

export function LibraryTabs({ value, counts }: { value: Bucket; counts: Record<Bucket, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      value={value}
      aria-label="Library"
      items={[
        { value: 'watching', label: 'Watch next', count: counts.watching },
        { value: 'upcoming', label: 'Waiting for episodes', count: counts.upcoming },
        { value: 'up_to_date', label: 'Up to date', count: counts.up_to_date },
        { value: 'completed', label: 'Completed', count: counts.completed },
        { value: 'on_hold', label: 'On hold', count: counts.on_hold },
        { value: 'dropped', label: 'Dropped', count: counts.dropped },
      ]}
      onChange={(next) => router.push(`${pathname}?tab=${next}`, { scroll: false })}
    />
  );
}
