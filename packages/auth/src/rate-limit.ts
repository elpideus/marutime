import { and, count, eq, gt, loginAttempts, type DbExecutor } from '@marutime/db';
import { hashIp } from './crypto';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IDENTIFIER = 8;
const MAX_PER_IP = 40;

export async function isLoginBlocked(db: DbExecutor, identifier: string, ip?: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byId] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.identifier, identifier.toLowerCase()), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
  if ((byId?.n ?? 0) >= MAX_PER_IDENTIFIER) return true;
  const ipHash = hashIp(ip);
  if (ipHash) {
    const [byIp] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ipHash, ipHash), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
    if ((byIp?.n ?? 0) >= MAX_PER_IP) return true;
  }
  return false;
}

export async function recordLoginAttempt(db: DbExecutor, identifier: string, success: boolean, ip?: string | null): Promise<void> {
  await db.insert(loginAttempts).values({ identifier: identifier.toLowerCase(), success, ipHash: hashIp(ip) });
}
