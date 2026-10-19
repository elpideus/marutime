import { listReports } from '@marutime/core';
import { getDb } from '@marutime/db';
import Link from 'next/link';
import { ReportsList } from '@/components/admin/reports-list';

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status === 'resolved' || sp.status === 'dismissed' || sp.status === 'all' ? sp.status : 'open';
  const reports = await listReports(getDb(), { status });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 text-sm">
        {(['open', 'resolved', 'dismissed', 'all'] as const).map((s) => (
          <Link key={s} href={`/admin/reports?status=${s}`} className={`rounded-pill border px-3 py-1 capitalize ${s === status ? 'border-accent bg-accent text-on-accent' : 'border-border text-fg-muted hover:text-fg'}`}>
            {s}
          </Link>
        ))}
      </div>
      <ReportsList reports={reports} />
    </div>
  );
}
