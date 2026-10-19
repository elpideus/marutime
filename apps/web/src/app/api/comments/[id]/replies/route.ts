import { getReplies } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const viewer = await getCurrentUser();
  const items = await getReplies(getDb(), id, viewer);
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
}
