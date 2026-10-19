import { isLoginBlocked, recordLoginAttempt, verifyPassword } from '@marutime/auth';
import { type DbExecutor, type User } from '@marutime/db';
import { errors } from '../errors';
import { findUserByEmail, findUserByUsername } from './register';

export type LoginInput = { identifier: string; password: string; ip?: string | null };

export async function authenticateWithPassword(db: DbExecutor, input: LoginInput): Promise<User> {
  const identifier = input.identifier.trim().toLowerCase();
  if (!identifier || !input.password) throw errors.validation('Enter your email or username and password');
  if (await isLoginBlocked(db, identifier, input.ip)) throw errors.rateLimited('Too many sign-in attempts. Please wait 15 minutes.');

  const user = identifier.includes('@') ? await findUserByEmail(db, identifier) : await findUserByUsername(db, identifier);
  const ok = user ? await verifyPassword(input.password, user.passwordHash) : false;
  await recordLoginAttempt(db, identifier, ok, input.ip);

  if (!user || !ok) throw errors.unauthorized('Incorrect email/username or password');
  if (user.status === 'suspended') throw errors.forbidden(user.suspendedReason ? `Account suspended: ${user.suspendedReason}` : 'This account is suspended');
  if (user.status === 'deleted' || user.deletedAt) throw errors.unauthorized('This account no longer exists');
  return user;
}
