import { and, auditLogs, backups, comments, count, desc, eq, gt, isNull, lists, media, publicUserColumns, reports, sql, users, watches, type AuditLog, type DbExecutor, type PublicUser } from '@marutime/db';

export type AdminOverview = {
  users: { total: number; new7d: number; active7d: number; suspended: number };
  watches: { total: number; last24h: number; last7d: number };
  content: { comments: number; publicLists: number; media: number; openReports: number };
  lastBackup: { at: Date; status: string; sizeBytes: number | null } | null;
  signupsByDay: Array<{ day: string; count: number }>;
  watchesByDay: Array<{ day: string; count: number }>;
  topShows: Array<{ mediaId: number; title: string; posterPath: string | null; externalId: number; slug: string; type: 'show' | 'movie'; watches: number }>;
};

export async function getAdminOverview(db: DbExecutor): Promise<AdminOverview> {
  // Raw `sql` fragments bind Dates without a column mapper, so pass ISO strings explicitly.
  const day7Date = new Date(Date.now() - 7 * 86_400_000);
  const day14Date = new Date(Date.now() - 14 * 86_400_000);
  const day7 = day7Date.toISOString();
  const day1 = new Date(Date.now() - 86_400_000).toISOString();

  const [u] = await db
    .select({
      total: count(),
      new7d: sql<number>`count(*) filter (where ${users.createdAt} > ${day7})::int`,
      active7d: sql<number>`count(*) filter (where ${users.lastSeenAt} > ${day7})::int`,
      suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended')::int`,
    })
    .from(users)
    .where(isNull(users.deletedAt));
  const [w] = await db
    .select({ total: count(), last24h: sql<number>`count(*) filter (where ${watches.createdAt} > ${day1})::int`, last7d: sql<number>`count(*) filter (where ${watches.createdAt} > ${day7})::int` })
    .from(watches);
  const [c] = await db.select({ n: count() }).from(comments).where(isNull(comments.deletedAt));
  const [l] = await db.select({ n: count() }).from(lists).where(and(eq(lists.visibility, 'public'), isNull(lists.deletedAt)));
  const [m] = await db.select({ n: count() }).from(media);
  const [r] = await db.select({ n: count() }).from(reports).where(eq(reports.status, 'open'));
  const [lastBackup] = await db.select().from(backups).orderBy(desc(backups.startedAt)).limit(1);

  const signups = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, n: count() })
    .from(users)
    .where(gt(users.createdAt, day14Date))
    .groupBy(sql`date_trunc('day', ${users.createdAt})`)
    .orderBy(sql`date_trunc('day', ${users.createdAt})`);
  const watchDays = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${watches.createdAt}), 'YYYY-MM-DD')`, n: count() })
    .from(watches)
    .where(gt(watches.createdAt, day14Date))
    .groupBy(sql`date_trunc('day', ${watches.createdAt})`)
    .orderBy(sql`date_trunc('day', ${watches.createdAt})`);
  const topShows = await db
    .select({ mediaId: media.id, title: media.title, posterPath: media.posterPath, externalId: media.externalId, slug: media.slug, type: media.type, watches: count() })
    .from(watches)
    .innerJoin(media, eq(watches.mediaId, media.id))
    .where(gt(watches.createdAt, day7Date))
    .groupBy(media.id)
    .orderBy(desc(count()))
    .limit(8);

  const fill = (rows: Array<{ day: string; n: number }>) => {
    const out: Array<{ day: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ day: d, count: rows.find((r) => r.day === d)?.n ?? 0 });
    }
    return out;
  };

  return {
    users: { total: u?.total ?? 0, new7d: Number(u?.new7d ?? 0), active7d: Number(u?.active7d ?? 0), suspended: Number(u?.suspended ?? 0) },
    watches: { total: w?.total ?? 0, last24h: Number(w?.last24h ?? 0), last7d: Number(w?.last7d ?? 0) },
    content: { comments: c?.n ?? 0, publicLists: l?.n ?? 0, media: m?.n ?? 0, openReports: r?.n ?? 0 },
    lastBackup: lastBackup ? { at: lastBackup.startedAt, status: lastBackup.status, sizeBytes: lastBackup.sizeBytes } : null,
    signupsByDay: fill(signups),
    watchesByDay: fill(watchDays),
    topShows,
  };
}

export type AuditLogView = { log: AuditLog; actor: PublicUser | null };

export async function listAuditLogs(db: DbExecutor, opts: { limit?: number; page?: number } = {}): Promise<AuditLogView[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const page = Math.max(1, opts.page ?? 1);
  const rows = await db
    .select({ log: auditLogs, actor: publicUserColumns })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return rows.map((r) => ({ log: r.log, actor: r.actor && r.actor.id ? (r.actor as PublicUser) : null }));
}
