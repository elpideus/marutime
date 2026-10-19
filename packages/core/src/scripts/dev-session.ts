import { loadDotenv } from '@marutime/config/dotenv';
loadDotenv();

import { createSession } from '@marutime/auth';
import { closeDb, getDb } from '@marutime/db';
import { findUserByEmail } from '../users/register';

/**
 * Development helper: mint a session token for a user so you can drive the
 * app from curl or an API client. Refuses to run in production.
 *   pnpm --filter @marutime/core dev-session you@example.com
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('dev-session is disabled in production');
  const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
  if (!email) throw new Error('Pass an email');
  const db = getDb();
  const user = await findUserByEmail(db, email);
  if (!user) throw new Error(`No user with email ${email}`);
  const { token } = await createSession(db, user.id, { userAgent: 'dev-session script' });
  console.log(token);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err.message);
  await closeDb();
  process.exit(1);
});
