import 'server-only';

import { hasScope, validateApiToken, type ApiScope } from '@marutime/auth';
import { AppError, isAppError } from '@marutime/core';
import { getDb, type ApiToken, type User } from '@marutime/db';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

export type ApiContext = { user: User; token: ApiToken | null };

/** Accepts a personal API token (Bearer mtk_…) or the web session cookie. */
export async function authenticateApi(request: Request, scope?: ApiScope): Promise<ApiContext> {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const result = await validateApiToken(getDb(), auth.slice(7).trim());
    if (!result) throw new AppError('unauthorized', 'Invalid or revoked API token');
    if (scope && !hasScope(result.token, scope)) throw new AppError('forbidden', `This token lacks the "${scope}" scope`);
    return { user: result.user, token: result.token };
  }
  const user = await getCurrentUser();
  if (!user) throw new AppError('unauthorized', 'Provide a Bearer API token or sign in');
  return { user, token: null };
}

export function apiJson(data: unknown, init: ResponseInit = {}): NextResponse {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'private, no-store', ...(init.headers ?? {}) } });
}

export function apiError(err: unknown): NextResponse {
  if (isAppError(err)) return NextResponse.json(err.toJSON(), { status: err.status });
  console.error('[api]', err);
  return NextResponse.json({ error: { code: 'internal', message: 'Internal error' } }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError('validation', 'Body must be valid JSON');
  }
}
