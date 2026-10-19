import { hashPassword, invalidateAllUserSessions } from '@marutime/auth';
import { USER_ROLES, type UserRole } from '@marutime/config';
import { and, count, desc, eq, ilike, ne, or, sql, users, type DbExecutor, type User } from '@marutime/db';
import { errors } from '../errors';
import { parseInput } from '../utils';
import { passwordSchema } from '../validation';
import { logAudit } from './audit';

export type AdminUserRow = User & { watchCount: number; commentCount: number; listCount: number };

export async function listUsersAdmin(db: DbExecutor, opts: { q?: string; role?: UserRole | 'all'; status?: User['status'] | 'all'; page?: number; limit?: number } = {}): Promise<{ items: AdminUserRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 25, 100);
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const where = and(
    q ? or(ilike(users.username, `%${q}%`), ilike(users.displayName, `%${q}%`), ilike(users.email, `%${q}%`)) : undefined,
    opts.role && opts.role !== 'all' ? eq(users.role, opts.role) : undefined,
    opts.status && opts.status !== 'all' ? eq(users.status, opts.status) : undefined,
  );
  const [total] = await db.select({ n: count() }).from(users).where(where);
  const rows = await db
    .select({
      user: users,
      watchCount: sql<number>`(select count(*) from watches w where w.user_id = users.id)::int`,
      commentCount: sql<number>`(select count(*) from comments c where c.user_id = users.id)::int`,
      listCount: sql<number>`(select count(*) from lists l where l.owner_id = users.id)::int`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  return { items: rows.map((r) => ({ ...r.user, watchCount: Number(r.watchCount), commentCount: Number(r.commentCount), listCount: Number(r.listCount) })), total: total?.n ?? 0 };
}

function assertAdmin(actor: User): void {
  if (actor.role !== 'admin') throw errors.forbidden('Admin access required');
}

export async function setUserRole(db: DbExecutor, actor: User, userId: string, role: UserRole, ip?: string | null): Promise<void> {
  assertAdmin(actor);
  if (!USER_ROLES.includes(role)) throw errors.validation('Unknown role');
  if (actor.id === userId && role !== 'admin') {
    const [others] = await db.select({ n: count() }).from(users).where(and(eq(users.role, 'admin'), ne(users.id, actor.id), eq(users.status, 'active')));
    if ((others?.n ?? 0) === 0) throw errors.validation('You are the only admin; promote someone else first');
  }
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  await logAudit(db, { actorId: actor.id, action: 'user.role', targetType: 'user', targetId: userId, meta: { role }, ip });
}

export async function suspendUser(db: DbExecutor, actor: User, userId: string, reason: string | null, ip?: string | null): Promise<void> {
  if (actor.role === 'user') throw errors.forbidden();
  if (actor.id === userId) throw errors.validation('You cannot suspend yourself');
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw errors.notFound('User');
  if (target.role === 'admin' && actor.role !== 'admin') throw errors.forbidden('Only admins can suspend admins');
  await db.update(users).set({ status: 'suspended', suspendedReason: reason, updatedAt: new Date() }).where(eq(users.id, userId));
  await invalidateAllUserSessions(db, userId);
  await logAudit(db, { actorId: actor.id, action: 'user.suspend', targetType: 'user', targetId: userId, meta: { reason }, ip });
}

export async function unsuspendUser(db: DbExecutor, actor: User, userId: string, ip?: string | null): Promise<void> {
  if (actor.role === 'user') throw errors.forbidden();
  await db.update(users).set({ status: 'active', suspendedReason: null, updatedAt: new Date() }).where(eq(users.id, userId));
  await logAudit(db, { actorId: actor.id, action: 'user.unsuspend', targetType: 'user', targetId: userId, ip });
}

/** Set a temporary password when email delivery is not configured. */
export async function adminSetPassword(db: DbExecutor, actor: User, userId: string, rawPassword: string, ip?: string | null): Promise<void> {
  assertAdmin(actor);
  const password = parseInput(passwordSchema, rawPassword);
  await db.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, userId));
  await invalidateAllUserSessions(db, userId);
  await logAudit(db, { actorId: actor.id, action: 'user.password_reset', targetType: 'user', targetId: userId, ip });
}

export async function verifyUserEmailAdmin(db: DbExecutor, actor: User, userId: string): Promise<void> {
  assertAdmin(actor);
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  await logAudit(db, { actorId: actor.id, action: 'user.verify_email', targetType: 'user', targetId: userId });
}
