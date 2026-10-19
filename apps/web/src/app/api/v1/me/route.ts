import { getProfile, getUserStats, toPublicUser } from '@marutime/core';
import { getDb } from '@marutime/db';
import { apiError, apiJson, authenticateApi } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user, token } = await authenticateApi(request, 'profile:read');
    const db = getDb();
    const [profile, stats] = await Promise.all([getProfile(db, user.username, user.id), getUserStats(db, user.id)]);
    return apiJson({ user: toPublicUser(user), email: user.email, profile: profile?.stats ?? null, stats, token: token ? { name: token.name, scopes: token.scopes } : null });
  } catch (err) {
    return apiError(err);
  }
}
