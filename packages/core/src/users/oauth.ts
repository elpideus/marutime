import type { OAuthProfile } from '@marutime/auth';
import { and, eq, oauthAccounts, users, type DbExecutor, type User } from '@marutime/db';
import { errors } from '../errors';
import { getSettings } from '../settings';
import { findUserByEmail } from './register';
import { suggestUsername } from './username';

/**
 * Resolve an OAuth profile to a local user: existing link → verified-email
 * match → brand new account. Linking by email only happens when the provider
 * verified it, to prevent account takeover.
 */
export async function findOrCreateOAuthUser(db: DbExecutor, profile: OAuthProfile, opts: { linkToUserId?: string } = {}): Promise<{ user: User; created: boolean }> {
  const existing = await db
    .select({ user: users })
    .from(oauthAccounts)
    .innerJoin(users, eq(oauthAccounts.userId, users.id))
    .where(and(eq(oauthAccounts.provider, profile.provider), eq(oauthAccounts.providerUserId, profile.providerUserId)))
    .limit(1);
  if (existing[0]) {
    if (opts.linkToUserId && existing[0].user.id !== opts.linkToUserId) {
      throw errors.conflict('This account is already linked to another MaruTime user');
    }
    return { user: existing[0].user, created: false };
  }

  if (opts.linkToUserId) {
    await db.insert(oauthAccounts).values({ provider: profile.provider, providerUserId: profile.providerUserId, userId: opts.linkToUserId, email: profile.email });
    const [user] = await db.select().from(users).where(eq(users.id, opts.linkToUserId)).limit(1);
    if (!user) throw errors.notFound('User');
    return { user, created: false };
  }

  if (profile.email && profile.emailVerified) {
    const byEmail = await findUserByEmail(db, profile.email);
    if (byEmail) {
      await db.insert(oauthAccounts).values({ provider: profile.provider, providerUserId: profile.providerUserId, userId: byEmail.id, email: profile.email });
      if (!byEmail.emailVerifiedAt) await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, byEmail.id));
      return { user: byEmail, created: false };
    }
  }

  const settings = await getSettings(db);
  if (!settings['site.registrationOpen']) throw errors.forbidden('Registration is currently closed');
  if (!profile.email) throw errors.validation('Your provider did not share an email address. Sign up with email instead.');
  if (await findUserByEmail(db, profile.email)) {
    throw errors.conflict('An account with this email exists. Sign in with your password, then link this provider in settings.');
  }

  const username = await suggestUsername(db, profile.username ?? profile.name ?? profile.email);
  const now = new Date();
  const [user] = await db
    .insert(users)
    .values({
      email: profile.email,
      username,
      displayName: (profile.name ?? username).slice(0, 40),
      avatarUrl: profile.avatarUrl,
      emailVerifiedAt: profile.emailVerified ? now : null,
      ageConfirmedAt: now,
      termsAcceptedAt: now,
    })
    .returning();
  await db.insert(oauthAccounts).values({ provider: profile.provider, providerUserId: profile.providerUserId, userId: user!.id, email: profile.email });
  return { user: user!, created: true };
}

export async function listLinkedAccounts(db: DbExecutor, userId: string) {
  return db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, userId));
}

export async function unlinkAccount(db: DbExecutor, userId: string, provider: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw errors.notFound('User');
  const linked = await listLinkedAccounts(db, userId);
  if (!user.passwordHash && linked.length <= 1) {
    throw errors.validation('Set a password before unlinking your only sign-in method');
  }
  await db.delete(oauthAccounts).where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));
}
