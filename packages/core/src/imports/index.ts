import { and, desc, eq, importJobs, inArray, type DbExecutor, type ImportJob, type ImportJobStats, type ImportSource, type User } from '@marutime/db';
import { acquireLease, releaseLease } from '../cache';
import { errors } from '../errors';
import { importItemsSchema, type ImportItem } from '../import-format';
import { getProvider } from '../media/provider';
import { createNotification } from '../social/notifications';
import { parseInput } from '../utils';
import { applyItem, noteUnmatched, type ApplyContext } from './apply';

export { buildAniListImport } from './anilist';

export type ImportJobView = Pick<ImportJob, 'id' | 'source' | 'label' | 'status' | 'cursor' | 'total' | 'stats' | 'error' | 'createdAt' | 'updatedAt' | 'finishedAt'>;

const ACTIVE = ['pending', 'running'] as const;

function view(j: ImportJob): ImportJobView {
  return { id: j.id, source: j.source, label: j.label, status: j.status, cursor: j.cursor, total: j.total, stats: j.stats, error: j.error, createdAt: j.createdAt, updatedAt: j.updatedAt, finishedAt: j.finishedAt };
}

const emptyStats = (): ImportJobStats => ({ shows: 0, movies: 0, watches: 0, watchlist: 0, lists: 0, skippedEpisodes: 0, unmatched: [] });

/** Queue an import. One at a time per user; items are validated here whatever produced them. */
export async function createImportJob(db: DbExecutor, user: User, input: { source: ImportSource; label: string; items: unknown }): Promise<ImportJobView> {
  const items = parseInput(importItemsSchema, input.items);
  const [active] = await db
    .select({ id: importJobs.id })
    .from(importJobs)
    .where(and(eq(importJobs.userId, user.id), inArray(importJobs.status, [...ACTIVE])))
    .limit(1);
  if (active) throw errors.conflict('An import is already in progress. Let it finish or cancel it first.');
  // Titles first, then lists, which point at them.
  const ordered = [...items.filter((i) => i.kind !== 'list'), ...items.filter((i) => i.kind === 'list')];
  const [row] = await db
    .insert(importJobs)
    .values({ userId: user.id, source: input.source, label: input.label.slice(0, 120), payload: ordered, total: ordered.length, stats: emptyStats() })
    .returning();
  return view(row!);
}

export async function listImportJobs(db: DbExecutor, userId: string, limit = 5): Promise<ImportJobView[]> {
  const rows = await db.select().from(importJobs).where(eq(importJobs.userId, userId)).orderBy(desc(importJobs.createdAt)).limit(limit);
  return rows.map(view);
}

async function getRow(db: DbExecutor, userId: string, id: string): Promise<ImportJob> {
  const [row] = await db.select().from(importJobs).where(and(eq(importJobs.id, id), eq(importJobs.userId, userId))).limit(1);
  if (!row) throw errors.notFound('Import');
  return row;
}

export async function getImportJob(db: DbExecutor, userId: string, id: string): Promise<ImportJobView> {
  return view(await getRow(db, userId, id));
}

/** Stop an import. What was already imported stays. */
export async function cancelImportJob(db: DbExecutor, userId: string, id: string): Promise<ImportJobView> {
  const [row] = await db
    .update(importJobs)
    .set({ status: 'cancelled', payload: null, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(importJobs.id, id), eq(importJobs.userId, userId), inArray(importJobs.status, [...ACTIVE])))
    .returning();
  return row ? view(row) : getImportJob(db, userId, id);
}

/**
 * Work through as much of an import as fits in `budgetMs`, saving progress
 * after every batch. Callers keep calling until it reports completion; a
 * second caller for the same job while one is working just gets the status.
 */
export async function runImportStep(db: DbExecutor, user: User, id: string, opts: { budgetMs?: number; concurrency?: number } = {}): Promise<ImportJobView> {
  const budgetMs = opts.budgetMs ?? 20_000;
  const concurrency = opts.concurrency ?? 4;
  let job = await getRow(db, user.id, id);
  if (!ACTIVE.includes(job.status as (typeof ACTIVE)[number])) return view(job);
  const lease = `import:${id}`;
  if (!(await acquireLease(lease, Math.ceil(budgetMs / 1000) + 90))) return view(job);
  try {
    const items = (job.payload ?? []) as ImportItem[];
    const ctx: ApplyContext = { db, user, provider: getProvider(), stats: job.stats, resolved: job.resolved, enrichBudget: 6, now: new Date() };
    let cursor = job.cursor;
    const started = Date.now();
    while (cursor < items.length && Date.now() - started < budgetMs) {
      // Lists run on their own, after every title they might point at is in.
      const isList = items[cursor]!.kind === 'list';
      let end = cursor;
      while (end < items.length && end - cursor < (isList ? 1 : concurrency) && (items[end]!.kind === 'list') === isList) end++;
      await Promise.all(
        items.slice(cursor, end).map((item) =>
          applyItem(ctx, item).catch((err: unknown) => {
            console.warn(`[import] ${item.kind} "${'title' in item ? item.title : ''}" failed:`, (err as Error).message);
            if (item.kind !== 'list') noteUnmatched(ctx, item.kind, item.title, 'Could not be imported');
          }),
        ),
      );
      cursor = end;
      const [saved] = await db
        .update(importJobs)
        .set({ cursor, stats: ctx.stats, resolved: ctx.resolved, status: 'running', error: null, updatedAt: new Date() })
        .where(and(eq(importJobs.id, id), inArray(importJobs.status, [...ACTIVE])))
        .returning();
      if (!saved) return getImportJob(db, user.id, id); // cancelled meanwhile
      job = saved;
    }
    if (cursor >= items.length) {
      const [done] = await db
        .update(importJobs)
        .set({ status: 'completed', payload: null, finishedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(importJobs.id, id), inArray(importJobs.status, [...ACTIVE])))
        .returning();
      if (done) {
        job = done;
        const s = done.stats;
        await createNotification(db, {
          userId: user.id,
          type: 'system',
          payload: { message: `${done.label} import finished: ${s.shows} shows, ${s.movies} movies and ${s.watches.toLocaleString('en')} viewings added.`, href: '/settings/data' },
        });
      }
    }
    return view(job);
  } catch (err) {
    // Keep the job resumable: progress up to the last batch is saved, and the next step picks up from there.
    console.error('[import] step failed:', err);
    const [saved] = await db.update(importJobs).set({ error: (err as Error).message.slice(0, 500), updatedAt: new Date() }).where(eq(importJobs.id, id)).returning();
    return view(saved ?? job);
  } finally {
    await releaseLease(lease);
  }
}
