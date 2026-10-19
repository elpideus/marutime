'use client';

import type { Backup } from '@marutime/db';
import { Badge, Button, Island, IslandHeader, useToast } from '@marutime/ui';
import { Download, Play, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { adminDeleteBackupAction, adminRunBackupAction } from '@/actions/admin';
import { formatBytes, formatDateTime } from '@/lib/format';

export function BackupsPanel({ backups, encrypted, storage }: { backups: Backup[]; encrypted: boolean; storage: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const run = () =>
    start(async () => {
      const r = await adminRunBackupAction();
      if (!r.ok) toast({ tone: 'error', title: r.error });
      else if (r.data.status !== 'completed') toast({ tone: 'error', title: 'Backup failed', description: r.data.error ?? undefined });
      else toast({ tone: 'success', title: 'Backup complete' });
      router.refresh();
    });
  const remove = (id: string) => {
    if (!confirm('Delete this backup file?')) return;
    start(async () => {
      const r = await adminDeleteBackupAction(id);
      toast(r.ok ? { tone: 'success', title: 'Deleted' } : { tone: 'error', title: r.error });
      router.refresh();
    });
  };
  return (
    <div className="flex flex-col gap-6">
      <Island>
        <IslandHeader
          title="Backups"
          description={`Logical NDJSON snapshots of every table, gzipped${encrypted ? ' and AES-256-GCM encrypted' : ''}, stored privately on ${storage}. A daily cron runs them automatically.`}
          action={<Button onClick={run} loading={pending}><Play className="size-4" /> Run backup now</Button>}
        />
        {!encrypted ? <p className="rounded-card border border-accent/30 bg-accent-soft p-3 text-xs text-fg">Tip: set <code className="font-mono">BACKUP_ENCRYPTION_KEY</code> so backups are encrypted at rest. Required when using Vercel Blob, whose objects are public-by-URL.</p> : null}
        <ul className="mt-4 divide-y divide-border">
          {backups.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <Badge tone={b.status === 'completed' ? 'success' : b.status === 'failed' ? 'danger' : 'neutral'}>{b.status}</Badge>
              <Badge tone="outline">{b.kind}</Badge>
              <span className="min-w-0 flex-1 truncate text-fg">{b.storageKey ?? b.error ?? '…'}</span>
              <span className="text-xs text-fg-muted">{formatDateTime(b.startedAt)} · {formatBytes(b.sizeBytes)}</span>
              {b.status === 'completed' ? (
                <a href={`/api/admin/backups/${b.id}`} download>
                  <Button size="icon-sm" variant="ghost" aria-label="Download" tabIndex={-1} tooltip="Download as stored (encrypted if a key is set)"><Download className="size-4" /></Button>
                </a>
              ) : null}
              <Button size="icon-sm" variant="ghost" aria-label="Delete" tooltip="Delete this backup file" onClick={() => remove(b.id)}><Trash className="size-4" /></Button>
            </li>
          ))}
          {backups.length === 0 ? <li className="py-6 text-center text-sm text-fg-muted">No backups yet.</li> : null}
        </ul>
      </Island>
      <Island tone="elevated">
        <IslandHeader title="Restore" description="Restores replace all current data, so they run from the command line on purpose." />
        <pre className="overflow-x-auto rounded-card bg-bg p-3 font-mono text-xs text-fg-muted">{`# from the repository root, with DATABASE_URL and storage env set
pnpm restore --id <backup id> --yes
# or from a downloaded file
pnpm restore --file marutime-….ndjson.gz --yes`}</pre>
      </Island>
    </div>
  );
}
