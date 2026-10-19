'use client';

import type { Character, Device, Service } from '@marutime/db';
import type { WatchNextItem } from '@marutime/core';
import { Button, Island, fadeUp, stagger, useToast } from '@marutime/ui';
import { FastForward, Play } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { bulkMarkAction } from '@/actions/tracking';
import { Still } from '@/components/media/poster';
import { WatchedButton } from '@/components/tracking/watched-button';
import { episodeCode, formatDate } from '@/lib/format';
import { episodeHref, mediaHref } from '@marutime/core/hrefs';

export type WatchNextCardData = WatchNextItem & { characters: Character[] };

export function WatchNextGrid({ items, devices, services, defaults }: { items: WatchNextCardData[]; devices: Device[]; services: Service[]; defaults?: { deviceId?: number | null; serviceId?: number | null } }) {
  return (
    <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <motion.div key={item.media.id} variants={fadeUp} layout>
          <WatchNextCard item={item} devices={devices} services={services} defaults={defaults} />
        </motion.div>
      ))}
    </motion.div>
  );
}

function WatchNextCard({ item, devices, services, defaults }: { item: WatchNextCardData; devices: Device[]; services: Service[]; defaults?: { deviceId?: number | null; serviceId?: number | null } }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const href = episodeHref(item.media, item.episode.seasonNumber, item.episode.episodeNumber);
  const catchUp = () => {
    start(async () => {
      const r = await bulkMarkAction(item.media.id, { upToEpisodeId: item.episode.id });
      if (!r.ok) toast({ tone: 'error', title: r.error });
      else {
        toast({ tone: 'success', title: `Marked ${r.data.marked} episodes watched` });
        router.refresh();
      }
    });
  };
  return (
    <Island padding="none" className="overflow-hidden">
      <Link href={href} className="relative block">
        <Still path={item.episode.stillPath ?? item.media.backdropPath} alt="" className="aspect-video w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute right-3 bottom-3 rounded-pill bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          {item.remaining} left
        </div>
        <span className="absolute top-3 left-3 flex size-9 items-center justify-center rounded-full bg-accent/90 text-on-accent shadow-lg">
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
            target={{ kind: 'episode', episodeId: item.episode.id, label: `${item.media.title} · ${episodeCode(item.episode.seasonNumber, item.episode.episodeNumber)}` }}
            watched={false}
            devices={devices}
            services={services}
            characters={item.characters}
            defaults={defaults}
            signedIn
            size="sm"
            variant="compact"
          />
          {item.remaining > 1 ? (
            <Button variant="ghost" size="sm" onClick={catchUp} loading={pending} title="Mark this and everything before it as watched">
              <FastForward className="size-4" /> Catch up
            </Button>
          ) : null}
        </div>
      </div>
    </Island>
  );
}
