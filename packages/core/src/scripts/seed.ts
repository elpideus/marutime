import { loadDotenv } from '@marutime/config/dotenv';
loadDotenv();

import { hashPassword } from '@marutime/auth';
import { DEFAULT_DEVICES, DEFAULT_PLATFORM_SETTINGS, DEFAULT_SERVICES } from '@marutime/config';
import { closeDb, devices, eq, getDb, platformSettings, services, sql, users } from '@marutime/db';
import { randomBytes } from 'node:crypto';

async function main(): Promise<void> {
  const db = getDb();

  for (const [i, d] of DEFAULT_DEVICES.entries()) {
    await db
      .insert(devices)
      .values({ slug: d.slug, name: d.name, icon: d.icon, sortOrder: i })
      .onConflictDoUpdate({ target: devices.slug, set: { name: d.name, icon: d.icon } });
  }
  for (const [i, s] of DEFAULT_SERVICES.entries()) {
    await db
      .insert(services)
      .values({ slug: s.slug, name: s.name, color: s.color, sortOrder: i })
      .onConflictDoUpdate({ target: services.slug, set: { name: s.name, color: s.color } });
  }
  for (const [key, value] of Object.entries(DEFAULT_PLATFORM_SETTINGS)) {
    await db.insert(platformSettings).values({ key, value: value as unknown }).onConflictDoNothing();
  }
  console.log(`✔ seeded ${DEFAULT_DEVICES.length} devices, ${DEFAULT_SERVICES.length} services, ${Object.keys(DEFAULT_PLATFORM_SETTINGS).length} settings`);

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const username = (process.env.ADMIN_USERNAME ?? 'admin').trim().toLowerCase();
  if (!email) {
    console.log('ℹ ADMIN_EMAIL not set; skipping admin account');
    await closeDb();
    return;
  }
  const existing = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (existing[0]) {
    if (existing[0].role !== 'admin') {
      await db.update(users).set({ role: 'admin' }).where(eq(users.id, existing[0].id));
      console.log(`✔ promoted ${email} to admin`);
    } else {
      console.log(`✔ admin ${email} already exists`);
    }
    if (process.env.ADMIN_PASSWORD) {
      await db.update(users).set({ passwordHash: await hashPassword(process.env.ADMIN_PASSWORD) }).where(eq(users.id, existing[0].id));
      console.log('✔ admin password updated from ADMIN_PASSWORD');
    }
  } else {
    const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
    const now = new Date();
    await db.insert(users).values({
      email,
      username,
      displayName: username,
      passwordHash: await hashPassword(password),
      role: 'admin',
      emailVerifiedAt: now,
      ageConfirmedAt: now,
      termsAcceptedAt: now,
    });
    console.log(`✔ created admin ${email} (@${username})`);
    if (!process.env.ADMIN_PASSWORD) console.log(`   generated password: ${password}\n   (shown once; change it after signing in)`);
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
