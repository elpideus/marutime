'use client';

import { Select } from '@marutime/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type LibrarySort = 'added' | 'title' | 'release' | 'rating';

/** Genre filter and sort for personal collections, kept in the URL. */
export function LibraryControls({ genres, genre, sort }: { genres: Array<{ id: number; name: string; count: number }>; genre: number | null; sort: LibrarySort }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (key: string, value: string | null) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={genre ?? ''} onChange={(e) => set('g', e.target.value || null)} className="h-9 w-48" aria-label="Filter by genre">
        <option value="">All genres</option>
        {genres.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} ({g.count})
          </option>
        ))}
      </Select>
      <Select value={sort} onChange={(e) => set('sort', e.target.value === 'added' ? null : e.target.value)} className="h-9 w-44" aria-label="Sort">
        <option value="added">Recently added</option>
        <option value="title">Title A–Z</option>
        <option value="release">Release date</option>
        <option value="rating">Rating</option>
      </Select>
    </div>
  );
}
