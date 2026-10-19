import { getCharacterView } from '@marutime/core';
import { getDb } from '@marutime/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** AniList character details with voice actors (this show's first) for the cast modal. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const n = Number((await ctx.params).id);
  const mediaParam = Number(new URL(request.url).searchParams.get('media'));
  if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    const character = await getCharacterView(getDb(), n, Number.isInteger(mediaParam) && mediaParam > 0 ? mediaParam : null);
    if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(character, { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch (err) {
    console.error('[characters]', err);
    return NextResponse.json({ error: 'Unavailable right now' }, { status: 503 });
  }
}
