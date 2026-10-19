import { EMOTION_IDS, LIMITS } from '@marutime/config';
import {
  and,
  asc,
  characters,
  count,
  desc,
  devices,
  episodes,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  media,
  notExists,
  services,
  showTracking,
  sql,
  watches,
  watchlist,
  type DbExecutor,
  type Episode,
  type Media,
  type Watch,
} from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { recordActivity } from '../social/activity';
import { parseInput, todayIso } from '../utils';

export const checkInSchema = z.object({
  deviceId: z.number().int().positive().nullable().optional(),
  serviceId: z.number().int().positive().nullable().optional(),
  emotions: z.array(z.enum(EMOTION_IDS as unknown as [string, ...string[]])).max(EMOTION_IDS.length).default([]),
  favoriteCharacterId: z.number().int().positive().nullable().optional(),
  rating: z.number().int().min(1).max(10).nullable().optional(),
  note: z.string().trim().max(LIMITS.watchNoteMax).nullable().optional(),
  watchedAt: z.coerce.date().optional(),
  /** Record an additional viewing instead of updating the previous one. */
  rewatch: z.boolean().default(false),
});

export type CheckInInput = z.input<typeof checkInSchema>;
export type CheckInResult = { watch: Watch; created: boolean; finishedShow: boolean; startedShow: boolean };

async function validateCheckIn(db: DbExecutor, mediaId: number, input: z.output<typeof checkInSchema>): Promise<void> {
  if (input.deviceId) {
    const d = await db.select({ id: devices.id }).from(devices).where(and(eq(devices.id, input.deviceId), eq(devices.isActive, true))).limit(1);
    if (!d[0]) throw errors.validation('Unknown device', { deviceId: ['Unknown device'] });
  }
  if (input.serviceId) {
    const s = await db.select({ id: services.id }).from(services).where(and(eq(services.id, input.serviceId), eq(services.isActive, true))).limit(1);
    if (!s[0]) throw errors.validation('Unknown service', { serviceId: ['Unknown service'] });
  }
  if (input.favoriteCharacterId) {
    const c = await db.select({ id: characters.id }).from(characters).where(and(eq(characters.id, input.favoriteCharacterId), eq(characters.mediaId, mediaId))).limit(1);
    if (!c[0]) throw errors.validation('That character does not belong to this title', { favoriteCharacterId: ['Invalid character'] });
  }
  if (input.watchedAt && input.watchedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw errors.validation('Watched date cannot be in the future', { watchedAt: ['Cannot be in the future'] });
  }
}

function watchValues(userId: string, mediaId: number, episodeId: number | null, input: z.output<typeof checkInSchema>, source: 'web' | 'api' | 'bulk' = 'web') {
  return {
    userId,
    mediaId,
    episodeId,
    watchedAt: input.watchedAt ?? new Date(),
    deviceId: input.deviceId ?? null,
    serviceId: input.serviceId ?? null,
    emotions: input.emotions,
    favoriteCharacterId: input.favoriteCharacterId ?? null,
    rating: input.rating ?? null,
    note: input.note || null,
    source,
  };
}

async function ensureTracking(db: DbExecutor, userId: string, mediaId: number, watchedAt: Date): Promise<{ existed: boolean }> {
  const existing = await db.select({ status: showTracking.status }).from(showTracking).where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, mediaId))).limit(1);
  if (existing[0]) {
    await db
      .update(showTracking)
      .set({
        lastWatchedAt: watchedAt,
        updatedAt: new Date(),
        status: existing[0].status === 'dropped' ? 'watching' : existing[0].status,
      })
      .where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, mediaId)));
    return { existed: true };
  }
  await db.insert(showTracking).values({ userId, mediaId, status: 'watching', lastWatchedAt: watchedAt }).onConflictDoNothing();
  return { existed: false };
}

/** Did the user now finish every aired episode of an ended show? */
async function checkShowFinished(db: DbExecutor, userId: string, mediaRow: Media): Promise<boolean> {
  if (mediaRow.status !== 'Ended' && mediaRow.status !== 'Canceled') return false;
  const remaining = await db
    .select({ n: count() })
    .from(episodes)
    .where(
      and(
        eq(episodes.mediaId, mediaRow.id),
        sql`${episodes.seasonNumber} > 0`,
        isNotNull(episodes.airDate),
        lte(episodes.airDate, todayIso()),
        notExists(db.select({ x: sql`1` }).from(watches).where(and(eq(watches.userId, userId), eq(watches.episodeId, episodes.id)))),
      ),
    );
  return (remaining[0]?.n ?? 0) === 0;
}

export async function checkInEpisode(db: DbExecutor, userId: string, episodeId: number, rawInput: CheckInInput = {}, source: 'web' | 'api' = 'web'): Promise<CheckInResult> {
  const input = parseInput(checkInSchema, rawInput);
  const [row] = await db.select({ episode: episodes, media }).from(episodes).innerJoin(media, eq(episodes.mediaId, media.id)).where(eq(episodes.id, episodeId)).limit(1);
  if (!row) throw errors.notFound('Episode');
  await validateCheckIn(db, row.media.id, input);

  const previous = await db
    .select()
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.episodeId, episodeId)))
    .orderBy(desc(watches.watchedAt))
    .limit(1);

  let watch: Watch;
  let created = false;
  if (previous[0] && !input.rewatch) {
    const [updated] = await db
      .update(watches)
      .set({
        deviceId: input.deviceId !== undefined ? input.deviceId : previous[0].deviceId,
        serviceId: input.serviceId !== undefined ? input.serviceId : previous[0].serviceId,
        emotions: rawInput.emotions !== undefined ? input.emotions : previous[0].emotions,
        favoriteCharacterId: input.favoriteCharacterId !== undefined ? input.favoriteCharacterId : previous[0].favoriteCharacterId,
        rating: input.rating !== undefined ? input.rating : previous[0].rating,
        note: input.note !== undefined ? input.note || null : previous[0].note,
        watchedAt: input.watchedAt ?? previous[0].watchedAt,
      })
      .where(eq(watches.id, previous[0].id))
      .returning();
    watch = updated!;
  } else {
    const [inserted] = await db.insert(watches).values(watchValues(userId, row.media.id, episodeId, input, source)).returning();
    watch = inserted!;
    created = true;
  }

  const { existed } = await ensureTracking(db, userId, row.media.id, watch.watchedAt);
  await db.delete(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.mediaId, row.media.id)));

  let startedShow = false;
  let finishedShow = false;
  if (created) {
    const [n] = await db.select({ n: count() }).from(watches).where(and(eq(watches.userId, userId), eq(watches.mediaId, row.media.id)));
    startedShow = (n?.n ?? 0) === 1 && !existed;
    if (startedShow) await recordActivity(db, { userId, type: 'started_show', mediaId: row.media.id });
    await recordActivity(db, { userId, type: 'watched_episode', mediaId: row.media.id, episodeId, meta: { seasonNumber: row.episode.seasonNumber, episodeNumber: row.episode.episodeNumber } });
    finishedShow = await checkShowFinished(db, userId, row.media);
    if (finishedShow) {
      await db.update(showTracking).set({ status: 'completed', updatedAt: new Date() }).where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, row.media.id)));
      await recordActivity(db, { userId, type: 'finished_show', mediaId: row.media.id });
    }
  }
  return { watch, created, finishedShow, startedShow };
}

export async function checkInMovie(db: DbExecutor, userId: string, mediaId: number, rawInput: CheckInInput = {}, source: 'web' | 'api' = 'web'): Promise<CheckInResult> {
  const input = parseInput(checkInSchema, rawInput);
  const [row] = await db.select().from(media).where(and(eq(media.id, mediaId), eq(media.type, 'movie'))).limit(1);
  if (!row) throw errors.notFound('Movie');
  await validateCheckIn(db, mediaId, input);

  const previous = await db
    .select()
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.mediaId, mediaId), isNull(watches.episodeId)))
    .orderBy(desc(watches.watchedAt))
    .limit(1);

  let watch: Watch;
  let created = false;
  if (previous[0] && !input.rewatch) {
    const [updated] = await db
      .update(watches)
      .set({
        deviceId: input.deviceId !== undefined ? input.deviceId : previous[0].deviceId,
        serviceId: input.serviceId !== undefined ? input.serviceId : previous[0].serviceId,
        emotions: rawInput.emotions !== undefined ? input.emotions : previous[0].emotions,
        favoriteCharacterId: input.favoriteCharacterId !== undefined ? input.favoriteCharacterId : previous[0].favoriteCharacterId,
        rating: input.rating !== undefined ? input.rating : previous[0].rating,
        note: input.note !== undefined ? input.note || null : previous[0].note,
        watchedAt: input.watchedAt ?? previous[0].watchedAt,
      })
      .where(eq(watches.id, previous[0].id))
      .returning();
    watch = updated!;
  } else {
    const [inserted] = await db.insert(watches).values(watchValues(userId, mediaId, null, input, source)).returning();
    watch = inserted!;
    created = true;
    await recordActivity(db, { userId, type: 'watched_movie', mediaId });
  }
  await db.delete(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.mediaId, mediaId)));
  return { watch, created, finishedShow: false, startedShow: false };
}

export async function updateWatch(db: DbExecutor, userId: string, watchId: string, rawInput: CheckInInput): Promise<Watch> {
  const input = parseInput(checkInSchema, rawInput);
  const [existing] = await db.select().from(watches).where(and(eq(watches.id, watchId), eq(watches.userId, userId))).limit(1);
  if (!existing) throw errors.notFound('Watch');
  await validateCheckIn(db, existing.mediaId, input);
  const [updated] = await db
    .update(watches)
    .set({
      deviceId: input.deviceId !== undefined ? input.deviceId : existing.deviceId,
      serviceId: input.serviceId !== undefined ? input.serviceId : existing.serviceId,
      emotions: rawInput.emotions !== undefined ? input.emotions : existing.emotions,
      favoriteCharacterId: input.favoriteCharacterId !== undefined ? input.favoriteCharacterId : existing.favoriteCharacterId,
      rating: input.rating !== undefined ? input.rating : existing.rating,
      note: input.note !== undefined ? input.note || null : existing.note,
      watchedAt: input.watchedAt ?? existing.watchedAt,
    })
    .where(eq(watches.id, watchId))
    .returning();
  return updated!;
}

export async function deleteWatch(db: DbExecutor, userId: string, watchId: string): Promise<void> {
  await db.delete(watches).where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
}

/** Remove every viewing of an episode (undo "watched"). */
export async function unwatchEpisode(db: DbExecutor, userId: string, episodeId: number): Promise<number> {
  const deleted = await db.delete(watches).where(and(eq(watches.userId, userId), eq(watches.episodeId, episodeId))).returning({ id: watches.id, mediaId: watches.mediaId });
  if (deleted[0]) {
    await db
      .update(showTracking)
      .set({ status: 'watching', updatedAt: new Date() })
      .where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, deleted[0].mediaId), eq(showTracking.status, 'completed')));
  }
  return deleted.length;
}

export async function unwatchMovie(db: DbExecutor, userId: string, mediaId: number): Promise<number> {
  const deleted = await db.delete(watches).where(and(eq(watches.userId, userId), eq(watches.mediaId, mediaId), isNull(watches.episodeId))).returning({ id: watches.id });
  return deleted.length;
}

export const bulkMarkSchema = z.object({
  seasonNumber: z.number().int().min(0).optional(),
  /** Mark everything aired up to and including this episode. */
  upToEpisodeId: z.number().int().positive().optional(),
  deviceId: z.number().int().positive().nullable().optional(),
  serviceId: z.number().int().positive().nullable().optional(),
  includeSpecials: z.boolean().default(false),
});

export type BulkMarkInput = z.input<typeof bulkMarkSchema>;

/** Mark many aired episodes watched at once (whole show, a season, or "up to here"). */
export async function markEpisodesWatched(db: DbExecutor, userId: string, mediaId: number, rawInput: BulkMarkInput = {}): Promise<{ marked: number }> {
  const input = parseInput(bulkMarkSchema, rawInput);
  const [mediaRow] = await db.select().from(media).where(and(eq(media.id, mediaId), eq(media.type, 'show'))).limit(1);
  if (!mediaRow) throw errors.notFound('Show');
  await validateCheckIn(db, mediaId, { ...input, emotions: [], rewatch: false });

  let boundary: Episode | null = null;
  if (input.upToEpisodeId) {
    const [b] = await db.select().from(episodes).where(and(eq(episodes.id, input.upToEpisodeId), eq(episodes.mediaId, mediaId))).limit(1);
    if (!b) throw errors.notFound('Episode');
    boundary = b;
  }

  const candidates = await db
    .select({ id: episodes.id, seasonNumber: episodes.seasonNumber, episodeNumber: episodes.episodeNumber, airDate: episodes.airDate })
    .from(episodes)
    .where(
      and(
        eq(episodes.mediaId, mediaId),
        input.includeSpecials ? undefined : sql`${episodes.seasonNumber} > 0`,
        input.seasonNumber !== undefined ? eq(episodes.seasonNumber, input.seasonNumber) : undefined,
        isNotNull(episodes.airDate),
        lte(episodes.airDate, todayIso()),
        notExists(db.select({ x: sql`1` }).from(watches).where(and(eq(watches.userId, userId), eq(watches.episodeId, episodes.id)))),
      ),
    )
    .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));

  const targets = boundary
    ? candidates.filter((e) => e.seasonNumber < boundary!.seasonNumber || (e.seasonNumber === boundary!.seasonNumber && e.episodeNumber <= boundary!.episodeNumber))
    : candidates;
  if (targets.length === 0) return { marked: 0 };

  const now = new Date();
  const ids = targets.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 500) {
    await db.insert(watches).values(
      ids.slice(i, i + 500).map((episodeId) => ({
        userId,
        mediaId,
        episodeId,
        watchedAt: now,
        deviceId: input.deviceId ?? null,
        serviceId: input.serviceId ?? null,
        emotions: [],
        source: 'bulk' as const,
      })),
    );
  }
  const { existed } = await ensureTracking(db, userId, mediaId, now);
  await db.delete(watchlist).where(and(eq(watchlist.userId, userId), eq(watchlist.mediaId, mediaId)));
  if (!existed) await recordActivity(db, { userId, type: 'started_show', mediaId });
  const last = targets[targets.length - 1]!;
  await recordActivity(db, {
    userId,
    type: 'watched_episode',
    mediaId,
    episodeId: last.id,
    meta: { seasonNumber: last.seasonNumber, episodeNumber: last.episodeNumber, bulkCount: targets.length },
  });
  if (await checkShowFinished(db, userId, mediaRow)) {
    await db.update(showTracking).set({ status: 'completed', updatedAt: now }).where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, mediaId)));
    await recordActivity(db, { userId, type: 'finished_show', mediaId });
  }
  return { marked: targets.length };
}

export async function getUserWatchesForMedia(db: DbExecutor, userId: string, mediaId: number): Promise<Watch[]> {
  return db.select().from(watches).where(and(eq(watches.userId, userId), eq(watches.mediaId, mediaId))).orderBy(desc(watches.watchedAt));
}

/** Map of episodeId → viewings for quick "watched" badges on season lists. */
export async function getUserEpisodeWatchMap(db: DbExecutor, userId: string, mediaId: number): Promise<Map<number, Watch[]>> {
  const rows = await getUserWatchesForMedia(db, userId, mediaId);
  const map = new Map<number, Watch[]>();
  for (const w of rows) {
    if (w.episodeId == null) continue;
    const arr = map.get(w.episodeId) ?? [];
    arr.push(w);
    map.set(w.episodeId, arr);
  }
  return map;
}

export async function getWatchedMediaIds(db: DbExecutor, userId: string, mediaIds: number[]): Promise<Set<number>> {
  if (mediaIds.length === 0) return new Set();
  const rows = await db.selectDistinct({ mediaId: watches.mediaId }).from(watches).where(and(eq(watches.userId, userId), inArray(watches.mediaId, mediaIds)));
  return new Set(rows.map((r) => r.mediaId));
}
