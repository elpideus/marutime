'use client';

import type { ReportView } from '@marutime/core';
import { Badge, Button, Island, useToast } from '@marutime/ui';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { adminResolveReportAction } from '@/actions/admin';
import { hideCommentAction } from '@/actions/comments';
import { formatRelative } from '@/lib/format';

export function ReportsList({ reports }: { reports: ReportView[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? { tone: 'success', title: msg } : { tone: 'error', title: r.error ?? 'Failed' });
      router.refresh();
    });
  if (reports.length === 0) return <Island className="py-10 text-center text-sm text-fg-muted">No reports in this view. Lovely.</Island>;
  return (
    <ul className="flex flex-col gap-3">
      {reports.map(({ report, reporter, preview }) => (
        <li key={report.id}>
          <Island padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={report.status === 'open' ? 'danger' : report.status === 'resolved' ? 'success' : 'neutral'}>{report.status}</Badge>
                <Badge tone="outline">{report.targetType}</Badge>
                <Badge tone="accent">{report.reason.replace('_', ' ')}</Badge>
                <span className="text-fg-subtle">{formatRelative(report.createdAt)} · by {reporter ? `@${reporter.username}` : 'deleted user'}</span>
              </div>
              <p className="mt-2 rounded-card bg-surface-2 p-3 text-sm text-fg">{preview}</p>
              {report.details ? <p className="mt-2 text-xs text-fg-muted">“{report.details}”</p> : null}
              {report.resolutionNote ? <p className="mt-1 text-xs text-fg-subtle">Resolution: {report.resolutionNote}</p> : null}
            </div>
            {report.status === 'open' ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                {report.targetType === 'comment' ? (
                  <Button size="sm" variant="danger" loading={pending} onClick={() => act(async () => { const h = await hideCommentAction(report.targetId, true, report.reason); if (!h.ok) return h; return adminResolveReportAction(report.id, 'resolved', 'Comment hidden'); }, 'Comment hidden and report resolved')}>
                    Hide comment
                  </Button>
                ) : null}
                <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => adminResolveReportAction(report.id, 'resolved'), 'Resolved')}>Resolve</Button>
                <Button size="sm" variant="ghost" loading={pending} onClick={() => act(() => adminResolveReportAction(report.id, 'dismissed'), 'Dismissed')}>Dismiss</Button>
              </div>
            ) : null}
          </Island>
        </li>
      ))}
    </ul>
  );
}
