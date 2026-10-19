import { getActiveServices } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const items = await getActiveServices(getDb());
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } });
}
