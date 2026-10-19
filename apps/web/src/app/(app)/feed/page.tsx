import { getHomeFeed } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, EmptyState, Island } from '@marutime/ui';
import { Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActivityItem } from '@/components/feed/activity-item';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Friends' };

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const user = await requireUser('/feed');
  const sp = await searchParams;
  const feed = await getHomeFeed(getDb(), user.id, { limit: 40, before: sp.before ?? null });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Friends" description="What the people you follow are watching, listing and loving." />
      {feed.items.length === 0 ? (
        <EmptyState icon={<Users />} title="Your feed is quiet" description="Follow people from their profiles or from the lists they publish." action={<Link href="/lists"><Button tabIndex={-1}>Browse lists</Button></Link>} />
      ) : (
        <Island>
          <ul className="-my-1 flex flex-col divide-y divide-border">
            {feed.items.map((item) => (
              <ActivityItem key={item.activity.id} item={item} />
            ))}
          </ul>
          {feed.nextCursor ? (
            <div className="mt-4 text-center">
              <Link href={`/feed?before=${encodeURIComponent(feed.nextCursor)}`}>
                <Button variant="secondary" size="sm" tabIndex={-1}>Older</Button>
              </Link>
            </div>
          ) : null}
        </Island>
      )}
    </div>
  );
}
