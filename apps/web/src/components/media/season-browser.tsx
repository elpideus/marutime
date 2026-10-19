'use client';

import type { EpisodeWatchCount } from '@marutime/core';
import { episodeHref } from '@marutime/core/hrefs';
import { Button, ProgressBar, Segmented, Skeleton, Tooltip, cn, fadeUp, springs } from '@marutime/ui';
import { CheckCheck, ChevronRight, Clock, Eye, EyeOff, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Still } from '@/components/media/poster';
import { seasonLabel, useBulkWatch } from '@/components/tracking/bulk-watch';
import { WatchedButton } from '@/components/tracking/watched-button';
import { resolveWatch, useWatchDerived, useWatchState, watchStore } from '@/components/tracking/watch-store';
import { notifyClientStore, useLocalStorageValue } from '@/lib/client-store';
import type { CheckInCharacter } from '@/lib/check-in';
import { episodeCode, formatDate, formatRuntime } from '@/lib/format';

export type EpisodeLite = { id: number; seasonNumber: number; episodeNumber: number; name: string | null; overview: string | null; stillPath: string | null; airDate: string | null; runtime: number | null; voteAverage: number };
export type SeasonTab = { seasonNumber: number; name: string | null; total: number; aired: number };

export type SeasonBrowserProps = {
  media: { id: number; externalId: number; slug: string; title: string };
  seasons: SeasonTab[];
  initialSeason: number;
  initialEpisodes: EpisodeLite[];
  initialTotal: number;
  watched: EpisodeWatchCount[];
  serverAt: number;
  signedIn: boolean;
  characters?: CheckInCharacter[];
};

const PAGE = 40;
const REVEAL_KEY = 'mt:reveal-synopses';

type SeasonData = { items: EpisodeLite[]; total: number; loading: boolean; error: boolean };

/**
 * Episodes by season. Long seasons load in pages as you scroll, so a
 * thousand-episode show costs the same to open as a short one.
 */
export function SeasonBrowser({ media, seasons, initialSeason, initialEpisodes, initialTotal, watched, serverAt, signedIn, characters }: SeasonBrowserProps) {
  const [season, setSeason] = useState(initialSeason);
  const [data, setData] = useState<Record<number, SeasonData>>(() => ({ [initialSeason]: { items: initialEpisodes, total: initialTotal, loading: false, error: false } }));
  const reveal = useLocalStorageValue(REVEAL_KEY, '0') === '1';
  const today = new Date().toISOString().slice(0, 10);
  const current = data[season];
  const tab = seasons.find((s) => s.seasonNumber === season);

  const load = useCallback(
    async (s: number, offset: number) => {
      setData((d) => ({ ...d, [s]: { items: d[s]?.items ?? [], total: d[s]?.total ?? 0, loading: true, error: false } }));
      try {
        const res = await fetch(`/api/titles/${media.id}/episodes?season=${s}&offset=${offset}&limit=${PAGE}`);
        if (!res.ok) throw new Error(String(res.status));
        const page = (await res.json()) as { items: EpisodeLite[]; total: number };
        setData((d) => {
          const have = d[s]?.items ?? [];
          const ids = new Set(have.map((e) => e.id));
          return { ...d, [s]: { items: [...have, ...page.items.filter((e) => !ids.has(e.id))], total: page.total, loading: false, error: false } };
        });
      } catch {
        setData((d) => ({ ...d, [s]: { items: d[s]?.items ?? [], total: d[s]?.total ?? 0, loading: false, error: true } }));
      }
    },
    [media.id],
  );

  const pickSeason = (s: number) => {
    setSeason(s);
    if (!data[s]) void load(s, 0);
  };

  // Fetch the next page shortly before the end of the list scrolls into view.
  const sentinel = useRef<HTMLLIElement>(null);
  const hasMore = Boolean(current && current.items.length < current.total);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || current?.loading || current?.error) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void load(season, current!.items.length);
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, current, season, load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          size="sm"
          value={String(season)}
          onChange={(v) => pickSeason(Number(v))}
          aria-label="Season"
          className="max-w-full"
          items={seasons.map((s) => ({ value: String(s.seasonNumber), label: s.seasonNumber === 0 ? 'Specials' : `S${s.seasonNumber}` }))}
        />
        <Tooltip content={reveal ? 'Blur synopses of episodes you have not seen' : 'Show synopses of episodes you have not seen (may spoil)'}>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={reveal}
            onClick={() => {
              try {
                localStorage.setItem(REVEAL_KEY, reveal ? '0' : '1');
              } catch {
                /* private mode */
              }
              notifyClientStore();
            }}
          >
            {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {reveal ? 'Hide synopses' : 'Show synopses'}
          </Button>
        </Tooltip>
      </div>

      {signedIn && tab && tab.aired > 0 ? <SeasonActions media={media} season={season} name={tab.name} aired={tab.aired} watched={watched} serverAt={serverAt} loaded={current?.items ?? []} today={today} /> : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.ol key={season} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }} transition={springs.smooth} className="flex flex-col gap-2">
          {current && current.items.length === 0 && !current.loading && !current.error ? <li className="py-8 text-center text-sm text-fg-muted">No episodes listed for this season yet.</li> : null}
          {current?.items.map((e) => (
            <EpisodeRow key={e.id} media={media} episode={e} today={today} reveal={reveal} signedIn={signedIn} serverAt={serverAt} serverCount={watched.find((w) => w.episodeId === e.id)?.count ?? 0} characters={characters} />
          ))}
          {!current || current.loading
            ? Array.from({ length: current?.items.length ? 3 : 6 }, (_, i) => (
                <li key={`sk-${i}`} className="flex gap-3 rounded-card border border-border bg-surface p-3">
                  <Skeleton className="hidden aspect-video w-36 shrink-0 rounded-[10px] sm:block" />
                  <div className="flex flex-1 flex-col gap-2 py-1">
                    <Skeleton className="h-4 w-2/5 rounded-md" />
                    <Skeleton className="h-3 w-1/4 rounded-md" />
                  </div>
                </li>
              ))
            : null}
          {current?.error ? (
            <li className="flex items-center justify-center gap-3 py-4 text-sm text-fg-muted">
              Could not load episodes.
              <Button size="sm" variant="secondary" onClick={() => void load(season, current.items.length)}>
                Retry
              </Button>
            </li>
          ) : null}
          {hasMore ? <li ref={sentinel} aria-hidden className="h-px" /> : null}
        </motion.ol>
      </AnimatePresence>
      {current && current.total > PAGE ? (
        <p className="text-center text-xs text-fg-subtle tabular-nums">
          {Math.min(current.items.length, current.total)} of {current.total} episodes
        </p>
      ) : null}
    </div>
  );
}

const EpisodeRow = memo(function EpisodeRow({ media, episode: e, today, reveal, signedIn, serverAt, serverCount, characters }: { media: SeasonBrowserProps['media']; episode: EpisodeLite; today: string; reveal: boolean; signedIn: boolean; serverAt: number; serverCount: number; characters?: CheckInCharacter[] }) {
  const target = { kind: 'episode' as const, episodeId: e.id, mediaId: media.id, seasonNumber: e.seasonNumber, label: `${media.title} · ${episodeCode(e.seasonNumber, e.episodeNumber)}` };
  const state = useWatchState(`e:${e.id}`, { count: serverCount }, serverAt);
  const watched = state.count > 0;
  const unaired = !e.airDate || e.airDate > today;
  const href = episodeHref(media, e.seasonNumber, e.episodeNumber);
  return (
    <motion.li variants={fadeUp} initial="hidden" animate="show" className={cn('group flex gap-3 rounded-card border border-border bg-surface p-2.5 transition-colors duration-300 hover:border-border-strong sm:gap-4 sm:p-3', watched && 'bg-surface-2/60')}>
      <Link href={href} className="relative hidden w-36 shrink-0 overflow-hidden rounded-[10px] sm:block">
        <Still path={e.stillPath} alt="" className={cn('transition-[opacity,transform] duration-500 group-hover:scale-[1.04]', watched && 'opacity-70')} />
        <AnimatePresence>
          {watched ? (
            <motion.span key="tick" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }} transition={springs.pop} className="absolute top-1.5 right-1.5 rounded-full bg-accent p-0.5 text-on-accent shadow-md">
              <CheckCheck className="size-3" />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={href} data-nav-item className="group/title flex items-baseline gap-2 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
          <span className="shrink-0 text-xs font-semibold text-accent tabular-nums">{episodeCode(e.seasonNumber, e.episodeNumber)}</span>
          <span className="truncate text-sm font-medium text-fg transition-colors group-hover/title:text-accent">{e.name ?? 'TBA'}</span>
          <ChevronRight className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
          <span>{unaired ? `Airs ${formatDate(e.airDate)}` : formatDate(e.airDate)}</span>
          {e.runtime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {formatRuntime(e.runtime)}
            </span>
          ) : null}
          {state.count > 1 ? <span className="rounded-pill bg-accent-soft px-1.5 font-semibold text-accent">Watched {state.count}×</span> : null}
        </p>
        {e.overview ? <p className={cn('mt-1 hidden text-xs leading-relaxed text-fg-muted transition-[filter] duration-300 sm:line-clamp-2', !watched && signedIn && !reveal && 'blur-[3px] group-hover:blur-0')}>{e.overview}</p> : null}
      </div>
      <div className="flex shrink-0 items-start">
        {unaired ? (
          <span className="rounded-pill border border-border px-2 py-1 text-[11px] text-fg-subtle">Upcoming</span>
        ) : (
          <WatchedButton target={target} watched={serverCount > 0} watchCount={serverCount} serverAt={serverAt} characters={characters} size="sm" variant="compact" />
        )}
      </div>
    </motion.li>
  );
});

/** Season progress plus "mark season" / "unmark season", both undoable. */
function SeasonActions({ media, season, name, aired, watched, serverAt, loaded, today }: { media: SeasonBrowserProps['media']; season: number; name: string | null; aired: number; watched: EpisodeWatchCount[]; serverAt: number; loaded: EpisodeLite[]; today: string }) {
  const bulk = useBulkWatch(media);
  const [busy, setBusy] = useState(false);
  const label = seasonLabel(season, name);

  /** Every episode of this season the viewer has watched, server and local. */
  const watchedEpisodes = useCallback((): Array<{ id: number; seasonNumber: number }> => {
    const ids = new Set<number>();
    for (const w of watched) if (w.seasonNumber === season && resolveWatch(`e:${w.episodeId}`, { count: w.count }, serverAt).count > 0) ids.add(w.episodeId);
    for (const [key, o] of watchStore.entries()) if (o.mediaId === media.id && o.season === season && o.count > 0 && (o.pending || o.at >= serverAt)) ids.add(Number(key.slice(2)));
    return Array.from(ids, (id) => ({ id, seasonNumber: season }));
  }, [watched, season, serverAt, media.id]);

  const count = useWatchDerived(useCallback(() => watchedEpisodes().length, [watchedEpisodes]));

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const markSeason = () => {
    const seen = new Set(watchedEpisodes().map((e) => e.id));
    const onScreen = loaded.filter((e) => e.airDate && e.airDate <= today && !seen.has(e.id));
    return run(() => bulk.mark({ seasonNumber: season }, label, onScreen));
  };
  const unmarkSeason = () => run(() => bulk.unmarkSeason(season, label, watchedEpisodes()));

  const complete = count >= aired;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-2/40 px-3 py-2">
      <div className="min-w-24 flex-1 sm:max-w-48">
        <ProgressBar value={aired ? (Math.min(count, aired) / aired) * 100 : 0} size="sm" label={`${label} progress`} />
      </div>
      <span className="text-xs text-fg-muted tabular-nums">
        {Math.min(count, aired)}/{aired} watched
      </span>
      <div className="ml-auto flex items-center gap-1">
        <AnimatePresence initial={false} mode="popLayout">
          {!complete ? (
            <motion.div key="mark" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springs.bouncy}>
              <Button variant="ghost" size="sm" onClick={markSeason} disabled={busy} tooltip={`Mark every aired episode of ${label} as watched`}>
                <CheckCheck className="size-4" /> Mark season
              </Button>
            </motion.div>
          ) : null}
          {count > 0 ? (
            <motion.div key="unmark" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springs.bouncy}>
              <Button variant="ghost" size="sm" onClick={unmarkSeason} disabled={busy} tooltip={`Mark every episode of ${label} as unwatched`}>
                <Undo2 className="size-4" /> Unmark season
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
