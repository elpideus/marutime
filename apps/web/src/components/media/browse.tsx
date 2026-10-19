'use client';

import { Chip, Segmented, Spinner, cn, springs } from '@marutime/ui';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { MediaCard } from '@/components/media/media-card';
import type { MediaCardData } from '@/lib/media-card';

export type BrowseSortValue = 'popular' | 'top_rated' | 'newest' | 'upcoming';

const SORTS: Array<{ value: BrowseSortValue; label: string }> = [
  { value: 'popular', label: 'Popular' },
  { value: 'top_rated', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'upcoming', label: 'Upcoming' },
];

/** Genre chips (multi-select, all must match) and a sort switch, kept in the URL. */
export function BrowseFilters({ genres, selected, sort, active }: { genres: Array<{ id: number; name: string }>; selected: number[]; sort: BrowseSortValue; active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const push = (nextGenres: number[], nextSort: BrowseSortValue | null) => {
    const params = new URLSearchParams(sp.toString());
    if (nextGenres.length) params.set('g', nextGenres.join(','));
    else params.delete('g');
    if (nextSort) params.set('sort', nextSort);
    else params.delete('sort');
    start(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };
  const toggle = (id: number) => push(selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id], active ? sort : 'popular');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          Browse by genre {pending ? <Spinner className="size-3.5" /> : null}
        </h2>
        <div className="flex items-center gap-2">
          <Segmented size="sm" value={active ? sort : ('' as BrowseSortValue)} onChange={(v) => push(selected, v)} items={SORTS} aria-label="Sort" />
          <AnimatePresence>
            {active ? (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={springs.bouncy}
                onClick={() => push([], null)}
                className="inline-flex h-8 items-center gap-1 rounded-pill px-3 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-3.5" /> Clear
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <div className="-mx-1 flex flex-wrap gap-2 px-1">
        {genres.map((g) => (
          <Chip key={g.id} size="sm" selected={selected.includes(g.id)} onClick={() => toggle(g.id)}>
            {g.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Results grid that keeps loading pages as you scroll. */
export function BrowseGrid({ initial, query, totalPages }: { initial: MediaCardData[]; query: string; totalPages: number }) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(totalPages <= 1);
  const sentinel = useRef<HTMLDivElement>(null);

  // New filters: start over.
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    setSeenQuery(query);
    setItems(initial);
    setPage(1);
    setDone(totalPages <= 1);
  }

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || loading) return;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setLoading(true);
        try {
          const res = await fetch(`/api/browse?${query}&page=${page + 1}`);
          const data = (await res.json()) as { items: MediaCardData[]; page: number; totalPages: number };
          setItems((prev) => {
            const keys = new Set(prev.map((i) => i.key));
            return [...prev, ...data.items.filter((i) => !keys.has(i.key))];
          });
          setPage(data.page);
          setDone(data.page >= data.totalPages || data.items.length === 0);
        } catch {
          setDone(true);
        } finally {
          setLoading(false);
        }
      },
      { rootMargin: '1200px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [done, loading, page, query]);

  if (items.length === 0) return <p className="rounded-island border border-dashed border-border px-4 py-10 text-center text-sm text-fg-muted">Nothing matches every genre you picked. Try removing one.</p>;
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
        {items.map((item, i) => (
          <motion.div key={item.key} initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...springs.bouncy, delay: Math.min(i % 20, 12) * 0.02 }}>
            <MediaCard item={item} className="w-full sm:w-full" priority={i < 8} />
          </motion.div>
        ))}
      </div>
      <div ref={sentinel} className={cn('flex justify-center py-8', done && 'hidden')}>
        {loading ? <Spinner /> : null}
      </div>
    </div>
  );
}
