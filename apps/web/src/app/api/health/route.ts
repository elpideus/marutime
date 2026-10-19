import { getDb, sql } from '@marutime/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let database = false;
  try {
    await getDb().execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  return NextResponse.json({ ok: database, database, latencyMs: Date.now() - started, version: process.env.npm_package_version ?? '0.1.0' }, { status: database ? 200 : 503 });
}
