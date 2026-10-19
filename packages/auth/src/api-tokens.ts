import { and, apiTokens, eq, isNull, users, type ApiToken, type DbExecutor, type User } from '@marutime/db';
import { randomBytes } from 'node:crypto';
import { sha256 } from './crypto';

export const API_SCOPES = ['read', 'write', 'watch:write', 'profile:read', 'profile:write'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const TOKEN_PREFIX = 'mtk';

export function generateApiTokenValue(): { token: string; prefix: string } {
  const prefix = randomBytes(4).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  return { token: `${TOKEN_PREFIX}_${prefix}_${secret}`, prefix };
}

export async function createApiToken(
  db: DbExecutor,
  input: { userId: string; name: string; scopes: ApiScope[]; expiresAt?: Date | null },
): Promise<{ token: string; record: ApiToken }> {
  const { token, prefix } = generateApiTokenValue();
  const [record] = await db
    .insert(apiTokens)
    .values({
      userId: input.userId,
      name: input.name.slice(0, 60),
      tokenHash: sha256(token),
      prefix,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return { token, record: record! };
}

export async function validateApiToken(db: DbExecutor, bearer: string | null | undefined): Promise<{ token: ApiToken; user: User } | null> {
  if (!bearer || !bearer.startsWith(`${TOKEN_PREFIX}_`)) return null;
  const rows = await db
    .select({ token: apiTokens, user: users })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(and(eq(apiTokens.tokenHash, sha256(bearer)), isNull(apiTokens.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.token.expiresAt && row.token.expiresAt < new Date()) return null;
  if (row.user.status !== 'active' || row.user.deletedAt) return null;
  const last = row.token.lastUsedAt?.getTime() ?? 0;
  if (Date.now() - last > 5 * 60 * 1000) {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.token.id));
  }
  return row;
}

export function hasScope(token: ApiToken, scope: ApiScope): boolean {
  const scopes = token.scopes as string[];
  if (scopes.includes('write') && scope !== 'read') return true;
  return scopes.includes(scope) || (scope === 'read' && scopes.length > 0);
}

export async function revokeApiToken(db: DbExecutor, userId: string, tokenId: string): Promise<void> {
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)));
}

export async function listApiTokens(db: DbExecutor, userId: string): Promise<ApiToken[]> {
  return db.select().from(apiTokens).where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
}
