import type { Database } from '@marutime/db';
import { getTableColumns, getTableName, sql } from 'drizzle-orm';
import { parseBackup } from './backup';
import { BACKUP_TABLES, tableByName } from './tables';

export type RestoreOptions = {
  /** Wipe existing data first (default true). Without it, rows are inserted with ON CONFLICT DO NOTHING. */
  truncate?: boolean;
  log?: (message: string) => void;
};

function reviveRow(table: (typeof BACKUP_TABLES)[number], row: Record<string, unknown>): Record<string, unknown> {
  const columns = getTableColumns(table);
  const out: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(columns)) {
    if (!(key in row)) continue;
    const value = row[key];
    out[key] = column.dataType === 'date' && typeof value === 'string' ? new Date(value) : value;
  }
  return out;
}

/**
 * Restore a logical backup. Runs inside one transaction so a failure leaves
 * the database untouched. Requires the schema to already be migrated.
 */
export async function restoreBackup(db: Database, data: Uint8Array, opts: RestoreOptions = {}): Promise<{ inserted: Record<string, number> }> {
  const log = opts.log ?? (() => {});
  const { header, rows } = parseBackup(data);
  log(`Backup from ${header.createdAt} (format v${header.version}, ${rows.length} rows)`);
  const byTable = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const arr = byTable.get(r.t) ?? [];
    arr.push(r.r);
    byTable.set(r.t, arr);
  }
  const inserted: Record<string, number> = {};
  await db.transaction(async (tx) => {
    if (opts.truncate !== false) {
      const names = BACKUP_TABLES.map((t) => `"${getTableName(t)}"`).join(', ');
      await tx.execute(sql.raw(`TRUNCATE TABLE ${names} CASCADE`));
      log('Existing data truncated');
    }
    for (const table of BACKUP_TABLES) {
      const name = getTableName(table);
      const tableRows = byTable.get(name) ?? [];
      if (tableRows.length === 0) continue;
      const target = tableByName(name)!;
      // Self-referencing comments must be inserted parents-first.
      if (name === 'comments') tableRows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      let n = 0;
      for (let i = 0; i < tableRows.length; i += 500) {
        const batch = tableRows.slice(i, i + 500).map((r) => reviveRow(target, r));
        const q = tx.insert(target).values(batch as never);
        if (opts.truncate === false) await q.onConflictDoNothing();
        else await q;
        n += batch.length;
      }
      inserted[name] = n;
      log(`${name}: ${n} rows`);
    }
    // Reset sequences for serial primary keys so new rows do not collide.
    for (const seqTable of ['media', 'seasons', 'episodes', 'characters', 'devices', 'services', 'login_attempts']) {
      await tx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${seqTable}"', 'id'), COALESCE((SELECT MAX(id) FROM "${seqTable}"), 0) + 1, false)`));
    }
  });
  return { inserted };
}
