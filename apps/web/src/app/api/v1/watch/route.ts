import { EMOTION_IDS } from '@marutime/config';
import { AppError, checkInEpisode, checkInMovie, ensureMedia, getEpisode, unwatchEpisode, unwatchMovie } from '@marutime/core';
import { devices, eq, getDb, services } from '@marutime/db';
import { z } from 'zod';
import { apiError, apiJson, authenticateApi, readJson } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const scrobbleSchema = z.object({
  type: z.enum(['episode', 'movie']),
  tmdbId: z.number().int().positive(),
  season: z.number().int().min(0).optional(),
  episode: z.number().int().min(0).optional(),
  deviceSlug: z.string().max(40).optional(),
  serviceSlug: z.string().max(40).optional(),
  emotions: z.array(z.enum(EMOTION_IDS as unknown as [string, ...string[]])).optional(),
  watchedAt: z.string().datetime().optional(),
  rewatch: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

async function resolveIds(input: z.infer<typeof scrobbleSchema>) {
  const db = getDb();
  let deviceId: number | null = null;
  let serviceId: number | null = null;
  if (input.deviceSlug) deviceId = (await db.select({ id: devices.id }).from(devices).where(eq(devices.slug, input.deviceSlug)).limit(1))[0]?.id ?? null;
  if (input.serviceSlug) serviceId = (await db.select({ id: services.id }).from(services).where(eq(services.slug, input.serviceSlug)).limit(1))[0]?.id ?? null;
  return { deviceId, serviceId };
}

/**
 * Scrobble endpoint for players and plugins.
 * POST { type: "episode", tmdbId: 1396, season: 1, episode: 1, serviceSlug: "netflix", deviceSlug: "tv" }
 */
export async function POST(request: Request) {
  try {
    const { user } = await authenticateApi(request, 'watch:write');
    const parsed = scrobbleSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('validation', parsed.error.issues[0]?.message ?? 'Invalid body');
    const input = parsed.data;
    const db = getDb();
    const { deviceId, serviceId } = await resolveIds(input);
    const common = { deviceId, serviceId, emotions: input.emotions ?? [], watchedAt: input.watchedAt ? new Date(input.watchedAt) : undefined, rewatch: input.rewatch ?? false, note: input.note };
    if (input.type === 'movie') {
      const media = await ensureMedia(db, 'movie', input.tmdbId);
      const r = await checkInMovie(db, user.id, media.id, common, 'api');
      return apiJson({ ok: true, created: r.created, watchId: r.watch.id, media: { id: media.id, title: media.title } });
    }
    if (input.season === undefined || input.episode === undefined) throw new AppError('validation', 'season and episode are required for episodes');
    const media = await ensureMedia(db, 'show', input.tmdbId);
    const ep = await getEpisode(db, media.id, input.season, input.episode);
    if (!ep) throw new AppError('not_found', `Episode S${input.season}E${input.episode} not found for ${media.title}`);
    const r = await checkInEpisode(db, user.id, ep.id, common, 'api');
    return apiJson({ ok: true, created: r.created, finishedShow: r.finishedShow, watchId: r.watch.id, media: { id: media.id, title: media.title }, episode: { id: ep.id, name: ep.name } });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await authenticateApi(request, 'watch:write');
    const parsed = scrobbleSchema.pick({ type: true, tmdbId: true, season: true, episode: true }).safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('validation', parsed.error.issues[0]?.message ?? 'Invalid body');
    const input = parsed.data;
    const db = getDb();
    if (input.type === 'movie') {
      const media = await ensureMedia(db, 'movie', input.tmdbId);
      return apiJson({ ok: true, removed: await unwatchMovie(db, user.id, media.id) });
    }
    if (input.season === undefined || input.episode === undefined) throw new AppError('validation', 'season and episode are required');
    const media = await ensureMedia(db, 'show', input.tmdbId);
    const ep = await getEpisode(db, media.id, input.season, input.episode);
    if (!ep) throw new AppError('not_found', 'Episode not found');
    return apiJson({ ok: true, removed: await unwatchEpisode(db, user.id, ep.id) });
  } catch (err) {
    return apiError(err);
  }
}
