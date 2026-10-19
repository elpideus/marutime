import { hashPassword } from '@marutime/auth';
import { LIMITS } from '@marutime/config';
import { eq, sql, users, type DbExecutor, type User } from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { getSettings } from '../settings';
import { parseInput } from '../utils';
import { displayNameSchema, emailSchema, passwordSchema, usernameSchema } from '../validation';
import { isUsernameTaken } from './username';

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
  ageConfirmed: z.literal(true, { error: `You must be at least ${LIMITS.minimumAge} to join` }),
  termsAccepted: z.literal(true, { error: 'You need to accept the terms and privacy policy' }),
});

export type RegisterInput = z.input<typeof registerSchema>;

export async function findUserByEmail(db: DbExecutor, email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserByUsername(db: DbExecutor, username: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

export async function findUserById(db: DbExecutor, id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function registerUser(db: DbExecutor, rawInput: RegisterInput, opts: { asAdmin?: boolean } = {}): Promise<User> {
  const input = parseInput(registerSchema, rawInput);
  const settings = await getSettings(db);
  if (!settings['site.registrationOpen'] && !opts.asAdmin) {
    throw errors.forbidden('Registration is currently closed');
  }
  if (await findUserByEmail(db, input.email)) throw errors.conflict('An account with this email already exists');
  if (await isUsernameTaken(db, input.username)) throw errors.conflict('That username is taken');

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      username: input.username,
      displayName: input.displayName?.trim() || input.username,
      passwordHash,
      role: opts.asAdmin ? 'admin' : 'user',
      ageConfirmedAt: now,
      termsAcceptedAt: now,
      emailVerifiedAt: settings['site.requireEmailVerification'] && !opts.asAdmin ? null : now,
    })
    .returning();
  return user!;
}
