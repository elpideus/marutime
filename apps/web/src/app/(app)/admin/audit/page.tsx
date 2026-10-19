import { listAuditLogs } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, Island } from '@marutime/ui';
import Link from 'next/link';
import { formatDateTime } from '@/lib/format';

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const logs = await listAuditLogs(getDb(), { page, limit: 50 });
  return (
    <div className="flex flex-col gap-4">
      <Island padding="none">
        <table className="w-full text-left text-sm">
          <thead className="text-xs tracking-wide text-fg-subtle uppercase">
            <tr className="border-b border-border"><th className="px-4 py-3">When</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Details</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map(({ log, actor }) => (
              <tr key={log.id}>
                <td className="px-4 py-2 text-xs text-fg-muted whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-2 text-fg">{actor ? `@${actor.username}` : 'system'}</td>
                <td className="px-4 py-2 font-mono text-xs text-accent">{log.action}</td>
                <td className="px-4 py-2 text-xs text-fg-muted">{log.targetType ? `${log.targetType} ${log.targetId ?? ''}` : ''}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-fg-subtle break-all">{Object.keys(log.meta).length ? JSON.stringify(log.meta) : ''}</td>
              </tr>
            ))}
            {logs.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-fg-muted">Nothing logged yet.</td></tr> : null}
          </tbody>
        </table>
      </Island>
      <div className="flex justify-end gap-2">
        {page > 1 ? <Link href={`/admin/audit?page=${page - 1}`}><Button size="sm" variant="secondary" tabIndex={-1}>Newer</Button></Link> : null}
        {logs.length === 50 ? <Link href={`/admin/audit?page=${page + 1}`}><Button size="sm" variant="secondary" tabIndex={-1}>Older</Button></Link> : null}
      </div>
    </div>
  );
}
