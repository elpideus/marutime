import { and, cacheEntries, eq, getDb, like, lt, sql, type Database } from '@marutime/db';

/**
 * Two-tier read-through cache with stale-while-revalidate.
 *
 *  L1  in-process memory (LRU). Free and instant; lives as long as the server
 *      instance (warm serverless functions included).
 *  L2  the `cache_entries` table. Shared by every instance and survives
 *      deploys and cold starts, so a slow upstream call happens once.
 *
 * A value is "fresh" for `ttl` seconds and then "stale" for `staleTtl` more:
 * stale values are returned immediately while a single background refresh
 * runs (de-duplicated in-process and leased across instances). Concurrent
 * misses for the same key share one in-flight promise.
 */

export type CacheOptions = {
  /** Seconds the value is fresh. */
  ttl: number;
  /** Extra seconds a stale value may be served while it refreshes. Default: 4 × ttl. */
  staleTtl?: number;
  /** Also store in Postgres so every instance shares it. Values must be JSON-safe. */
  persist?: boolean;
  /** Relative memory weight for the LRU (e.g. array length). Default 1. */
  weight?: number;
  /** Cache `null`/`undefined` results too, for this many seconds (negative caching). */
  nullTtl?: number;
};

type Entry = { value: unknown; freshUntil: number; staleUntil: number; weight: number };

export type BackgroundRunner = (task: () => Promise<void>) => void;

type CacheState = {
  memory: Map<string, Entry>;
  weight: number;
  inflight: Map<string, Promise<unknown>>;
  refreshing: Set<string>;
  runner: BackgroundRunner | null;
};

// Kept on globalThis so every bundle (pages, route handlers, instrumentation)
// and every dev hot reload shares one cache per server process.
const g = globalThis as typeof globalThis & { __marutimeCache?: CacheState };
const state: CacheState = (g.__marutimeCache ??= { memory: new Map(), weight: 0, inflight: new Map(), refreshing: new Set(), runner: null });
const { memory, inflight, refreshing } = state;

const MAX_WEIGHT = 40_000;

function memGet(key: string): Entry | undefined {
  const e = memory.get(key);
  if (!e) return undefined;
  if (e.staleUntil <= Date.now()) {
    memDelete(key);
    return undefined;
  }
  // Re-insert to mark as most recently used.
  memory.delete(key);
  memory.set(key, e);
  return e;
}

function memDelete(key: string): void {
  const e = memory.get(key);
  if (!e) return;
  memory.delete(key);
  state.weight -= e.weight;
}

function memSet(key: string, entry: Entry): void {
  memDelete(key);
  memory.set(key, entry);
  state.weight += entry.weight;
  for (const k of memory.keys()) {
    if (state.weight <= MAX_WEIGHT) break;
    memDelete(k);
  }
}

function weightOf(value: unknown, explicit?: number): number {
  if (explicit) return explicit;
  if (Array.isArray(value)) return Math.max(1, value.length);
  return 1;
}

/* ---------------------------- Background work ---------------------------- */

function detached(task: () => Promise<void>): void {
  void task().catch((err) => console.warn('[cache] background task failed:', (err as Error).message));
}

/**
 * Let the host decide how to keep work alive after a response is sent (e.g.
 * Next.js `after()` / Vercel `waitUntil`). Defaults to fire-and-forget.
 */
export function setBackgroundRunner(next: BackgroundRunner): void {
  state.runner = next;
}

export function runInBackground(task: () => Promise<void>): void {
  const safe = async () => {
    try {
      await task();
    } catch (err) {
      console.warn('[cache] background task failed:', (err as Error).message);
    }
  };
  try {
    (state.runner ?? detached)(safe);
  } catch {
    detached(safe);
  }
}

/* ------------------------------- L2 (Postgres) ------------------------------- */

function l2(): Database | null {
  try {
    return getDb();
  } catch {
    return null;
  }
}

async function l2Get(key: string): Promise<Entry | null> {
  const db = l2();
  if (!db) return null;
  try {
    const [row] = await db.select().from(cacheEntries).where(and(eq(cacheEntries.key, key), sql`${cacheEntries.staleUntil} > now()`)).limit(1);
    if (!row) return null;
    return { value: row.value, freshUntil: row.freshUntil.getTime(), staleUntil: row.staleUntil.getTime(), weight: weightOf(row.value) };
  } catch (err) {
    console.warn('[cache] read failed:', (err as Error).message);
    return null;
  }
}

async function l2Set(key: string, entry: Entry): Promise<void> {
  const db = l2();
  if (!db) return;
  try {
    const values = { key, value: entry.value ?? null, freshUntil: new Date(entry.freshUntil), staleUntil: new Date(entry.staleUntil), updatedAt: new Date() };
    await db.insert(cacheEntries).values(values).onConflictDoUpdate({ target: cacheEntries.key, set: values });
  } catch (err) {
    console.warn('[cache] write failed:', (err as Error).message);
  }
}

/**
 * Try to take a short exclusive lease (e.g. "only one instance re-syncs this
 * show"). Returns true when this caller owns it. Without a database the lease
 * is granted so work still happens.
 */
export async function acquireLease(name: string, seconds: number, opts: { force?: boolean } = {}): Promise<boolean> {
  const db = l2();
  if (!db) return true;
  const key = `lease:${name}`;
  const until = new Date(Date.now() + seconds * 1000);
  try {
    const rows = await db
      .insert(cacheEntries)
      .values({ key, value: true, freshUntil: until, staleUntil: until })
      .onConflictDoUpdate({
        target: cacheEntries.key,
        set: { value: true, freshUntil: until, staleUntil: until, updatedAt: new Date() },
        // `force` (re)starts the lease unconditionally, e.g. "a full sync just happened".
        setWhere: opts.force ? undefined : lt(cacheEntries.staleUntil, new Date()),
      })
      .returning({ key: cacheEntries.key });
    return rows.length > 0;
  } catch {
    return true;
  }
}

export async function releaseLease(name: string): Promise<void> {
  const db = l2();
  if (!db) return;
  await db.delete(cacheEntries).where(eq(cacheEntries.key, `lease:${name}`)).catch(() => {});
}

/* --------------------------------- Public API --------------------------------- */

function makeEntry(value: unknown, opts: CacheOptions): Entry {
  const now = Date.now();
  const empty = value === null || value === undefined;
  const ttl = empty && opts.nullTtl !== undefined ? opts.nullTtl : opts.ttl;
  const stale = empty && opts.nullTtl !== undefined ? 0 : (opts.staleTtl ?? opts.ttl * 4);
  return { value, freshUntil: now + ttl * 1000, staleUntil: now + (ttl + stale) * 1000, weight: weightOf(value, opts.weight) };
}

function shouldStore(value: unknown, opts: CacheOptions): boolean {
  return (value !== null && value !== undefined) || opts.nullTtl !== undefined;
}

async function load<T>(key: string, opts: CacheOptions, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      const value = await fn();
      if (shouldStore(value, opts)) {
        const entry = makeEntry(value, opts);
        memSet(key, entry);
        if (opts.persist) await l2Set(key, entry);
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function revalidate<T>(key: string, opts: CacheOptions, fn: () => Promise<T>): void {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  runInBackground(async () => {
    try {
      if (!opts.persist) {
        await load(key, opts, fn);
        return;
      }
      // Another instance may already have refreshed the shared copy.
      const shared = await l2Get(key);
      if (shared && shared.freshUntil > Date.now()) {
        memSet(key, shared);
        return;
      }
      const lease = `cache:${key}`;
      if (!(await acquireLease(lease, 60))) return;
      try {
        await load(key, opts, fn);
      } finally {
        await releaseLease(lease);
      }
    } finally {
      refreshing.delete(key);
    }
  });
}

/**
 * Read-through cache. `fn` runs on a miss; a stale hit returns immediately and
 * refreshes in the background. If a refresh fails, the stale value keeps being
 * served until it fully expires.
 */
export async function cached<T>(key: string, opts: CacheOptions, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  let entry = memGet(key);
  if (!entry && opts.persist) {
    const fromDb = await l2Get(key);
    if (fromDb) {
      memSet(key, fromDb);
      entry = fromDb;
    }
  }
  if (entry) {
    if (entry.freshUntil <= now) revalidate(key, opts, fn);
    return entry.value as T;
  }
  return load(key, opts, fn);
}

/** Drop a key (or every key starting with `prefix*`) from both tiers. */
export async function invalidateCache(keyOrPrefix: string): Promise<void> {
  const isPrefix = keyOrPrefix.endsWith('*');
  const base = isPrefix ? keyOrPrefix.slice(0, -1) : keyOrPrefix;
  for (const k of Array.from(memory.keys())) if (isPrefix ? k.startsWith(base) : k === base) memDelete(k);
  const db = l2();
  if (!db) return;
  await db
    .delete(cacheEntries)
    .where(isPrefix ? like(cacheEntries.key, `${base.replace(/[%_\\]/g, '\\$&')}%`) : eq(cacheEntries.key, base))
    .catch(() => {});
}

/** Remove fully expired rows (daily cron). */
export async function pruneCache(db: Database = getDb()): Promise<number> {
  const rows = await db.delete(cacheEntries).where(lt(cacheEntries.staleUntil, new Date())).returning({ key: cacheEntries.key });
  return rows.length;
}

export function cacheStats(): { entries: number; weight: number; inflight: number } {
  return { entries: memory.size, weight: state.weight, inflight: inflight.size };
}

/** Handy TTLs in seconds. */
export const TTL = { minute: 60, hour: 60 * 60, day: 24 * 60 * 60, week: 7 * 24 * 60 * 60 } as const;
