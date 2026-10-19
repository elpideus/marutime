import { AppError, addToWatchlist, ensureMedia, getWatchlist, removeFromWatchlist } from '@marutime/core';
import { getDb } from '@marutime/db';
import { z } from 'zod';
import { apiError, apiJson, authenticateApi, readJson } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ type: z.enum(['show', 'movie']), tmdbId: z.number().int().positive(), note: z.string().max(280).optional() });

export async function GET(request: Request) {
  try {
    const { user } = await authenticateApi(request, 'read');
    const category = new URL(request.url).searchParams.get('category');
    const items = await getWatchlist(getDb(), user.id, { category: category === 'shows' || category === 'movies' || category === 'anime' ? category : 'all' });
    return apiJson({ items });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await authenticateApi(request, 'write');
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('validation', parsed.error.issues[0]?.message ?? 'Invalid body');
    const media = await ensureMedia(getDb(), parsed.data.type, parsed.data.tmdbId);
    await addToWatchlist(getDb(), user.id, media.id, parsed.data.note);
    return apiJson({ ok: true, mediaId: media.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await authenticateApi(request, 'write');
    const parsed = bodySchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('validation', parsed.error.issues[0]?.message ?? 'Invalid body');
    const media = await ensureMedia(getDb(), parsed.data.type, parsed.data.tmdbId);
    await removeFromWatchlist(getDb(), user.id, media.id);
    return apiJson({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
