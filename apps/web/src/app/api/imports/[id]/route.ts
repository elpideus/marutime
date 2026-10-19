import { getEnv } from '@marutime/config';
import { cancelImportJob, getImportJob, isAppError } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/request';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in first' }, 401);
  try {
    return json({ job: await getImportJob(getDb(), user.id, (await ctx.params).id) });
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status);
    throw err;
  }
}

/** Cancel: stops the import; what was already imported stays. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request, getEnv().APP_URL)) return json({ error: 'Cross-origin request rejected' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in first' }, 401);
  try {
    return json({ job: await cancelImportJob(getDb(), user.id, (await ctx.params).id) });
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status);
    throw err;
  }
}
