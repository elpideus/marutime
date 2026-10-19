import { getAdminOverview } from '@marutime/core';
import { mediaHref } from '@marutime/core/media';
import { getDb } from '@marutime/db';
import { Badge, Island, IslandHeader } from '@marutime/ui';
import Link from 'next/link';
import { SparkBars, StatTile } from '@/components/admin/stat-tile';
import { Poster } from '@/components/media/poster';
import { formatBytes, formatRelative } from '@/lib/format';

export default async function AdminOverviewPage() {
  const o = await getAdminOverview(getDb());
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Users" value={o.users.total.toLocaleString()} hint={`+${o.users.new7d} this week · ${o.users.active7d} active`} />
        <StatTile label="Check-ins" value={o.watches.total.toLocaleString()} hint={`${o.watches.last24h} today · ${o.watches.last7d} this week`} />
        <StatTile label="Public lists" value={o.content.publicLists.toLocaleString()} hint={`${o.content.comments.toLocaleString()} comments · ${o.content.media.toLocaleString()} titles`} />
        <StatTile label="Open reports" value={o.content.openReports} hint={o.content.openReports ? <Link href="/admin/reports" className="text-accent hover:underline">Review now</Link> : 'All clear'} tone={o.content.openReports ? 'danger' : 'default'} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Island>
          <IslandHeader title="Sign-ups" description="Last 14 days" />
          <SparkBars data={o.signupsByDay} label="Sign-ups per day" />
        </Island>
        <Island>
          <IslandHeader title="Check-ins" description="Last 14 days" />
          <SparkBars data={o.watchesByDay} label="Check-ins per day" />
        </Island>
        <Island>
          <IslandHeader title="Backups" action={<Link href="/admin/backups" className="text-sm text-accent hover:underline">Manage</Link>} />
          {o.lastBackup ? (
            <div className="text-sm">
              <Badge tone={o.lastBackup.status === 'completed' ? 'success' : o.lastBackup.status === 'failed' ? 'danger' : 'neutral'}>{o.lastBackup.status}</Badge>
              <p className="mt-2 text-fg">Last run {formatRelative(o.lastBackup.at)}</p>
              <p className="text-xs text-fg-muted">{formatBytes(o.lastBackup.sizeBytes)}</p>
            </div>
          ) : (
            <p className="text-sm text-fg-muted">No backups yet. Run one from the Backups tab or wait for the daily cron.</p>
          )}
          <p className="mt-3 text-xs text-fg-subtle">{o.users.suspended} suspended accounts.</p>
        </Island>
      </div>
      <Island>
        <IslandHeader title="Most watched this week" />
        {o.topShows.length === 0 ? <p className="text-sm text-fg-muted">No check-ins in the last 7 days.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {o.topShows.map((s) => (
              <li key={s.mediaId} className="flex items-center gap-3">
                <Link href={mediaHref(s)} className="w-10 shrink-0 overflow-hidden rounded-[8px]">
                  <Poster path={s.posterPath} title={s.title} size="w185" rounded="none" />
                </Link>
                <div className="min-w-0">
                  <Link href={mediaHref(s)} className="block truncate text-sm font-medium text-fg hover:text-accent">{s.title}</Link>
                  <p className="text-xs text-fg-muted">{s.watches} check-ins</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Island>
    </div>
  );
}
