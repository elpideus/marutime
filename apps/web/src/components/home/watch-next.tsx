'use client';

import type { WatchNextItem } from '@marutime/core';
import { Button, Island, fadeUp, stagger } from '@marutime/ui';
import { FastForward, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { Still } from '@/components/media/poster';
import { useBulkWatch } from '@/components/tracking/bulk-watch';
import { WatchedButton } from '@/components/tracking/watched-button';
import type { CheckInCharacter } from '@/lib/check-in';
import { episodeCode, formatDate } from '@/lib/format';
import { episodeHref, mediaHref } from '@marutime/core/hrefs';

export type WatchNextCardData = WatchNextItem & { characters?: CheckInCharacter[] };

export function WatchNextGrid({ items, serverAt }: { items: WatchNextCardData[]; serverAt: number }) {
  return (
    <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <motion.div key={`${item.media.id}:${item.episode.id}`} variants={fadeUp} initial="hidden" animate="show" exit="exit" layout>
            <WatchNextCard item={item} serverAt={serverAt} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

function WatchNextCard({ item, serverAt }: { item: WatchNextCardData; serverAt: number }) {
  const bulk = useBulkWatch({ id: item.media.id, title: item.media.title });
  const [busy, setBusy] = useState(false);
  const href = episodeHref(item.media, item.episode.seasonNumber, item.episode.episodeNumber);
  const catchUp = async () => {
    setBusy(true);
    await bulk.mark({ upToEpisodeId: item.episode.id }, `${item.media.title} up to ${episodeCode(item.episode.seasonNumber, item.episode.episodeNumber)}`, [{ id: item.episode.id, seasonNumber: item.episode.seasonNumber }]);
    setBusy(false);
  };
  return (
    <Island padding="none" className="overflow-hidden">
      <Link href={href} data-nav-item className="group/card relative block overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70">
        <Still path={item.episode.stillPath ?? item.media.backdropPath} alt="" className="aspect-video w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute right-3 bottom-3 rounded-pill bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          {item.remaining} left
        </div>
        <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-accent/90 text-on-accent shadow-lg transition-transform duration-500 ease-bounce group-hover/card:scale-110">
          <Play className="size-4 fill-current" />
        </span>
      </Link>
      <div className="flex flex-col gap-3 p-4">
        <div className="min-w-0">
          <Link href={mediaHref(item.media)} className="block truncate text-xs font-medium text-fg-muted hover:text-fg">
            {item.media.title}
          </Link>
          <Link href={href} className="mt-0.5 block truncate text-base font-semibold text-fg hover:text-accent">
            <span className="text-accent">{episodeCode(item.episode.seasonNumber, item.episode.episodeNumber)}</span> {item.episode.name ?? 'Untitled'}
          </Link>
          <p className="text-xs text-fg-subtle">{formatDate(item.episode.airDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <WatchedButton
            target={{ kind: 'episode', episodeId: item.episode.id, mediaId: item.media.id, seasonNumber: item.episode.seasonNumber, label: `${item.media.title} · ${episodeCode(item.episode.seasonNumber, item.episode.episodeNumber)}` }}
            watched={false}
            serverAt={serverAt}
            characters={item.characters}
            size="sm"
            variant="compact"
          />
          {item.remaining > 1 ? (
            <Button variant="ghost" size="sm" onClick={catchUp} disabled={busy} tooltip="Mark this episode and every earlier one as watched">
              <FastForward className="size-4" /> Catch up
            </Button>
          ) : null}
        </div>
      </div>
    </Island>
  );
}
