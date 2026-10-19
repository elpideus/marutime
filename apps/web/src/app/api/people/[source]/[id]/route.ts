import { getPersonView } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Actor / voice actor details for the cast modal (TMDB people, AniList staff). */
export async function GET(_request: Request, ctx: { params: Promise<{ source: string; id: string }> }) {
  const { source, id } = await ctx.params;
  const n = Number(id);
  if ((source !== 'tmdb' && source !== 'anilist') || !Number.isInteger(n) || n <= 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    const person = await getPersonView(getDb(), source, n);
    if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(person, { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch (err) {
    console.error('[people]', err);
    return NextResponse.json({ error: 'Unavailable right now' }, { status: 503 });
  }
}
