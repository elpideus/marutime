import { getLibrary, type LibraryShow } from '@marutime/core';
import { episodeHref, mediaHref } from '@marutime/core/media';
import { getDb } from '@marutime/db';
import { Badge, Button, EmptyState, Island, ProgressBar } from '@marutime/ui';
import { Star, Tv } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Poster } from '@/components/media/poster';
import { PageHeader } from '@/components/page-header';
import { LibraryTabs } from '@/components/tracking/library-tabs';
import { episodeCode, formatDate, formatRelative } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'My shows' };

type Bucket = 'watching' | 'up_to_date' | 'upcoming' | 'completed' | 'on_hold' | 'dropped';

function bucketOf(l: LibraryShow): Bucket {
  if (l.tracking.status === 'completed') return 'completed';
  if (l.tracking.status === 'on_hold') return 'on_hold';
  if (l.tracking.status === 'dropped') return 'dropped';
  if (l.progress.nextEpisode) return 'watching';
  if (l.progress.upcomingEpisode) return 'upcoming';
  return 'up_to_date';
}

export default async function MyShowsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser('/shows');
  const sp = await searchParams;
  const library = await getLibrary(getDb(), user.id);
  const buckets: Record<Bucket, LibraryShow[]> = { watching: [], up_to_date: [], upcoming: [], completed: [], on_hold: [], dropped: [] };
  for (const l of library) buckets[bucketOf(l)].push(l);
  const tab: Bucket = (['watching', 'up_to_date', 'upcoming', 'completed', 'on_hold', 'dropped'] as Bucket[]).includes(sp.tab as Bucket) ? (sp.tab as Bucket) : 'watching';
  const items = buckets[tab];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My shows" description={`${library.length} shows followed`} />
      <LibraryTabs value={tab} counts={{ watching: buckets.watching.length, up_to_date: buckets.up_to_date.length, upcoming: buckets.upcoming.length, completed: buckets.completed.length, on_hold: buckets.on_hold.length, dropped: buckets.dropped.length }} />
      {library.length === 0 ? (
        <EmptyState icon={<Tv />} title="You are not following any shows" description="Follow a show to track episodes, see what to watch next and when new episodes air." action={<Link href="/discover"><Button tabIndex={-1}>Discover shows</Button></Link>} />
      ) : items.length === 0 ? (
        <Island className="py-10 text-center text-sm text-fg-muted">Nothing in this tab.</Island>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((l) => {
            const next = l.progress.nextEpisode;
            return (
              <li key={l.media.id}>
                <Island padding="sm" interactive className="flex gap-3">
                  <Link href={mediaHref(l.media)} className="w-16 shrink-0 overflow-hidden rounded-[10px]">
                    <Poster path={l.media.posterPath} title={l.media.title} size="w185" rounded="none" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={mediaHref(l.media)} className="truncate text-sm font-semibold text-fg hover:text-accent">{l.media.title}</Link>
                      {l.tracking.isFavorite ? <Star className="size-4 shrink-0 fill-accent text-accent" /> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {l.progress.watchedEpisodes}/{l.progress.airedEpisodes} episodes{l.progress.remaining > 0 ? ` · ${l.progress.remaining} left` : ''}
                    </p>
                    <ProgressBar value={l.progress.percent} size="sm" className="mt-2" tone={l.progress.percent === 100 ? 'success' : 'accent'} />
                    <div className="mt-2 text-xs">
                      {next ? (
                        <Link href={episodeHref(l.media, next.seasonNumber, next.episodeNumber)} className="text-accent hover:underline">
                          Next: {episodeCode(next.seasonNumber, next.episodeNumber)} {next.name ?? ''}
                        </Link>
                      ) : l.progress.upcomingEpisode ? (
                        <span className="text-fg-muted">{episodeCode(l.progress.upcomingEpisode.seasonNumber, l.progress.upcomingEpisode.episodeNumber)} airs {formatDate(l.progress.upcomingEpisode.airDate, { day: 'numeric', month: 'short' })}</span>
                      ) : (
                        <Badge tone="success">Up to date</Badge>
                      )}
                      {l.tracking.lastWatchedAt ? <span className="ml-2 text-fg-subtle">· watched {formatRelative(l.tracking.lastWatchedAt)}</span> : null}
                    </div>
                  </div>
                </Island>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
