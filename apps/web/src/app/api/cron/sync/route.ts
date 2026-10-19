import { purgeExpiredSessions } from '@marutime/auth';
import { getEnv } from '@marutime/config';
import { refreshStaleMedia } from '@marutime/core';
import { getDb, loginAttempts, lt } from '@marutime/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Refresh airing shows people follow and tidy expired auth rows. */
export async function GET(request: Request) {
  const secret = getEnv().CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = getDb();
  const media = await refreshStaleMedia(db, 25);
  const sessions = await purgeExpiredSessions(db);
  const attempts = await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))).returning({ id: loginAttempts.id });
  return NextResponse.json({ media, purgedSessions: sessions, purgedLoginAttempts: attempts.length });
}

export const POST = GET;
