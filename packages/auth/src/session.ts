import { SESSION_COOKIE, SESSION_TTL_DAYS, getEnv } from '@marutime/config';
import { and, eq, gt, lt, ne, sessions, users, type DbExecutor, type Session, type User } from '@marutime/db';
import { hashIp, randomToken, sha256 } from './crypto';

const DAY = 24 * 60 * 60 * 1000;
const RENEW_THRESHOLD = 15 * DAY;
const TOUCH_INTERVAL = 60 * 60 * 1000;

export type SessionMeta = { userAgent?: string | null; ip?: string | null };

export type SessionValidationResult = { session: Session; user: User } | null;

export async function createSession(db: DbExecutor, userId: string, meta: SessionMeta = {}): Promise<{ token: string; session: Session }> {
  const token = randomToken(32);
  const [session] = await db
    .insert(sessions)
    .values({
      tokenHash: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * DAY),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ipHash: hashIp(meta.ip),
    })
    .returning();
  return { token, session: session! };
}

/**
 * Validate a raw session token. Extends the session when it is past the
 * halfway point so active users are never logged out.
 */
export async function validateSession(db: DbExecutor, token: string | null | undefined): Promise<SessionValidationResult> {
  if (!token || token.length < 20) return null;
  const now = new Date();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.user.deletedAt || row.user.status === 'deleted') return null;

  const updates: Partial<typeof sessions.$inferInsert> = {};
  if (row.session.expiresAt.getTime() - now.getTime() < RENEW_THRESHOLD) {
    updates.expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * DAY);
  }
  if (now.getTime() - row.session.lastUsedAt.getTime() > TOUCH_INTERVAL) {
    updates.lastUsedAt = now;
  }
  if (Object.keys(updates).length > 0) {
    await db.update(sessions).set(updates).where(eq(sessions.id, row.session.id));
    Object.assign(row.session, updates);
    await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, row.user.id));
  }
  return row;
}

export async function invalidateSession(db: DbExecutor, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function invalidateSessionById(db: DbExecutor, sessionId: string, userId: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
}

export async function invalidateAllUserSessions(db: DbExecutor, userId: string, exceptSessionId?: string): Promise<void> {
  if (exceptSessionId) {
    await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)));
  } else {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

export async function listUserSessions(db: DbExecutor, userId: string): Promise<Session[]> {
  return db.select().from(sessions).where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())));
}

export async function purgeExpiredSessions(db: DbExecutor): Promise<number> {
  const deleted = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  return deleted.length;
}

export type CookieAttributes = {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
};

export function sessionCookie(token: string): CookieAttributes {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: getEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

export function clearedSessionCookie(): CookieAttributes {
  return { ...sessionCookie(''), maxAge: 0 };
}
