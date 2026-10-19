import { loadDotenv } from '@marutime/config/dotenv';
loadDotenv();

import { getEnv } from '@marutime/config';
import { closeDb, getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { readFile } from 'node:fs/promises';
import { decryptBackup, getBackup, isEncryptedBackup, readBackup, restoreBackup } from '../backup';

/**
 * Usage:
 *   pnpm restore --file backup.ndjson.gz [--yes]
 *   pnpm restore --id <backup uuid> [--yes]
 * Restoring wipes the current data. Pass --yes to confirm.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.includes('--yes')) {
    console.error('Refusing to restore without --yes (this replaces ALL current data).');
    process.exit(2);
  }
  const db = getDb();
  let data: Uint8Array | null = null;
  const fileIdx = args.indexOf('--file');
  const idIdx = args.indexOf('--id');
  if (fileIdx >= 0) {
    const raw = new Uint8Array(await readFile(args[fileIdx + 1]!));
    if (isEncryptedBackup(raw)) {
      const key = getEnv().BACKUP_ENCRYPTION_KEY;
      if (!key) throw new Error('Backup is encrypted; set BACKUP_ENCRYPTION_KEY');
      data = decryptBackup(raw, key);
    } else data = raw;
  } else if (idIdx >= 0) {
    const backup = await getBackup(db, args[idIdx + 1]!);
    if (!backup) throw new Error('Backup not found');
    data = await readBackup(getStorage(), backup);
  } else {
    throw new Error('Pass --file <path> or --id <backup id>');
  }
  if (!data) throw new Error('Could not read backup data');
  const { inserted } = await restoreBackup(db, data, { log: (m) => console.log(m) });
  console.log('✔ restore complete', inserted);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
