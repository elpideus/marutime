import { RESERVED_USERNAMES, USERNAME_REGEX } from '@marutime/config';
import { eq, users, type DbExecutor } from '@marutime/db';

export function normalizeUsername(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username) && !RESERVED_USERNAMES.has(username);
}

export async function isUsernameTaken(db: DbExecutor, username: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  return rows.length > 0;
}

/** Derive an available username from a name/email, appending digits if needed. */
export async function suggestUsername(db: DbExecutor, base: string): Promise<string> {
  let candidate = normalizeUsername(base.split('@')[0] ?? base);
  if (candidate.length < 3) candidate = `${candidate}fan`.padEnd(3, '0');
  if (RESERVED_USERNAMES.has(candidate)) candidate = `${candidate}_`;
  if (!(await isUsernameTaken(db, candidate)) && isValidUsername(candidate)) return candidate;
  for (let i = 0; i < 25; i++) {
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const c = `${candidate.slice(0, 24 - suffix.length)}${suffix}`;
    if (isValidUsername(c) && !(await isUsernameTaken(db, c))) return c;
  }
  return `user_${Date.now().toString(36)}`;
}
