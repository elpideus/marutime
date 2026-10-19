import {
  and,
  asc,
  count,
  desc,
  episodes,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  media,
  notExists,
  showTracking,
  sql,
  watches,
  type DbExecutor,
  type Episode,
  type Media,
  type ShowTracking,
} from '@marutime/db';
import { todayIso } from '../utils';

export type ShowProgress = {
  mediaId: number;
  totalEpisodes: number;
  airedEpisodes: number;
  watchedEpisodes: number;
  remaining: number;
  percent: number;
  nextEpisode: Episode | null;
  upcomingEpisode: Episode | null;
  lastWatchedAt: Date | null;
  isTracked: boolean;
  status: ShowTracking['status'] | null;
  isUpToDate: boolean;
};

/** Per-show progress for a media page (ignores specials, season 0). */
export async function getShowProgress(db: DbExecutor, userId: string | null, mediaId: number): Promise<ShowProgress> {
  const today = todayIso();
  const all = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.mediaId, mediaId), gt(episodes.seasonNumber, 0)))
    .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));
  const aired = all.filter((e) => e.airDate && e.airDate <= today);
  const upcomingEpisode = all.find((e) => e.airDate && e.airDate > today) ?? null;

  if (!userId) {
    return { mediaId, totalEpisodes: all.length, airedEpisodes: aired.length, watchedEpisodes: 0, remaining: aired.length, percent: 0, nextEpisode: aired[0] ?? null, upcomingEpisode, lastWatchedAt: null, isTracked: false, status: null, isUpToDate: false };
  }

  const watched = await db
    .selectDistinct({ episodeId: watches.episodeId })
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.mediaId, mediaId), isNotNull(watches.episodeId)));
  const watchedIds = new Set(watched.map((w) => w.episodeId));
  const [tracking] = await db.select().from(showTracking).where(and(eq(showTracking.userId, userId), eq(showTracking.mediaId, mediaId))).limit(1);
  const nextEpisode = aired.find((e) => !watchedIds.has(e.id)) ?? null;
  const watchedAired = aired.filter((e) => watchedIds.has(e.id)).length;
  return {
    mediaId,
    totalEpisodes: all.length,
    airedEpisodes: aired.length,
    watchedEpisodes: watchedIds.size,
    remaining: aired.length - watchedAired,
    percent: aired.length ? Math.round((watchedAired / aired.length) * 100) : 0,
    nextEpisode,
    upcomingEpisode,
    lastWatchedAt: tracking?.lastWatchedAt ?? null,
    isTracked: Boolean(tracking),
    status: tracking?.status ?? null,
    isUpToDate: Boolean(tracking) && nextEpisode === null,
  };
}

export type WatchNextItem = { media: Media; episode: Episode; remaining: number; tracking: ShowTracking };

/**
 * TVTime's "Watch next": for every followed show, the first aired episode the
 * user has not seen, ordered by most recently active show.
 */
export async function getWatchNext(db: DbExecutor, userId: string, limit = 30): Promise<WatchNextItem[]> {
  const today = todayIso();
  const unwatchedAired = and(
    eq(showTracking.userId, userId),
    eq(showTracking.status, 'watching'),
    gt(episodes.seasonNumber, 0),
    isNotNull(episodes.airDate),
    lte(episodes.airDate, today),
    notExists(db.select({ x: sql`1` }).from(watches).where(and(eq(watches.userId, userId), eq(watches.episodeId, episodes.id)))),
  );

  const nextRows = await db
    .selectDistinctOn([episodes.mediaId], { episode: episodes, tracking: showTracking })
    .from(episodes)
    .innerJoin(showTracking, eq(showTracking.mediaId, episodes.mediaId))
    .where(unwatchedAired)
    .orderBy(asc(episodes.mediaId), asc(episodes.seasonNumber), asc(episodes.episodeNumber));
  if (nextRows.length === 0) return [];

  const remainingRows = await db
    .select({ mediaId: episodes.mediaId, n: count() })
    .from(episodes)
    .innerJoin(showTracking, eq(showTracking.mediaId, episodes.mediaId))
    .where(unwatchedAired)
    .groupBy(episodes.mediaId);
  const remaining = new Map(remainingRows.map((r) => [r.mediaId, r.n]));

  const mediaRows = await db.select().from(media).where(inArray(media.id, nextRows.map((r) => r.episode.mediaId)));
  const mediaById = new Map(mediaRows.map((m) => [m.id, m]));

  return nextRows
    .map((r) => ({ media: mediaById.get(r.episode.mediaId)!, episode: r.episode, remaining: remaining.get(r.episode.mediaId) ?? 1, tracking: r.tracking }))
    .filter((r) => r.media)
    .sort((a, b) => (b.tracking.lastWatchedAt?.getTime() ?? b.tracking.createdAt.getTime()) - (a.tracking.lastWatchedAt?.getTime() ?? a.tracking.createdAt.getTime()))
    .slice(0, limit);
}

export type UpcomingItem = { media: Media; episode: Episode; daysUntil: number };

/** Next unaired episode for each followed show, soonest first. */
export async function getUpcoming(db: DbExecutor, userId: string, limit = 30): Promise<UpcomingItem[]> {
  const today = todayIso();
  const rows = await db
    .selectDistinctOn([episodes.mediaId], { episode: episodes })
    .from(episodes)
    .innerJoin(showTracking, eq(showTracking.mediaId, episodes.mediaId))
    .where(and(eq(showTracking.userId, userId), inArray(showTracking.status, ['watching', 'on_hold']), gt(episodes.seasonNumber, 0), isNotNull(episodes.airDate), gt(episodes.airDate, today)))
    .orderBy(asc(episodes.mediaId), asc(episodes.airDate), asc(episodes.episodeNumber));
  if (rows.length === 0) return [];
  const mediaRows = await db.select().from(media).where(inArray(media.id, rows.map((r) => r.episode.mediaId)));
  const mediaById = new Map(mediaRows.map((m) => [m.id, m]));
  const now = new Date(today).getTime();
  return rows
    .map((r) => ({ media: mediaById.get(r.episode.mediaId)!, episode: r.episode, daysUntil: Math.max(0, Math.round((new Date(r.episode.airDate!).getTime() - now) / 86_400_000)) }))
    .filter((r) => r.media)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, limit);
}

export type LibraryShow = { media: Media; tracking: ShowTracking; progress: ShowProgress };

/**
 * Every followed show with progress, for the "My shows" page. A constant
 * five queries however many shows are followed (no per-show round trips and
 * no loading of whole episode lists).
 */
export async function getLibrary(db: DbExecutor, userId: string): Promise<LibraryShow[]> {
  const today = todayIso();
  const rows = await db
    .select({ media, tracking: showTracking })
    .from(showTracking)
    .innerJoin(media, eq(showTracking.mediaId, media.id))
    .where(eq(showTracking.userId, userId))
    .orderBy(desc(showTracking.lastWatchedAt), desc(showTracking.createdAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.media.id);
  const regular = and(inArray(episodes.mediaId, ids), gt(episodes.seasonNumber, 0));
  const watchedByUser = sql`exists (select 1 from ${watches} w where w.user_id = ${userId} and w.episode_id = ${episodes.id})`;
  const isAired = sql`${episodes.airDate} is not null and ${episodes.airDate} <= ${today}`;

  const [counts, watchedAll, nextRows, upcomingRows] = await Promise.all([
    db
      .select({
        mediaId: episodes.mediaId,
        total: sql<number>`count(*)`.mapWith(Number),
        aired: sql<number>`count(*) filter (where ${isAired})`.mapWith(Number),
        watchedAired: sql<number>`count(*) filter (where ${isAired} and ${watchedByUser})`.mapWith(Number),
      })
      .from(episodes)
      .where(regular)
      .groupBy(episodes.mediaId),
    db
      .select({ mediaId: watches.mediaId, n: sql<number>`count(distinct ${watches.episodeId})`.mapWith(Number) })
      .from(watches)
      .where(and(eq(watches.userId, userId), inArray(watches.mediaId, ids), isNotNull(watches.episodeId)))
      .groupBy(watches.mediaId),
    db
      .selectDistinctOn([episodes.mediaId], { episode: episodes })
      .from(episodes)
      .where(and(regular, isAired, sql`not ${watchedByUser}`))
      .orderBy(asc(episodes.mediaId), asc(episodes.seasonNumber), asc(episodes.episodeNumber)),
    db
      .selectDistinctOn([episodes.mediaId], { episode: episodes })
      .from(episodes)
      .where(and(regular, isNotNull(episodes.airDate), gt(episodes.airDate, today)))
      .orderBy(asc(episodes.mediaId), asc(episodes.seasonNumber), asc(episodes.episodeNumber)),
  ]);
  const countBy = new Map(counts.map((c) => [c.mediaId, c]));
  const watchedBy = new Map(watchedAll.map((w) => [w.mediaId, w.n]));
  const nextBy = new Map(nextRows.map((r) => [r.episode.mediaId, r.episode]));
  const upcomingBy = new Map(upcomingRows.map((r) => [r.episode.mediaId, r.episode]));

  return rows.map((r) => {
    const c = countBy.get(r.media.id);
    const aired = c?.aired ?? 0;
    const watchedAired = c?.watchedAired ?? 0;
    const nextEpisode = nextBy.get(r.media.id) ?? null;
    return {
      media: r.media,
      tracking: r.tracking,
      progress: {
        mediaId: r.media.id,
        totalEpisodes: c?.total ?? 0,
        airedEpisodes: aired,
        watchedEpisodes: watchedBy.get(r.media.id) ?? 0,
        remaining: aired - watchedAired,
        percent: aired ? Math.round((watchedAired / aired) * 100) : 0,
        nextEpisode,
        upcomingEpisode: upcomingBy.get(r.media.id) ?? null,
        lastWatchedAt: r.tracking.lastWatchedAt,
        isTracked: true,
        status: r.tracking.status,
        isUpToDate: nextEpisode === null,
      },
    };
  });
}

export type RecentWatch = { watchId: string; watchedAt: Date; media: Media; episode: Episode | null };

export async function getRecentWatches(db: DbExecutor, userId: string, limit = 12): Promise<RecentWatch[]> {
  const rows = await db
    .select({ id: watches.id, watchedAt: watches.watchedAt, media, episode: episodes })
    .from(watches)
    .innerJoin(media, eq(watches.mediaId, media.id))
    .leftJoin(episodes, eq(watches.episodeId, episodes.id))
    .where(eq(watches.userId, userId))
    .orderBy(desc(watches.watchedAt))
    .limit(limit);
  return rows.map((r) => ({ watchId: r.id, watchedAt: r.watchedAt, media: r.media, episode: r.episode }));
}

export async function getWatchedMovies(db: DbExecutor, userId: string, limit = 60): Promise<Array<{ media: Media; watchedAt: Date; times: number }>> {
  const rows = await db
    .select({ media, watchedAt: sql<Date>`max(${watches.watchedAt})`, times: count() })
    .from(watches)
    .innerJoin(media, eq(watches.mediaId, media.id))
    .where(and(eq(watches.userId, userId), isNull(watches.episodeId)))
    .groupBy(media.id)
    .orderBy(desc(sql`max(${watches.watchedAt})`))
    .limit(limit);
  return rows.map((r) => ({ media: r.media, watchedAt: new Date(r.watchedAt), times: r.times }));
}
