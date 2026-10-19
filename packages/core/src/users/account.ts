import { hashPassword, invalidateAllUserSessions, randomToken, sha256, verifyPassword } from '@marutime/auth';
import { getEnv } from '@marutime/config';
import { and, authTokens, eq, gt, isNull, users, type DbExecutor, type User } from '@marutime/db';
import { errors } from '../errors';
import { emailTemplates, getEmailProvider } from '../email';
import { logAudit } from '../admin/audit';
import { parseInput } from '../utils';
import { emailSchema, passwordSchema } from '../validation';
import { findUserByEmail } from './register';

const HOUR = 60 * 60 * 1000;

async function issueToken(db: DbExecutor, userId: string, type: 'email_verify' | 'password_reset' | 'email_change', ttlMs: number, payload?: Record<string, unknown>): Promise<string> {
  const token = randomToken(32);
  await db.insert(authTokens).values({ userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs), payload: payload ?? null });
  return token;
}

async function consumeToken(db: DbExecutor, token: string, type: 'email_verify' | 'password_reset' | 'email_change') {
  const rows = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.type, type), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) throw errors.validation('This link is invalid or has expired');
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id));
  return row;
}

export async function sendEmailVerification(db: DbExecutor, user: User): Promise<void> {
  if (user.emailVerifiedAt) return;
  const token = await issueToken(db, user.id, 'email_verify', 24 * HOUR);
  const url = `${getEnv().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await getEmailProvider().send(emailTemplates.verifyEmail(user.email, url));
}

export async function verifyEmail(db: DbExecutor, token: string): Promise<User> {
  const row = await consumeToken(db, token, 'email_verify');
  const [user] = await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, row.userId)).returning();
  if (!user) throw errors.notFound('User');
  return user;
}

/** Always succeeds from the caller's perspective so it cannot enumerate emails. */
export async function requestPasswordReset(db: DbExecutor, rawEmail: string): Promise<void> {
  const email = parseInput(emailSchema, rawEmail);
  const user = await findUserByEmail(db, email);
  if (!user || user.status !== 'active') return;
  const token = await issueToken(db, user.id, 'password_reset', HOUR);
  const url = `${getEnv().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await getEmailProvider().send(emailTemplates.resetPassword(user.email, url));
}

export async function resetPassword(db: DbExecutor, token: string, rawPassword: string): Promise<User> {
  const password = parseInput(passwordSchema, rawPassword);
  const row = await consumeToken(db, token, 'password_reset');
  const [user] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, row.userId))
    .returning();
  if (!user) throw errors.notFound('User');
  await invalidateAllUserSessions(db, user.id);
  return user;
}

export async function changePassword(db: DbExecutor, user: User, currentPassword: string, rawNewPassword: string, keepSessionId?: string): Promise<void> {
  const newPassword = parseInput(passwordSchema, rawNewPassword);
  if (user.passwordHash && !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw errors.validation('Your current password is incorrect', { currentPassword: ['Incorrect password'] });
  }
  await db.update(users).set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() }).where(eq(users.id, user.id));
  await invalidateAllUserSessions(db, user.id, keepSessionId);
}

export async function requestEmailChange(db: DbExecutor, user: User, rawEmail: string, currentPassword: string): Promise<void> {
  const email = parseInput(emailSchema, rawEmail);
  if (user.passwordHash && !(await verifyPassword(currentPassword, user.passwordHash))) throw errors.validation('Incorrect password');
  if (await findUserByEmail(db, email)) throw errors.conflict('That email is already in use');
  const token = await issueToken(db, user.id, 'email_change', 24 * HOUR, { email });
  const url = `${getEnv().APP_URL}/verify-email?token=${encodeURIComponent(token)}&change=1`;
  await getEmailProvider().send({ ...emailTemplates.verifyEmail(email, url), subject: 'Confirm your new MaruTime email' });
}

export async function confirmEmailChange(db: DbExecutor, token: string): Promise<User> {
  const row = await consumeToken(db, token, 'email_change');
  const email = (row.payload as { email?: string } | null)?.email;
  if (!email) throw errors.validation('Invalid email change request');
  if (await findUserByEmail(db, email)) throw errors.conflict('That email is already in use');
  const [user] = await db.update(users).set({ email, emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, row.userId)).returning();
  if (!user) throw errors.notFound('User');
  return user;
}

/**
 * GDPR Art. 17 erasure: hard-delete the user row. Foreign keys cascade so all
 * personal data (watches, comments, lists, sessions, tokens) disappears too.
 * Uploaded files are removed by the caller through the storage adapter.
 */
export async function deleteAccount(db: DbExecutor, userId: string, opts: { actorId: string | null; reason?: string; ip?: string | null }): Promise<void> {
  await logAudit(db, { actorId: opts.actorId, action: 'user.delete', targetType: 'user', targetId: userId, meta: { reason: opts.reason ?? null }, ip: opts.ip });
  await db.delete(users).where(eq(users.id, userId));
}
