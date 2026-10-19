'use client';

import type { Character, Device, Episode, Season, Service, Watch } from '@marutime/db';
import { episodeHref } from '@marutime/core/hrefs';
import { Button, ProgressBar, Segmented, cn, fadeUp, stagger, useToast } from '@marutime/ui';
import { CheckCheck, ChevronRight, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { bulkMarkAction } from '@/actions/tracking';
import { Still } from '@/components/media/poster';
import { WatchedButton } from '@/components/tracking/watched-button';
import { episodeCode, formatDate, formatRuntime } from '@/lib/format';

export type SeasonBrowserProps = {
  media: { id: number; externalId: number; slug: string; title: string };
  seasons: Season[];
  episodes: Episode[];
  watchMap: Record<number, Pick<Watch, 'id' | 'deviceId' | 'serviceId' | 'emotions' | 'favoriteCharacterId' | 'note'>[]>;
  initialSeason: number;
  devices: Device[];
  services: Service[];
  characters: Character[];
  signedIn: boolean;
  defaults?: { deviceId?: number | null; serviceId?: number | null };
};

export function SeasonBrowser({ media, seasons, episodes, watchMap, initialSeason, devices, services, characters, signedIn, defaults }: SeasonBrowserProps) {
  const [season, setSeason] = useState(initialSeason);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const list = useMemo(() => episodes.filter((e) => e.seasonNumber === season), [episodes, season]);
  const aired = list.filter((e) => e.airDate && e.airDate <= today);
  const watchedCount = aired.filter((e) => (watchMap[e.id]?.length ?? 0) > 0).length;

  const markSeason = () => {
    start(async () => {
      const r = await bulkMarkAction(media.id, { seasonNumber: season });
      if (!r.ok) toast({ tone: 'error', title: r.error });
      else {
        toast({ tone: 'success', title: r.data.marked ? `Season ${season} marked watched` : 'Season already complete' });
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          size="sm"
          value={String(season)}
          onChange={(v) => setSeason(Number(v))}
          aria-label="Season"
          items={seasons.map((s) => ({ value: String(s.seasonNumber), label: s.seasonNumber === 0 ? 'Specials' : `S${s.seasonNumber}` }))}
        />
        {signedIn && aired.length > 0 ? (
          <div className="flex items-center gap-3">
            <div className="hidden w-32 sm:block">
              <ProgressBar value={aired.length ? (watchedCount / aired.length) * 100 : 0} size="sm" label="Season progress" />
            </div>
            <span className="text-xs text-fg-muted tabular-nums">
              {watchedCount}/{aired.length}
            </span>
            {watchedCount < aired.length ? (
              <Button variant="ghost" size="sm" onClick={markSeason} loading={pending}>
                <CheckCheck className="size-4" /> Mark season
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.ol key={season} variants={stagger(0.02)} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.1 } }} className="flex flex-col gap-2">
          {list.length === 0 ? <li className="py-8 text-center text-sm text-fg-muted">No episodes listed for this season yet.</li> : null}
          {list.map((e) => {
            const watches = watchMap[e.id] ?? [];
            const watched = watches.length > 0;
            const unaired = !e.airDate || e.airDate > today;
            return (
              <motion.li key={e.id} variants={fadeUp} className={cn('group flex gap-3 rounded-card border border-border bg-surface p-2.5 transition-colors hover:border-border-strong sm:gap-4 sm:p-3', watched && 'bg-surface-2/60')}>
                <Link href={episodeHref(media, e.seasonNumber, e.episodeNumber)} className="relative hidden w-36 shrink-0 overflow-hidden rounded-[10px] sm:block">
                  <Still path={e.stillPath} alt="" className={cn(watched && 'opacity-70')} />
                  {watched ? <span className="absolute top-1.5 right-1.5 rounded-full bg-accent p-0.5 text-on-accent"><CheckCheck className="size-3" /></span> : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={episodeHref(media, e.seasonNumber, e.episodeNumber)} className="group/title flex items-baseline gap-2">
                    <span className="shrink-0 text-xs font-semibold text-accent tabular-nums">{episodeCode(e.seasonNumber, e.episodeNumber)}</span>
                    <span className="truncate text-sm font-medium text-fg group-hover/title:text-accent">{e.name ?? 'TBA'}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                    <span>{unaired ? `Airs ${formatDate(e.airDate)}` : formatDate(e.airDate)}</span>
                    {e.runtime ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {formatRuntime(e.runtime)}
                      </span>
                    ) : null}
                  </p>
                  {e.overview ? <p className={cn('mt-1 hidden text-xs leading-relaxed text-fg-muted sm:line-clamp-2', !watched && signedIn && 'blur-[3px] transition group-hover:blur-0')}>{e.overview}</p> : null}
                </div>
                <div className="flex shrink-0 items-start">
                  {unaired ? (
                    <span className="rounded-pill border border-border px-2 py-1 text-[11px] text-fg-subtle">Upcoming</span>
                  ) : (
                    <WatchedButton
                      target={{ kind: 'episode', episodeId: e.id, label: `${media.title} · ${episodeCode(e.seasonNumber, e.episodeNumber)}` }}
                      watched={watched}
                      watchCount={watches.length}
                      lastWatch={watches[0] ? { watchId: watches[0].id, deviceId: watches[0].deviceId, serviceId: watches[0].serviceId, emotions: watches[0].emotions, favoriteCharacterId: watches[0].favoriteCharacterId, note: watches[0].note } : null}
                      devices={devices}
                      services={services}
                      characters={characters}
                      defaults={defaults}
                      signedIn={signedIn}
                      size="sm"
                      variant="compact"
                    />
                  )}
                </div>
              </motion.li>
            );
          })}
        </motion.ol>
      </AnimatePresence>
    </div>
  );
}
