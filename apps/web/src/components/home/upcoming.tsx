import type { UpcomingItem } from '@marutime/core';
import { episodeHref } from '@marutime/core/hrefs';
import { Island, IslandHeader } from '@marutime/ui';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { Poster } from '@/components/media/poster';
import { daysUntilLabel, episodeCode, formatDate } from '@/lib/format';

export function UpcomingIsland({ items }: { items: UpcomingItem[] }) {
  return (
    <Island>
      <IslandHeader title="Upcoming" description="New episodes from shows you follow" />
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-fg-muted">
          <CalendarDays className="size-4" /> Nothing scheduled yet. Follow more shows to fill this up.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.slice(0, 8).map((u) => (
            <li key={u.episode.id}>
              <Link href={episodeHref(u.media, u.episode.seasonNumber, u.episode.episodeNumber)} className="flex items-center gap-3 py-2.5 transition-colors hover:text-accent">
                <div className="w-9 shrink-0 overflow-hidden rounded-[8px]">
                  <Poster path={u.media.posterPath} title={u.media.title} size="w185" rounded="none" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{u.media.title}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {episodeCode(u.episode.seasonNumber, u.episode.episodeNumber)} {u.episode.name ? `· ${u.episode.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold text-accent">{daysUntilLabel(u.daysUntil)}</p>
                  <p className="text-[11px] text-fg-subtle">{formatDate(u.episode.airDate, { day: 'numeric', month: 'short' })}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Island>
  );
}
