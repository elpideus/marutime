import { getBackup, logAudit, readBackup } from '@marutime/core';
import { getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin download of a stored backup, exactly as stored (still encrypted when
 * BACKUP_ENCRYPTION_KEY is set). `pnpm restore --file` decrypts it.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  const { id } = await ctx.params;
  const db = getDb();
  const backup = await getBackup(db, id).catch(() => null);
  if (!backup || backup.status !== 'completed' || !backup.storageKey) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  const data = await readBackup(getStorage(), backup, { decrypt: false });
  if (!data) return NextResponse.json({ error: 'Backup file is missing from storage' }, { status: 404 });
  await logAudit(db, { actorId: actor.id, action: 'backup.download', targetType: 'backup', targetId: id });
  const filename = backup.storageKey.split('/').pop() ?? `marutime-backup-${id}.ndjson.gz`;
  return new NextResponse(Buffer.from(data), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(data.byteLength),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
