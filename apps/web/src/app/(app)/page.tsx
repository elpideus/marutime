import { getActiveDevices, getActiveServices, getCharactersForMedia, getGlobalActivity, getHomeFeed, getRecentWatches, getUpcoming, getUserStats, getWatchNext, getWatchlist, trendingAll } from '@marutime/core';
import { getDb, type User } from '@marutime/db';
import { Button, Island, IslandHeader } from '@marutime/ui';
import { ArrowRight, Sparkles, Tv } from 'lucide-react';
import Link from 'next/link';
import { ActivityItem } from '@/components/feed/activity-item';
import { UpcomingIsland } from '@/components/home/upcoming';
import { WatchNextGrid } from '@/components/home/watch-next';
import { Landing } from '@/components/home/landing';
import { MediaRow } from '@/components/media/media-row';
import { PageHeader } from '@/components/page-header';
import { formatWatchTime } from '@/lib/format';
import { cardFromMedia, cardFromSummary } from '@/lib/media-card';
import { getCurrentUser } from '@/lib/session';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return <LoggedOutHome />;
  const sp = await searchParams;
  return <Dashboard user={user} welcome={sp.welcome === '1'} />;
}

async function LoggedOutHome() {
  const db = getDb();
  const [trending, activity] = await Promise.all([trendingAll().catch(() => []), getGlobalActivity(db, 8).catch(() => ({ items: [], nextCursor: null }))]);
  return <Landing trending={trending.map(cardFromSummary)} activity={activity.items} />;
}

async function Dashboard({ user, welcome }: { user: User; welcome: boolean }) {
  const db = getDb();
  const [watchNext, upcoming, recent, watchlist, stats, feed, devices, services, trending] = await Promise.all([
    getWatchNext(db, user.id, 12),
    getUpcoming(db, user.id, 8),
    getRecentWatches(db, user.id, 10),
    getWatchlist(db, user.id),
    getUserStats(db, user.id),
    getHomeFeed(db, user.id, { limit: 8 }),
    getActiveDevices(db),
    getActiveServices(db),
    trendingAll().catch(() => []),
  ]);
  const watchNextWithChars = await Promise.all(watchNext.map(async (w) => ({ ...w, characters: await getCharactersForMedia(db, w.media.id, { limit: 24 }) })));
  const defaults = { deviceId: user.preferences.defaultDeviceId ?? null, serviceId: user.preferences.defaultServiceId ?? null };
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Late night session' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const hasAnything = watchNext.length > 0 || recent.length > 0 || watchlist.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={welcome ? 'Welcome to MaruTime' : undefined}
        title={`${greeting}, ${user.displayName.split(' ')[0]}`}
        description={hasAnything ? `${stats.episodes} episodes and ${stats.movies} movies tracked · ${formatWatchTime(stats.minutes)} watched` : 'Follow a show or mark a movie watched to get started.'}
        action={
          <Link href="/discover">
            <Button variant="secondary" tabIndex={-1}>
              <Sparkles className="size-4" /> Discover
            </Button>
          </Link>
        }
      />

      <section>
        <div className="mb-3 flex items-end justify-between px-0.5">
          <h2 className="text-lg font-semibold tracking-tight text-fg">Watch next</h2>
          <Link href="/shows" className="text-sm font-medium text-accent hover:underline">
            My shows
          </Link>
        </div>
        {watchNextWithChars.length > 0 ? (
          <WatchNextGrid items={watchNextWithChars} devices={devices} services={services} defaults={defaults} />
        ) : (
          <Island className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-[16px] bg-accent-soft text-accent">
              <Tv className="size-6" />
            </span>
            <div>
              <p className="font-semibold text-fg">You are all caught up</p>
              <p className="mt-1 text-sm text-fg-muted">Follow a show and its next unwatched episode will show up here.</p>
            </div>
            <Link href="/discover">
              <Button size="sm" tabIndex={-1}>
                Find something to watch <ArrowRight className="size-4" />
              </Button>
            </Link>
          </Island>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingIsland items={upcoming} />
        </div>
        <Island>
          <IslandHeader title="Friends" action={<Link href="/feed" className="text-sm font-medium text-accent hover:underline">All</Link>} />
          {feed.items.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Follow people to see what they are watching. <Link href="/lists" className="text-accent hover:underline">Browse lists</Link> to find them.
            </p>
          ) : (
            <ul className="-my-1 flex flex-col divide-y divide-border">
              {feed.items.slice(0, 5).map((item) => (
                <ActivityItem key={item.activity.id} item={item} />
              ))}
            </ul>
          )}
        </Island>
      </div>

      {watchlist.length > 0 ? <MediaRow title="From your watchlist" description="Ready when you are" items={watchlist.slice(0, 15).map((w) => cardFromMedia(w.media))} href="/watchlist" /> : null}
      {recent.length > 0 ? (
        <MediaRow
          title="Recently watched"
          items={Array.from(new Map(recent.map((r) => [r.media.id, r])).values()).map((r) => cardFromMedia(r.media))}
          href={`/u/${user.username}`}
          hrefLabel="Your profile"
        />
      ) : null}
      <MediaRow title="Trending this week" description="Across shows, movies and anime" items={trending.slice(0, 20).map(cardFromSummary)} href="/discover" />
    </div>
  );
}
