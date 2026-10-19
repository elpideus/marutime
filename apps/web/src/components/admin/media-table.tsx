'use client';

import type { Media } from '@marutime/db';
import { mediaHref } from '@marutime/core/hrefs';
import { Button, Island, useToast } from '@marutime/ui';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { adminResyncMediaAction } from '@/actions/admin';
import { TypeBadge } from '@/components/media/type-badge';
import { formatRelative } from '@/lib/format';

export function MediaTable({ items }: { items: Array<Media & { watchCount: number }> }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const resync = (id: number) =>
    start(async () => {
      const r = await adminResyncMediaAction(id);
      toast(r.ok ? { tone: 'success', title: 'Re-synced from TMDB' } : { tone: 'error', title: r.error });
      router.refresh();
    });
  return (
    <Island padding="none">
      <table className="w-full text-left text-sm">
        <thead className="text-xs tracking-wide text-fg-subtle uppercase">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">TMDB</th>
            <th className="px-4 py-3">Check-ins</th>
            <th className="px-4 py-3">Synced</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((m) => (
            <tr key={m.id} className="hover:bg-surface-2/60">
              <td className="px-4 py-2.5"><Link href={mediaHref(m)} className="font-medium text-fg hover:text-accent">{m.title}</Link><span className="ml-2 text-xs text-fg-subtle">{m.releaseDate?.slice(0, 4)}</span></td>
              <td className="px-4 py-2.5"><TypeBadge type={m.type} isAnime={m.isAnime} /></td>
              <td className="px-4 py-2.5 font-mono text-xs text-fg-muted">{m.externalId}</td>
              <td className="px-4 py-2.5 text-fg-muted">{m.watchCount}</td>
              <td className="px-4 py-2.5 text-xs text-fg-muted">{m.syncedAt ? formatRelative(m.syncedAt) : 'never'}</td>
              <td className="px-2 py-2.5 text-right"><Button size="icon-sm" variant="ghost" aria-label="Re-sync" tooltip="Fetch everything again from TMDB now" onClick={() => resync(m.id)} loading={pending}><RefreshCw className="size-4" /></Button></td>
            </tr>
          ))}
          {items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-fg-muted">No titles match.</td></tr> : null}
        </tbody>
      </table>
    </Island>
  );
}
