import { getEnv } from '@marutime/config';
import { isAppError, uploadCommentImage, uploadListCover, uploadUserImage } from '@marutime/core';
import { getDb } from '@marutime/db';
import { getStorage } from '@marutime/storage';
import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/request';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const KINDS = new Set(['avatar', 'cover', 'comment', 'list-cover']);

export async function POST(request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'Unknown upload kind' }, { status: 404 });
  if (!isSameOrigin(request, getEnv().APP_URL)) return NextResponse.json({ error: 'Cross-origin upload rejected' }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to upload' }, { status: 401 });
  if (user.status !== 'active') return NextResponse.json({ error: 'Account suspended' }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received' }, { status: 400 });
  if (file.size > 4.4 * 1024 * 1024) return NextResponse.json({ error: 'Images must be under 4 MB' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = getDb();
  const storage = getStorage();
  try {
    if (kind === 'avatar' || kind === 'cover') {
      const url = await uploadUserImage(db, storage, user, kind, bytes);
      return NextResponse.json({ url });
    }
    if (kind === 'list-cover') {
      const listId = String(form.get('listId') ?? '');
      const url = await uploadListCover(db, storage, user, listId, bytes);
      return NextResponse.json({ url });
    }
    const image = await uploadCommentImage(storage, user.id, bytes);
    return NextResponse.json(image);
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[upload]', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
