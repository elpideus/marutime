'use client';

import { img } from '@marutime/metadata/images';
import { Badge, Spinner, cn, springs } from '@marutime/ui';
import { Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Result = { href: string; title: string; posterPath: string | null; year: string; type: 'show' | 'movie'; isAnime: boolean };

export function SearchBar({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    ctrl.current?.abort();
  }, []);

  const search = (value: string) => {
    setQ(value);
    setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    ctrl.current?.abort();
    const term = value.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      ctrl.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`, { signal: controller.signal });
        if (res.ok) {
          const data = (await res.json()) as { results: Result[] };
          setResults(data.results);
          setActive(-1);
        }
      } catch {
        /* aborted */
      } finally {
        if (ctrl.current === controller) setLoading(false);
      }
    }, 220);
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const submit = () => {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div ref={wrapRef} className={cn('relative w-full', className)}>
      <div className="flex h-11 items-center gap-2 rounded-pill border border-border bg-surface px-4 transition-[border-color,box-shadow] focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10">
        <Search className="size-4 shrink-0 text-fg-subtle" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => search(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === 'Enter') {
              if (active >= 0 && results[active]) {
                setOpen(false);
                router.push(results[active]!.href);
              } else submit();
            } else if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search shows, movies, anime…"
          aria-label="Search"
          aria-expanded={open && results.length > 0}
          aria-controls="search-results"
          role="combobox"
          className="h-full w-full bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
        />
        {loading ? <Spinner className="size-4" /> : q ? (
          <button type="button" onClick={() => { search(''); inputRef.current?.focus(); }} aria-label="Clear search" className="text-fg-subtle hover:text-fg">
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-border bg-surface-2 px-1.5 text-[10px] text-fg-subtle sm:inline">/</kbd>
        )}
      </div>
      <AnimatePresence>
        {open && q.trim().length >= 2 && (results.length > 0 || !loading) ? (
          <motion.div
            id="search-results"
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={springs.bouncy}
            className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-island border border-border bg-surface-2/95 p-1.5 shadow-float backdrop-blur-xl"
          >
            {results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-fg-muted">No matches. Press Enter to search everything.</p>
            ) : (
              results.map((r, i) => (
                <Link
                  key={r.href}
                  href={r.href}
                  role="option"
                  aria-selected={i === active}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActive(i)}
                  className={cn('flex items-center gap-3 rounded-[14px] px-2 py-1.5 transition-colors', i === active ? 'bg-surface-3' : 'hover:bg-surface-3')}
                >
                  <span className="h-12 w-8 shrink-0 overflow-hidden rounded-[6px] bg-surface-3">
                    {r.posterPath ? <img src={img.poster(r.posterPath, 'w92')!} alt="" className="size-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{r.title}</span>
                    <span className="block text-xs text-fg-muted">{r.year}</span>
                  </span>
                  <Badge tone={r.isAnime ? 'accent' : 'neutral'}>{r.isAnime ? 'Anime' : r.type === 'show' ? 'Show' : 'Movie'}</Badge>
                </Link>
              ))
            )}
            <button type="button" onClick={submit} className="mt-1 flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-xs font-medium text-accent hover:bg-surface-3">
              <Search className="size-3.5" /> See all results for “{q.trim()}”
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
