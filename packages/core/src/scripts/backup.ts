import { loadDotenv } from '@marutime/config/dotenv';
loadDotenv();

import { closeDb, getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { writeFile } from 'node:fs/promises';
import { buildBackupPayload, pruneBackups, runBackup } from '../backup';

/**
 * Usage:
 *   pnpm backup                 upload a manual backup to the configured storage
 *   pnpm backup --out file.gz   write the backup to a local file instead
 *   pnpm backup --prune         also delete backups past the retention window
 */
async function main(): Promise<void> {
  const db = getDb();
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0) {
    const file = args[outIdx + 1];
    if (!file) throw new Error('--out requires a path');
    const { data, tableCounts } = await buildBackupPayload(db);
    await writeFile(file, data);
    console.log(`✔ wrote ${file} (${data.byteLength} bytes)`, tableCounts);
  } else {
    const storage = getStorage();
    const result = await runBackup(db, storage, { kind: 'manual' });
    if (result.status !== 'completed') throw new Error(`Backup failed: ${result.error}`);
    console.log(`✔ backup ${result.id} → ${result.storageKey} (${result.sizeBytes} bytes)`);
    if (args.includes('--prune')) console.log(`✔ pruned ${await pruneBackups(db, storage)} old backups`);
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
