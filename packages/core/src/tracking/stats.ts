import { EMOTIONS, type EmotionId } from '@marutime/config';
import {
  and,
  characters,
  count,
  countDistinct,
  desc,
  devices,
  episodes,
  eq,
  isNotNull,
  isNull,
  media,
  services,
  sql,
  watches,
  type Character,
  type DbExecutor,
} from '@marutime/db';

/** Distributions are hidden below this many distinct viewers to protect anonymity. */
export const STATS_MIN_VIEWERS = 3;

export type CountRow<T> = { item: T; count: number; percent: number };

export type TargetStats = {
  watches: number;
  viewers: number;
  hidden: boolean;
  emotions: CountRow<(typeof EMOTIONS)[number]>[];
  devices: CountRow<{ id: number; name: string; icon: string | null }>[];
  services: CountRow<{ id: number; name: string; color: string | null }>[];
  favoriteCharacters: CountRow<Character>[];
};

type Scope = { episodeId: number } | { mediaId: number; moviesOnly?: boolean } | { showId: number };

function scopeWhere(scope: Scope) {
  if ('episodeId' in scope) return eq(watches.episodeId, scope.episodeId);
  if ('showId' in scope) return and(eq(watches.mediaId, scope.showId), isNotNull(watches.episodeId));
  return scope.moviesOnly === false ? eq(watches.mediaId, scope.mediaId) : and(eq(watches.mediaId, scope.mediaId), isNull(watches.episodeId));
}

function withPercent<T>(rows: Array<{ item: T; count: number }>, total: number): CountRow<T>[] {
  return rows.map((r) => ({ ...r, percent: total ? Math.round((r.count / total) * 100) : 0 }));
}

async function computeStats(db: DbExecutor, scope: Scope): Promise<TargetStats> {
  const where = scopeWhere(scope);
  const [totals] = await db.select({ watches: count(), viewers: countDistinct(watches.userId) }).from(watches).where(where);
  const viewers = totals?.viewers ?? 0;
  const total = totals?.watches ?? 0;
  const hidden = viewers < STATS_MIN_VIEWERS;
  if (hidden) return { watches: total, viewers, hidden, emotions: [], devices: [], services: [], favoriteCharacters: [] };

  const emotionRows = await db
    .select({ emotion: sql<string>`e.value`, n: count() })
    .from(watches)
    .innerJoin(sql`jsonb_array_elements_text(${watches.emotions}) as e`, sql`true`)
    .where(where)
    .groupBy(sql`e.value`);
  const emotionTotal = emotionRows.reduce((a, r) => a + r.n, 0);
  const emotions = withPercent(
    EMOTIONS.map((e) => ({ item: e, count: emotionRows.find((r) => r.emotion === e.id)?.n ?? 0 })).filter((r) => r.count > 0),
    emotionTotal,
  ).sort((a, b) => b.count - a.count);

  const deviceRows = await db
    .select({ id: devices.id, name: devices.name, icon: devices.icon, n: count() })
    .from(watches)
    .innerJoin(devices, eq(watches.deviceId, devices.id))
    .where(where)
    .groupBy(devices.id)
    .orderBy(desc(count()));
  const deviceTotal = deviceRows.reduce((a, r) => a + r.n, 0);

  const serviceRows = await db
    .select({ id: services.id, name: services.name, color: services.color, n: count() })
    .from(watches)
    .innerJoin(services, eq(watches.serviceId, services.id))
    .where(where)
    .groupBy(services.id)
    .orderBy(desc(count()));
  const serviceTotal = serviceRows.reduce((a, r) => a + r.n, 0);

  const charRows = await db
    .select({ c: characters, n: count() })
    .from(watches)
    .innerJoin(characters, eq(watches.favoriteCharacterId, characters.id))
    .where(where)
    .groupBy(characters.id)
    .orderBy(desc(count()))
    .limit(5);
  const charTotal = charRows.reduce((a, r) => a + r.n, 0);

  return {
    watches: total,
    viewers,
    hidden,
    emotions,
    devices: withPercent(deviceRows.map((r) => ({ item: { id: r.id, name: r.name, icon: r.icon }, count: r.n })), deviceTotal),
    services: withPercent(serviceRows.map((r) => ({ item: { id: r.id, name: r.name, color: r.color }, count: r.n })), serviceTotal),
    favoriteCharacters: withPercent(charRows.map((r) => ({ item: r.c, count: r.n })), charTotal),
  };
}

export const getEpisodeStats = (db: DbExecutor, episodeId: number) => computeStats(db, { episodeId });
export const getMovieStats = (db: DbExecutor, mediaId: number) => computeStats(db, { mediaId });
export const getShowStats = (db: DbExecutor, showId: number) => computeStats(db, { showId });

export type UserStats = {
  episodes: number;
  movies: number;
  minutes: number;
  showsTracked: number;
  showsCompleted: number;
  emotions: CountRow<(typeof EMOTIONS)[number]>[];
  devices: CountRow<{ id: number; name: string; icon: string | null }>[];
  services: CountRow<{ id: number; name: string; color: string | null }>[];
  genres: CountRow<string>[];
  topShows: Array<{ mediaId: number; title: string; posterPath: string | null; episodes: number; externalId: number; slug: string }>;
  monthly: Array<{ month: string; episodes: number; movies: number }>;
};

/** The viewer's own statistics. Only totals are ever shown to other people. */
export async function getUserStats(db: DbExecutor, userId: string): Promise<UserStats> {
  const mine = eq(watches.userId, userId);
  const [ep] = await db.select({ n: count() }).from(watches).where(and(mine, isNotNull(watches.episodeId)));
  const [mv] = await db.select({ n: count() }).from(watches).where(and(mine, isNull(watches.episodeId)));
  const [mins] = await db
    .select({ n: sql<number>`coalesce(sum(coalesce(${episodes.runtime}, ${media.runtime}, 0)), 0)::int` })
    .from(watches)
    .leftJoin(episodes, eq(watches.episodeId, episodes.id))
    .innerJoin(media, eq(watches.mediaId, media.id))
    .where(mine);
  const [tracked] = await db.select({ n: count() }).from(sql`show_tracking`).where(sql`show_tracking.user_id = ${userId}`);
  const [completed] = await db.select({ n: count() }).from(sql`show_tracking`).where(sql`show_tracking.user_id = ${userId} and show_tracking.status = 'completed'`);

  const emotionRows = await db
    .select({ emotion: sql<string>`e.value`, n: count() })
    .from(watches)
    .innerJoin(sql`jsonb_array_elements_text(${watches.emotions}) as e`, sql`true`)
    .where(mine)
    .groupBy(sql`e.value`);
  const emotionTotal = emotionRows.reduce((a, r) => a + r.n, 0);

  const deviceRows = await db.select({ id: devices.id, name: devices.name, icon: devices.icon, n: count() }).from(watches).innerJoin(devices, eq(watches.deviceId, devices.id)).where(mine).groupBy(devices.id).orderBy(desc(count()));
  const serviceRows = await db.select({ id: services.id, name: services.name, color: services.color, n: count() }).from(watches).innerJoin(services, eq(watches.serviceId, services.id)).where(mine).groupBy(services.id).orderBy(desc(count()));

  const genreRows = await db
    .select({ genre: sql<string>`g->>'name'`, n: count() })
    .from(watches)
    .innerJoin(media, eq(watches.mediaId, media.id))
    .innerJoin(sql`jsonb_array_elements(${media.genres}) as g`, sql`true`)
    .where(mine)
    .groupBy(sql`g->>'name'`)
    .orderBy(desc(count()))
    .limit(8);
  const genreTotal = genreRows.reduce((a, r) => a + r.n, 0);

  const topShows = await db
    .select({ mediaId: media.id, title: media.title, posterPath: media.posterPath, externalId: media.externalId, slug: media.slug, episodes: count() })
    .from(watches)
    .innerJoin(media, eq(watches.mediaId, media.id))
    .where(and(mine, isNotNull(watches.episodeId)))
    .groupBy(media.id)
    .orderBy(desc(count()))
    .limit(6);

  const monthly = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${watches.watchedAt}), 'YYYY-MM')`,
      episodes: sql<number>`count(*) filter (where ${watches.episodeId} is not null)::int`,
      movies: sql<number>`count(*) filter (where ${watches.episodeId} is null)::int`,
    })
    .from(watches)
    .where(and(mine, sql`${watches.watchedAt} > now() - interval '12 months'`))
    .groupBy(sql`date_trunc('month', ${watches.watchedAt})`)
    .orderBy(sql`date_trunc('month', ${watches.watchedAt})`);

  return {
    episodes: ep?.n ?? 0,
    movies: mv?.n ?? 0,
    minutes: Number(mins?.n ?? 0),
    showsTracked: tracked?.n ?? 0,
    showsCompleted: completed?.n ?? 0,
    emotions: withPercent(EMOTIONS.map((e) => ({ item: e, count: emotionRows.find((r) => r.emotion === e.id)?.n ?? 0 })).filter((r) => r.count > 0), emotionTotal).sort((a, b) => b.count - a.count),
    devices: withPercent(deviceRows.map((r) => ({ item: { id: r.id, name: r.name, icon: r.icon }, count: r.n })), deviceRows.reduce((a, r) => a + r.n, 0)),
    services: withPercent(serviceRows.map((r) => ({ item: { id: r.id, name: r.name, color: r.color }, count: r.n })), serviceRows.reduce((a, r) => a + r.n, 0)),
    genres: withPercent(genreRows.map((r) => ({ item: r.genre, count: r.n })), genreTotal),
    topShows,
    monthly: monthly.map((m) => ({ month: m.month, episodes: Number(m.episodes), movies: Number(m.movies) })),
  };
}

export function emotionById(id: string): (typeof EMOTIONS)[number] | undefined {
  return EMOTIONS.find((e) => e.id === (id as EmotionId));
}
