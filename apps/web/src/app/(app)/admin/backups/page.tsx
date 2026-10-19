import { getEnv } from '@marutime/config';
import { listBackups } from '@marutime/core';
import { getDb } from '@marutime/db';
import type { Metadata } from 'next';
import { BackupsPanel } from '@/components/admin/backups-panel';
import { requireAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'Backups' };

const STORAGE_LABEL = { local: 'local disk', s3: 'S3-compatible storage', 'vercel-blob': 'Vercel Blob' } as const;

export default async function AdminBackupsPage() {
  await requireAdmin();
  const env = getEnv();
  const backups = await listBackups(getDb());
  return <BackupsPanel backups={backups} encrypted={Boolean(env.BACKUP_ENCRYPTION_KEY)} storage={STORAGE_LABEL[env.STORAGE_PROVIDER]} />;
}
