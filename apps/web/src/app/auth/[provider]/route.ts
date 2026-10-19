import { isOAuthProvider, signValue, startOAuth } from '@marutime/auth';
import { enabledOAuthProviders, getEnv } from '@marutime/config';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isOAuthProvider(provider) || !enabledOAuthProviders().includes(provider)) {
    return NextResponse.redirect(new URL('/login?error=provider', getEnv().APP_URL));
  }
  const next = new URL(request.url).searchParams.get('next') ?? '/';
  const { url, state, codeVerifier } = startOAuth(provider);
  (await cookies()).set('mt_oauth', signValue({ provider, state, codeVerifier, next: next.startsWith('/') ? next : '/' }), {
    httpOnly: true,
    secure: getEnv().NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
