import { completeOAuth, createSession, isOAuthProvider, verifyValue } from '@marutime/auth';
import { findOrCreateOAuthUser, isAppError } from '@marutime/core';
import { getEnv } from '@marutime/config';
import { getDb } from '@marutime/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getClientIp, getUserAgent } from '@/lib/request';
import { getCurrentUser, setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

type OAuthState = { provider: string; state: string; codeVerifier: string | null; next: string };

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const appUrl = getEnv().APP_URL;
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, appUrl));
  if (!isOAuthProvider(provider)) return fail('provider');
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const stored = verifyValue<OAuthState>(jar.get('mt_oauth')?.value);
  jar.delete('mt_oauth');
  if (!code || !state || !stored || stored.provider !== provider || stored.state !== state) return fail('state');
  try {
    const profile = await completeOAuth(provider, code, stored.codeVerifier);
    const current = await getCurrentUser();
    const { user } = await findOrCreateOAuthUser(getDb(), profile, { linkToUserId: current?.id });
    if (!current) {
      const { token } = await createSession(getDb(), user.id, { userAgent: await getUserAgent(), ip: await getClientIp() });
      await setSessionCookie(token);
    }
    return NextResponse.redirect(new URL(current ? '/settings/account?linked=1' : stored.next, appUrl));
  } catch (err) {
    console.error('[oauth]', err);
    if (isAppError(err)) return NextResponse.redirect(new URL(`/login?error=oauth&message=${encodeURIComponent(err.message)}`, appUrl));
    return fail('oauth');
  }
}
