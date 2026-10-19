import { listExportRequests, listImportJobs } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, Island, IslandHeader } from '@marutime/ui';
import { FileJson, FileSpreadsheet } from 'lucide-react';
import type { Metadata } from 'next';
import { DeleteAccountForm } from '@/components/settings/account-forms';
import { ImportPanel } from '@/components/settings/import-panel';
import { formatBytes, formatDateTime } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Your data' };

export default async function DataSettingsPage() {
  const user = await requireUser('/settings/data');
  const db = getDb();
  const [exports, imports] = await Promise.all([listExportRequests(db, user.id), listImportJobs(db, user.id)]);
  return (
    <div className="flex flex-col gap-6">
      <ImportPanel initialJobs={imports} />
      <Island>
        <IslandHeader title="Download your data" description="Everything MaruTime holds about you: profile, check-ins (with your private details), shows you follow, watchlist, lists, comments and account metadata." />
        <div className="flex flex-wrap gap-2">
          <a href="/api/me/export?format=json" download>
            <Button variant="secondary" tabIndex={-1}>
              <FileJson className="size-4" /> Everything (JSON)
            </Button>
          </a>
          <a href="/api/me/export?format=csv" download>
            <Button variant="secondary" tabIndex={-1}>
              <FileSpreadsheet className="size-4" /> Watch history (CSV)
            </Button>
          </a>
        </div>
        <p className="mt-3 text-xs text-fg-subtle">Exports are generated on the spot and never stored. Password hashes and token secrets are left out.</p>
        {exports.length > 0 ? (
          <div className="mt-5 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Recent exports</h3>
            <ul className="flex flex-col gap-1.5 text-sm">
              {exports.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 text-fg-muted">
                  <span>{formatDateTime(e.requestedAt)}{e.requestedById && e.requestedById !== user.id ? ' · by staff' : ''}</span>
                  <span className="text-xs tabular-nums">{formatBytes(e.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Island>
      <Island className="border-danger/25">
        <IslandHeader title="Delete your account" description="Permanently removes your profile, check-ins, lists, comments and uploads. This cannot be undone, so download your data first if you want to keep it." />
        <DeleteAccountForm username={user.username} hasPassword={Boolean(user.passwordHash)} />
      </Island>
    </div>
  );
}
