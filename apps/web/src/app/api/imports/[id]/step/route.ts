import { getEnv } from '@marutime/config';
import { isAppError, runImportStep } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/request';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Work on an import for up to ~25 seconds and report progress. The settings
 * page calls this in a loop while it is open; progress is saved after every
 * batch, so closing the tab only pauses the import.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (!isSameOrigin(request, getEnv().APP_URL)) return json({ error: 'Cross-origin request rejected' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in first' }, 401);
  try {
    return json({ job: await runImportStep(getDb(), user, (await ctx.params).id, { budgetMs: 25_000 }) });
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status);
    console.error('[import] step failed', err);
    return json({ error: 'The import hit a snag' }, 500);
  }
}
