import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type Database = PostgresJsDatabase<typeof schema>;
export type DbTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Either a database handle or a transaction: all services accept both. */
export type DbExecutor = Database | DbTransaction;

export type CreateDbOptions = {
  url: string;
  max?: number;
  /** Disable prepared statements when behind PgBouncer / Neon pooler. */
  prepare?: boolean;
  debug?: boolean;
};

export function createDb(opts: CreateDbOptions): { db: Database; sql: postgres.Sql } {
  const sql = postgres(opts.url, {
    max: opts.max ?? 10,
    prepare: opts.prepare ?? false,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    debug: opts.debug,
  });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { db, sql };
}

type GlobalWithDb = typeof globalThis & {
  __marutimeDb?: { db: Database; sql: postgres.Sql; url: string };
};

/**
 * Process-wide singleton. Reused across hot reloads in development and across
 * warm invocations on serverless platforms.
 */
export function getDb(): Database {
  const g = globalThis as GlobalWithDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (g.__marutimeDb && g.__marutimeDb.url === url) return g.__marutimeDb.db;
  const max = process.env.DATABASE_POOL_MAX
    ? Number(process.env.DATABASE_POOL_MAX)
    : process.env.VERCEL
      ? 3
      : 10;
  const created = createDb({ url, max });
  g.__marutimeDb = { ...created, url };
  return created.db;
}

export async function closeDb(): Promise<void> {
  const g = globalThis as GlobalWithDb;
  if (g.__marutimeDb) {
    await g.__marutimeDb.sql.end({ timeout: 5 });
    g.__marutimeDb = undefined;
  }
}
