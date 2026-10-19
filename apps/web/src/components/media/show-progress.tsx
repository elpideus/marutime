'use client';

import type { EpisodeWatchCount } from '@marutime/core';
import { episodeHref } from '@marutime/core/hrefs';
import { Island, ProgressRing, springs } from '@marutime/ui';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback } from 'react';
import { WatchedButton } from '@/components/tracking/watched-button';
import { resolveWatch, useWatchDerived, watchStore } from '@/components/tracking/watch-store';
import { useCommands } from '@/components/keyboard/command-palette';
import { useShortcut } from '@/components/keyboard/shortcut-provider';
import { useCheckIn } from '@/components/tracking/check-in-provider';
import type { CheckInCharacter } from '@/lib/check-in';
import { episodeCode, formatDate } from '@/lib/format';

type Ep = { id: number; seasonNumber: number; episodeNumber: number; name: string | null; airDate: string | null };

/**
 * "x of y episodes" plus the next episode to watch. Counts follow the watch
 * store, so they move the instant an episode or season is marked anywhere on
 * the page; the next episode itself updates when the server answers.
 */
export function ShowProgressCard({ media, aired, tracked, watched, serverAt, next, upcoming, characters }: { media: { id: number; externalId: number; slug: string; title: string }; aired: number; tracked: boolean; watched: EpisodeWatchCount[]; serverAt: number; next: Ep | null; upcoming: Ep | null; characters?: CheckInCharacter[] }) {
  const count = useWatchDerived(
    useCallback(() => {
      const keys = new Set<string>();
      for (const w of watched) if (w.seasonNumber > 0 && resolveWatch(`e:${w.episodeId}`, { count: w.count }, serverAt).count > 0) keys.add(`e:${w.episodeId}`);
      for (const [key, o] of watchStore.entries()) if (o.mediaId === media.id && (o.season ?? 0) > 0 && o.count > 0 && (o.pending || o.at >= serverAt)) keys.add(key);
      return keys.size;
    }, [watched, serverAt, media.id]),
  );
  const checkIn = useCheckIn();
  const nextTarget = next ? { kind: 'episode' as const, episodeId: next.id, mediaId: media.id, seasonNumber: next.seasonNumber, label: `${media.title} · ${episodeCode(next.seasonNumber, next.episodeNumber)}` } : null;
  const markNext = nextTarget
    ? () => {
        // Already marked and waiting for the next one to load: ignore repeats.
        if (resolveWatch(`e:${nextTarget.episodeId}`, { count: 0 }, serverAt).count > 0) return;
        checkIn.markWatched(nextTarget, { characters });
      }
    : null;
  useShortcut('title.watched', markNext);
  useCommands(nextTarget && markNext ? [{ id: 'next-up', group: 'This page', title: `Mark ${nextTarget.label} as watched`, subtitle: next?.name ?? undefined, shortcutId: 'title.watched', perform: markNext }] : null);
  const done = Math.min(count, aired);
  const remaining = Math.max(0, aired - done);
  const percent = aired ? (done / aired) * 100 : 0;

  return (
    <Island className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <ProgressRing value={percent} size={64} stroke={6} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg-muted tabular-nums">
          {done} of {aired} aired episodes
          {remaining > 0 ? ` · ${remaining} to go` : tracked || done > 0 ? ' · you are up to date' : ''}
        </p>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={next?.id ?? upcoming?.id ?? 'done'} initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.14 } }} transition={springs.smooth}>
            {next ? (
              <Link href={episodeHref(media, next.seasonNumber, next.episodeNumber)} className="mt-0.5 block truncate text-lg font-semibold text-fg transition-colors hover:text-accent">
                Next up: <span className="text-accent">{episodeCode(next.seasonNumber, next.episodeNumber)}</span> {next.name ?? ''}
              </Link>
            ) : upcoming ? (
              <p className="mt-0.5 text-lg font-semibold text-fg">
                {episodeCode(upcoming.seasonNumber, upcoming.episodeNumber)} airs {formatDate(upcoming.airDate)}
              </p>
            ) : (
              <p className="mt-0.5 text-lg font-semibold text-fg">All caught up</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {next ? (
        <WatchedButton
          key={next.id}
          target={nextTarget!}
          watched={false}
          serverAt={serverAt}
          characters={characters}
          variant="compact"
        />
      ) : null}
    </Island>
  );
}
