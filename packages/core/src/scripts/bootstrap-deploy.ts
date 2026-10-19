import { loadDotenv } from '@marutime/config/dotenv';
loadDotenv();

import { hashPassword } from '@marutime/auth';
import { DEFAULT_DEVICES, DEFAULT_PLATFORM_SETTINGS, DEFAULT_SERVICES } from '@marutime/config';
import { closeDb, count, devices, eq, getDb, platformSettings, services, sql, users } from '@marutime/db';

/**
 * Runs after migrations on production deploys, so a brand-new database comes
 * up usable without running `pnpm db:seed` by hand:
 * - default devices and services, only into empty tables (admin edits are never overwritten);
 * - default platform settings that are missing;
 * - an admin account from ADMIN_EMAIL / ADMIN_PASSWORD (and ADMIN_USERNAME),
 *   only while the database has no admin at all. Remove ADMIN_PASSWORD afterwards.
 */
async function main(): Promise<void> {
  const enabled = process.env.VERCEL_ENV === 'production' || process.env.MIGRATE_ON_BUILD === '1';
  if (!enabled) {
    console.log('Skipping bootstrap (not a production deploy).');
    return;
  }
  const db = getDb();
  try {
    const [d] = await db.select({ n: count() }).from(devices);
    if (!d?.n) {
      await db.insert(devices).values(DEFAULT_DEVICES.map((x, i) => ({ slug: x.slug, name: x.name, icon: x.icon, sortOrder: i }))).onConflictDoNothing();
      console.log(`✔ added ${DEFAULT_DEVICES.length} default devices`);
    }
    const [s] = await db.select({ n: count() }).from(services);
    if (!s?.n) {
      await db.insert(services).values(DEFAULT_SERVICES.map((x, i) => ({ slug: x.slug, name: x.name, color: x.color, sortOrder: i }))).onConflictDoNothing();
      console.log(`✔ added ${DEFAULT_SERVICES.length} default services`);
    }
    await db
      .insert(platformSettings)
      .values(Object.entries(DEFAULT_PLATFORM_SETTINGS).map(([key, value]) => ({ key, value: value as unknown })))
      .onConflictDoNothing();

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const [admins] = await db.select({ n: count() }).from(users).where(eq(users.role, 'admin'));
    if (admins?.n) return;
    if (!email || !password) {
      console.log('ℹ No admin account yet: set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_USERNAME) and redeploy to create one.');
      return;
    }
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing) {
      await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing.id));
      console.log(`✔ promoted ${email} to admin`);
      return;
    }
    const username = (process.env.ADMIN_USERNAME ?? 'admin').trim().toLowerCase();
    const now = new Date();
    await db.insert(users).values({ email, username, displayName: username, passwordHash: await hashPassword(password), role: 'admin', emailVerifiedAt: now, ageConfirmedAt: now, termsAcceptedAt: now });
    console.log(`✔ created admin ${email} (@${username}); you can remove ADMIN_PASSWORD from the environment now`);
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error('Bootstrap failed, aborting the build:', err);
  process.exit(1);
});
