import { getEnv } from '@marutime/config';
import { buildAniListImport, createImportJob, isAppError, listImportJobs } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/request';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in first' }, 401);
  return json({ jobs: await listImportJobs(getDb(), user.id) });
}

/**
 * Start an import. TV Time exports are parsed in the browser and arrive as
 * normalised items; AniList imports arrive as a username and are fetched here.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request, getEnv().APP_URL)) return json({ error: 'Cross-origin request rejected' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Sign in first' }, 401);
  if (user.status !== 'active') return json({ error: 'Account suspended' }, 403);
  let body: { source?: unknown; items?: unknown; username?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'That file could not be read' }, 400);
  }
  const db = getDb();
  try {
    if (body.source === 'tvtime') return json({ job: await createImportJob(db, user, { source: 'tvtime', label: 'TV Time', items: body.items }) }, 201);
    if (body.source === 'anilist' && typeof body.username === 'string') {
      const { label, items } = await buildAniListImport(body.username);
      return json({ job: await createImportJob(db, user, { source: 'anilist', label, items }) }, 201);
    }
    return json({ error: 'Unknown import source' }, 400);
  } catch (err) {
    if (isAppError(err)) return json({ error: err.message }, err.status);
    console.error('[import] create failed', err);
    return json({ error: 'The import could not be started' }, 500);
  }
}
