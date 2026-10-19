import { getLibrary, getProfile, getUserActivity, getUserLists, getUserStats, getWatchedMovies } from '@marutime/core';
import { mediaHref } from '@marutime/core/media';
import { getDb } from '@marutime/db';
import { Island, IslandHeader, ProgressBar } from '@marutime/ui';
import { Lock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActivityItem } from '@/components/feed/activity-item';
import { ListCard } from '@/components/lists/list-card';
import { MediaRow } from '@/components/media/media-row';
import { Poster } from '@/components/media/poster';
import { ProfileHeader } from '@/components/profile/profile-header';
import { cardFromMedia } from '@/lib/media-card';
import { getCurrentUser } from '@/lib/session';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(getDb(), username, null);
  return profile ? { title: `${profile.user.displayName} (@${profile.user.username})`, description: profile.user.bio ?? undefined } : { title: 'Profile' };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const db = getDb();
  const viewer = await getCurrentUser();
  const profile = await getProfile(db, username, viewer?.id ?? null);
  if (!profile) notFound();
  const canView = profile.viewer.canViewContent;
  const [lists, activity, library, movies, stats] = canView
    ? await Promise.all([getUserLists(db, profile.user.id, viewer), getUserActivity(db, profile.user.id, { limit: 12 }), getLibrary(db, profile.user.id), getWatchedMovies(db, profile.user.id, 20), getUserStats(db, profile.user.id)])
    : [[], { items: [], nextCursor: null }, [], [], null];
  const watching = library.filter((l) => l.tracking.status === 'watching').slice(0, 12);
  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader profile={profile} signedIn={Boolean(viewer)} />
      {!canView ? (
        <Island className="flex items-center gap-3 text-sm text-fg-muted">
          <Lock className="size-5 shrink-0 text-fg-subtle" /> This profile is {profile.visibility === 'followers' ? 'visible to followers only.' : 'private.'}
        </Island>
      ) : (
        <>
          {stats && stats.topShows.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <Island className="lg:col-span-2">
                <IslandHeader title="Most watched" description="By episodes checked in" />
                <ul className="grid gap-3 sm:grid-cols-2">
                  {stats.topShows.map((s) => (
                    <li key={s.mediaId} className="flex items-center gap-3">
                      <Link href={mediaHref({ type: 'show', externalId: s.externalId, slug: s.slug })} className="w-10 shrink-0 overflow-hidden rounded-[8px]">
                        <Poster path={s.posterPath} title={s.title} size="w185" rounded="none" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={mediaHref({ type: 'show', externalId: s.externalId, slug: s.slug })} className="block truncate text-sm font-medium text-fg hover:text-accent">
                          {s.title}
                        </Link>
                        <ProgressBar value={(s.episodes / (stats.topShows[0]?.episodes ?? 1)) * 100} size="sm" className="mt-1.5" />
                      </div>
                      <span className="text-xs text-fg-muted tabular-nums">{s.episodes} ep</span>
                    </li>
                  ))}
                </ul>
              </Island>
              <Island>
                <IslandHeader title="Favourite genres" />
                {stats.genres.length === 0 ? <p className="text-sm text-fg-muted">Not enough data yet.</p> : (
                  <ul className="flex flex-col gap-2">
                    {stats.genres.slice(0, 6).map((g) => (
                      <li key={g.item} className="flex items-center gap-3 text-sm">
                        <span className="w-28 truncate text-fg">{g.item}</span>
                        <ProgressBar value={g.percent} size="sm" className="flex-1" />
                        <span className="w-9 text-right text-xs text-fg-muted tabular-nums">{g.percent}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Island>
            </div>
          ) : null}
          {watching.length > 0 ? <MediaRow title="Currently watching" items={watching.map((l) => cardFromMedia(l.media))} renderCard={undefined} /> : null}
          {movies.length > 0 ? <MediaRow title="Recently watched movies" items={movies.map((m) => cardFromMedia(m.media))} /> : null}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-fg">Lists</h2>
                <Link href={`/u/${profile.user.username}/lists`} className="text-sm font-medium text-accent hover:underline">All lists</Link>
              </div>
              {lists.length === 0 ? <Island className="py-10 text-center text-sm text-fg-muted">No lists to show.</Island> : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {lists.slice(0, 4).map((card) => (
                    <ListCard key={card.list.id} card={card} signedIn={Boolean(viewer)} />
                  ))}
                </div>
              )}
            </div>
            <Island>
              <IslandHeader title="Recent activity" />
              {activity.items.length === 0 ? <p className="text-sm text-fg-muted">Quiet so far.</p> : (
                <ul className="-my-1 flex flex-col divide-y divide-border">
                  {activity.items.map((item) => (
                    <ActivityItem key={item.activity.id} item={item} />
                  ))}
                </ul>
              )}
            </Island>
          </div>
        </>
      )}
    </div>
  );
}
