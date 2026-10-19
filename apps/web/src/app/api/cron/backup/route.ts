import { getEnv } from '@marutime/config';
import { getSettings, pruneBackups, runBackup } from '@marutime/core';
import { getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

/** Daily logical backup (Vercel Cron / docker cron). */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  const settings = await getSettings(db, { fresh: true });
  if (!settings['backup.enabled']) return NextResponse.json({ skipped: true, reason: 'backups disabled in settings' });
  const storage = getStorage();
  const result = await runBackup(db, storage, { kind: 'scheduled' });
  const pruned = result.status === 'completed' ? await pruneBackups(db, storage).catch(() => 0) : 0;
  return NextResponse.json({ id: result.id, status: result.status, sizeBytes: result.sizeBytes, key: result.storageKey, error: result.error, pruned }, { status: result.status === 'completed' ? 200 : 500 });
}

export const POST = GET;
