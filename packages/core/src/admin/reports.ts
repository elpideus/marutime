import { and, comments, count, desc, eq, lists, publicUserColumns, reports, sql, users, type DbExecutor, type Report, type User, alias, type PublicUser } from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { getSettings } from '../settings';
import { parseInput } from '../utils';
import { logAudit } from './audit';

export const reportSchema = z.object({
  targetType: z.enum(['comment', 'list', 'user']),
  targetId: z.string().min(1).max(64),
  reason: z.enum(['spam', 'harassment', 'unmarked_spoiler', 'nsfw', 'illegal', 'other']),
  details: z.string().trim().max(1000).optional(),
});

export type ReportInput = z.input<typeof reportSchema>;

export async function reportContent(db: DbExecutor, reporter: User, rawInput: ReportInput): Promise<Report> {
  const input = parseInput(reportSchema, rawInput);
  const dupe = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.reporterId, reporter.id), eq(reports.targetType, input.targetType), eq(reports.targetId, input.targetId), eq(reports.status, 'open')))
    .limit(1);
  if (dupe[0]) throw errors.conflict('You already reported this. Thanks for keeping MaruTime safe.');
  const [row] = await db.insert(reports).values({ reporterId: reporter.id, ...input, details: input.details || null }).returning();

  // Auto-hide comments that attract many open reports until a moderator reviews them.
  if (input.targetType === 'comment') {
    const settings = await getSettings(db);
    const [n] = await db.select({ n: count() }).from(reports).where(and(eq(reports.targetType, 'comment'), eq(reports.targetId, input.targetId), eq(reports.status, 'open')));
    if ((n?.n ?? 0) >= settings['moderation.autoHideReports']) {
      await db.update(comments).set({ hiddenAt: new Date(), hiddenReason: 'auto-hidden pending review' }).where(and(eq(comments.id, input.targetId), sql`${comments.hiddenAt} is null`));
    }
  }
  return row!;
}

const reporterAlias = alias(users, 'reporter');

export type ReportView = { report: Report; reporter: PublicUser | null; preview: string | null };

export async function listReports(db: DbExecutor, opts: { status?: Report['status'] | 'all'; limit?: number } = {}): Promise<ReportView[]> {
  const rows = await db
    .select({ report: reports, reporter: { id: reporterAlias.id, username: reporterAlias.username, displayName: reporterAlias.displayName, avatarUrl: reporterAlias.avatarUrl } })
    .from(reports)
    .leftJoin(reporterAlias, eq(reports.reporterId, reporterAlias.id))
    .where(opts.status && opts.status !== 'all' ? eq(reports.status, opts.status) : undefined)
    .orderBy(desc(reports.createdAt))
    .limit(opts.limit ?? 100);
  const out: ReportView[] = [];
  for (const r of rows) {
    let preview: string | null = null;
    if (r.report.targetType === 'comment') {
      const [c] = await db.select({ body: comments.body }).from(comments).where(eq(comments.id, r.report.targetId)).limit(1);
      preview = c?.body.slice(0, 200) ?? '[deleted]';
    } else if (r.report.targetType === 'list') {
      const [l] = await db.select({ title: lists.title }).from(lists).where(eq(lists.id, r.report.targetId)).limit(1);
      preview = l?.title ?? '[deleted]';
    } else {
      const [u] = await db.select(publicUserColumns).from(users).where(eq(users.id, r.report.targetId)).limit(1);
      preview = u ? `@${u.username}` : '[deleted]';
    }
    out.push({ report: r.report, reporter: r.reporter && r.reporter.id ? (r.reporter as unknown as PublicUser) : null, preview });
  }
  return out;
}

export async function resolveReport(db: DbExecutor, actor: User, reportId: string, status: 'resolved' | 'dismissed', note?: string): Promise<void> {
  if (actor.role === 'user') throw errors.forbidden();
  await db.update(reports).set({ status, resolvedById: actor.id, resolvedAt: new Date(), resolutionNote: note ?? null }).where(eq(reports.id, reportId));
  await logAudit(db, { actorId: actor.id, action: `report.${status}`, targetType: 'report', targetId: reportId, meta: { note: note ?? null } });
}

export async function countOpenReports(db: DbExecutor): Promise<number> {
  const [row] = await db.select({ n: count() }).from(reports).where(eq(reports.status, 'open'));
  return row?.n ?? 0;
}
