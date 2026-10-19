import { getNotifications, markNotificationsRead } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Avatar, EmptyState, Island, cn } from '@marutime/ui';
import { Bell } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { formatRelative } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Notifications' };

function describe(n: Awaited<ReturnType<typeof getNotifications>>[number]): { text: string; href: string } {
  const actor = n.actor?.displayName ?? 'Someone';
  const p = n.payload as Record<string, unknown>;
  switch (n.type) {
    case 'comment_reply':
      return { text: `${actor} replied to your comment${p.isSpoiler ? ' (spoiler)' : ''}: “${String(p.excerpt ?? '')}”`, href: p.episodeId || p.mediaId ? '#' : '#' };
    case 'comment_like':
      return { text: `${actor} liked your comment`, href: '#' };
    case 'list_like':
      return { text: `${actor} liked your list “${String(p.title ?? '')}”`, href: '#' };
    case 'new_follower':
      return { text: `${actor} started following you`, href: n.actor ? `/u/${n.actor.username}` : '#' };
    case 'export_ready':
      return { text: 'Your data export is ready to download', href: '/settings/data' };
    default:
      return { text: String(p.message ?? 'Notification'), href: '#' };
  }
}

export default async function NotificationsPage() {
  const user = await requireUser('/notifications');
  const db = getDb();
  const items = await getNotifications(db, user.id, 50);
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
  if (unreadIds.length) await markNotificationsRead(db, user.id, unreadIds);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Notifications" />
      {items.length === 0 ? <EmptyState icon={<Bell />} title="Nothing yet" description="Replies, likes and new followers will land here." /> : (
        <Island padding="none">
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const d = describe(n);
              const unread = unreadIds.includes(n.id);
              return (
                <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', unread && 'bg-accent-soft/40')}>
                  {n.actor ? (
                    <Link href={`/u/${n.actor.username}`}>
                      <Avatar src={n.actor.avatarUrl} name={n.actor.displayName} size="sm" />
                    </Link>
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-surface-3 text-fg-muted"><Bell className="size-4" /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    {d.href !== '#' ? <Link href={d.href} className="text-sm text-fg hover:text-accent">{d.text}</Link> : <p className="text-sm text-fg">{d.text}</p>}
                    <p className="mt-0.5 text-xs text-fg-subtle">{formatRelative(n.createdAt)}</p>
                  </div>
                  {unread ? <span className="mt-2 size-2 rounded-full bg-accent" aria-label="Unread" /> : null}
                </li>
              );
            })}
          </ul>
        </Island>
      )}
    </div>
  );
}
