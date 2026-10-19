import { and, asc, count, desc, devices, eq, ilike, media, or, services, sql, watches, type DbExecutor, type Device, type Media, type Service, type User } from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { ensureMedia } from '../media/sync';
import { parseInput } from '../utils';
import { logAudit } from './audit';

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/, 'Use lowercase letters, numbers and dashes');

export const deviceInputSchema = z.object({
  id: z.number().int().positive().optional(),
  slug: slugSchema,
  name: z.string().trim().min(1).max(40),
  icon: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const serviceInputSchema = z.object({
  id: z.number().int().positive().optional(),
  slug: slugSchema,
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #E50914').nullable().optional(),
  iconUrl: z.string().url().max(400).nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

function assertStaff(actor: User): void {
  if (actor.role === 'user') throw errors.forbidden();
}

export async function upsertDevice(db: DbExecutor, actor: User, rawInput: unknown): Promise<Device> {
  assertStaff(actor);
  const input = parseInput(deviceInputSchema, rawInput);
  const values = { slug: input.slug, name: input.name, icon: input.icon ?? null, sortOrder: input.sortOrder, isActive: input.isActive };
  const [row] = input.id
    ? await db.update(devices).set(values).where(eq(devices.id, input.id)).returning()
    : await db.insert(devices).values(values).onConflictDoUpdate({ target: devices.slug, set: values }).returning();
  if (!row) throw errors.notFound('Device');
  await logAudit(db, { actorId: actor.id, action: 'catalog.device', targetType: 'device', targetId: row.id, meta: values });
  return row;
}

export async function deleteDevice(db: DbExecutor, actor: User, id: number): Promise<void> {
  assertStaff(actor);
  const [used] = await db.select({ n: count() }).from(watches).where(eq(watches.deviceId, id));
  if ((used?.n ?? 0) > 0) {
    await db.update(devices).set({ isActive: false }).where(eq(devices.id, id));
    await logAudit(db, { actorId: actor.id, action: 'catalog.device.deactivate', targetType: 'device', targetId: id });
    return;
  }
  await db.delete(devices).where(eq(devices.id, id));
  await logAudit(db, { actorId: actor.id, action: 'catalog.device.delete', targetType: 'device', targetId: id });
}

export async function upsertService(db: DbExecutor, actor: User, rawInput: unknown): Promise<Service> {
  assertStaff(actor);
  const input = parseInput(serviceInputSchema, rawInput);
  const values = { slug: input.slug, name: input.name, color: input.color ?? null, iconUrl: input.iconUrl ?? null, sortOrder: input.sortOrder, isActive: input.isActive };
  const [row] = input.id
    ? await db.update(services).set(values).where(eq(services.id, input.id)).returning()
    : await db.insert(services).values(values).onConflictDoUpdate({ target: services.slug, set: values }).returning();
  if (!row) throw errors.notFound('Service');
  await logAudit(db, { actorId: actor.id, action: 'catalog.service', targetType: 'service', targetId: row.id, meta: values });
  return row;
}

export async function deleteService(db: DbExecutor, actor: User, id: number): Promise<void> {
  assertStaff(actor);
  const [used] = await db.select({ n: count() }).from(watches).where(eq(watches.serviceId, id));
  if ((used?.n ?? 0) > 0) {
    await db.update(services).set({ isActive: false }).where(eq(services.id, id));
    await logAudit(db, { actorId: actor.id, action: 'catalog.service.deactivate', targetType: 'service', targetId: id });
    return;
  }
  await db.delete(services).where(eq(services.id, id));
  await logAudit(db, { actorId: actor.id, action: 'catalog.service.delete', targetType: 'service', targetId: id });
}

export async function listMediaAdmin(db: DbExecutor, opts: { q?: string; type?: 'show' | 'movie' | 'all'; page?: number; limit?: number } = {}): Promise<{ items: Array<Media & { watchCount: number }>; total: number }> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const where = and(q ? or(ilike(media.title, `%${q}%`), ilike(media.originalTitle, `%${q}%`), sql`${media.externalId}::text = ${q}`) : undefined, opts.type && opts.type !== 'all' ? eq(media.type, opts.type) : undefined);
  const [total] = await db.select({ n: count() }).from(media).where(where);
  const rows = await db
    .select({ media, watchCount: sql<number>`(select count(*) from watches w where w.media_id = media.id)::int` })
    .from(media)
    .where(where)
    .orderBy(desc(media.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return { items: rows.map((r) => ({ ...r.media, watchCount: Number(r.watchCount) })), total: total?.n ?? 0 };
}

export async function resyncMedia(db: DbExecutor, actor: User, mediaId: number): Promise<Media> {
  assertStaff(actor);
  const [row] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!row) throw errors.notFound('Title');
  const updated = await ensureMedia(db, row.type, row.externalId, { force: true });
  await logAudit(db, { actorId: actor.id, action: 'media.resync', targetType: 'media', targetId: mediaId });
  return updated;
}

/** Refresh followed shows that are still airing, oldest sync first (cron job). */
export async function refreshStaleMedia(db: DbExecutor, limit = 25): Promise<{ refreshed: number; failed: number }> {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const rows = await db
    .select({ id: media.id, type: media.type, externalId: media.externalId })
    .from(media)
    .where(and(eq(media.type, 'show'), sql`${media.status} not in ('Ended', 'Canceled')`, or(sql`${media.syncedAt} is null`, sql`${media.syncedAt} < ${cutoff}`), sql`exists(select 1 from show_tracking st where st.media_id = media.id)`))
    .orderBy(asc(media.syncedAt))
    .limit(limit);
  let refreshed = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await ensureMedia(db, r.type, r.externalId, { force: true });
      refreshed++;
    } catch {
      failed++;
    }
  }
  return { refreshed, failed };
}
