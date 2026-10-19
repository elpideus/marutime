import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotenv } from '@marutime/config/dotenv';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from '../client';

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv();

export async function runMigrations(url = process.env.DATABASE_URL): Promise<void> {
  if (!url) throw new Error('DATABASE_URL is not set');
  const { db, sql } = createDb({ url, max: 1 });
  try {
    await migrate(db, { migrationsFolder: path.resolve(here, '../../drizzle') });
    console.log('✔ migrations applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
