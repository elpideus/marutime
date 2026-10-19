import { buildUserExport, recordExportRequest, watchesToCsv } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GDPR data portability: download everything we hold about you. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const format = new URL(request.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';
  const db = getDb();
  const data = await buildUserExport(db, user.id);
  const stamp = new Date().toISOString().slice(0, 10);
  const body = format === 'csv' ? watchesToCsv(data) : JSON.stringify(data, null, 2);
  await recordExportRequest(db, user.id, user.id, Buffer.byteLength(body)).catch(() => {});
  return new NextResponse(body, {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="marutime-${user.username}-${stamp}.${format}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
