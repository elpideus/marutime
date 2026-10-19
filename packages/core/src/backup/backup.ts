import { getEnv } from '@marutime/config';
import { backups, desc, eq, lt, sql, type Backup, type DbExecutor, type Database } from '@marutime/db';
import type { StorageProvider } from '@marutime/storage';
import { getTableName } from 'drizzle-orm';
import { gunzipSync, gzipSync } from 'node:zlib';
import { getSettings } from '../settings';
import { logAudit } from '../admin/audit';
import { decryptBackup, encryptBackup, isEncryptedBackup } from './encryption';
import { BACKUP_TABLES, BACKUP_TABLE_NAMES } from './tables';

export const BACKUP_FORMAT_VERSION = 1;
const BATCH = 1000;

export type BackupHeader = { format: 'marutime-backup'; version: number; createdAt: string; tables: string[]; appVersion?: string };

export type RunBackupOptions = { kind: 'scheduled' | 'manual'; actorId?: string | null; prefix?: string };

/**
 * Logical backup: every table serialised as NDJSON (one row per line), gzipped,
 * optionally encrypted, uploaded as a private object. Works on serverless
 * hosts where `pg_dump` is unavailable.
 */
export async function buildBackupPayload(db: DbExecutor): Promise<{ data: Uint8Array; tableCounts: Record<string, number> }> {
  const header: BackupHeader = { format: 'marutime-backup', version: BACKUP_FORMAT_VERSION, createdAt: new Date().toISOString(), tables: BACKUP_TABLE_NAMES };
  const lines: string[] = [JSON.stringify({ header })];
  const tableCounts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const name = getTableName(table);
    let offset = 0;
    let n = 0;
    for (;;) {
      const rows = await db.select().from(table).limit(BATCH).offset(offset);
      for (const row of rows) lines.push(JSON.stringify({ t: name, r: row }));
      n += rows.length;
      if (rows.length < BATCH) break;
      offset += BATCH;
    }
    tableCounts[name] = n;
  }
  lines.push(JSON.stringify({ end: true, tableCounts }));
  return { data: new Uint8Array(gzipSync(Buffer.from(lines.join('\n'), 'utf8'), { level: 6 })), tableCounts };
}

export function backupKey(prefix = 'backups', date = new Date()): string {
  const stamp = date.toISOString().replace(/[:.]/g, '-');
  return `${prefix}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/marutime-${stamp}.ndjson.gz`;
}

export async function runBackup(db: Database, storage: StorageProvider, opts: RunBackupOptions): Promise<Backup> {
  const [record] = await db.insert(backups).values({ kind: opts.kind, status: 'running', createdById: opts.actorId ?? null }).returning();
  const rec = record!;
  try {
    const { data, tableCounts } = await buildBackupPayload(db);
    const passphrase = getEnv().BACKUP_ENCRYPTION_KEY;
    const payload = passphrase ? encryptBackup(data, passphrase) : data;
    const key = backupKey(opts.prefix) + (passphrase ? '.enc' : '');
    await storage.put(key, payload, { contentType: 'application/octet-stream', access: 'private', cacheControl: 'private, no-store' });
    const [done] = await db
      .update(backups)
      .set({ status: 'completed', storageKey: key, sizeBytes: payload.byteLength, tableCounts, completedAt: new Date() })
      .where(eq(backups.id, rec.id))
      .returning();
    await logAudit(db, { actorId: opts.actorId ?? null, action: 'backup.run', targetType: 'backup', targetId: rec.id, meta: { kind: opts.kind, key, bytes: payload.byteLength } });
    return done!;
  } catch (err) {
    const [failed] = await db
      .update(backups)
      .set({ status: 'failed', error: (err as Error).message.slice(0, 2000), completedAt: new Date() })
      .where(eq(backups.id, rec.id))
      .returning();
    return failed!;
  }
}

export async function listBackups(db: DbExecutor, limit = 50): Promise<Backup[]> {
  return db.select().from(backups).orderBy(desc(backups.startedAt)).limit(limit);
}

export async function getBackup(db: DbExecutor, id: string): Promise<Backup | null> {
  const rows = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Download a backup's bytes, decrypting when a passphrase is configured. */
export async function readBackup(storage: StorageProvider, backup: Backup, opts: { decrypt?: boolean } = { decrypt: true }): Promise<Uint8Array | null> {
  if (!backup.storageKey) return null;
  const data = await storage.get(backup.storageKey);
  if (!data) return null;
  if (opts.decrypt && isEncryptedBackup(data)) {
    const passphrase = getEnv().BACKUP_ENCRYPTION_KEY;
    if (!passphrase) throw new Error('Backup is encrypted but BACKUP_ENCRYPTION_KEY is not set');
    return decryptBackup(data, passphrase);
  }
  return data;
}

export async function deleteBackup(db: DbExecutor, storage: StorageProvider, id: string, actorId: string | null): Promise<void> {
  const backup = await getBackup(db, id);
  if (!backup) return;
  if (backup.storageKey) await storage.delete(backup.storageKey).catch(() => {});
  await db.delete(backups).where(eq(backups.id, id));
  await logAudit(db, { actorId, action: 'backup.delete', targetType: 'backup', targetId: id });
}

/** Remove backups older than the configured retention, keeping at least the newest 3. */
export async function pruneBackups(db: Database, storage: StorageProvider): Promise<number> {
  const settings = await getSettings(db);
  const days = Math.max(1, settings['backup.retentionDays']);
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const newest = await db.select({ id: backups.id }).from(backups).where(eq(backups.status, 'completed')).orderBy(desc(backups.startedAt)).limit(3);
  const keep = new Set(newest.map((n) => n.id));
  const old = await db.select().from(backups).where(lt(backups.startedAt, cutoff));
  let n = 0;
  for (const b of old) {
    if (keep.has(b.id)) continue;
    if (b.storageKey) await storage.delete(b.storageKey).catch(() => {});
    await db.delete(backups).where(eq(backups.id, b.id));
    n++;
  }
  return n;
}

export function parseBackup(data: Uint8Array): { header: BackupHeader; rows: Array<{ t: string; r: Record<string, unknown> }>; tableCounts: Record<string, number> | null } {
  const text = gunzipSync(Buffer.from(data)).toString('utf8');
  const lines = text.split('\n').filter(Boolean);
  const first = JSON.parse(lines[0] ?? '{}') as { header?: BackupHeader };
  if (!first.header || first.header.format !== 'marutime-backup') throw new Error('Not a MaruTime backup file');
  const rows: Array<{ t: string; r: Record<string, unknown> }> = [];
  let tableCounts: Record<string, number> | null = null;
  for (const line of lines.slice(1)) {
    const parsed = JSON.parse(line) as { t?: string; r?: Record<string, unknown>; end?: boolean; tableCounts?: Record<string, number> };
    if (parsed.end) tableCounts = parsed.tableCounts ?? null;
    else if (parsed.t && parsed.r) rows.push({ t: parsed.t, r: parsed.r });
  }
  return { header: first.header, rows, tableCounts };
}

export const backupStats = { sql };
