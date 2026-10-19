import { LIMITS } from '@marutime/config';
import {
  and,
  asc,
  count,
  episodes,
  eq,
  isNull,
  listItems,
  lists,
  media,
  showTracking,
  sql,
  watches,
  watchlist,
  type DbExecutor,
  type ImportJobStats,
  type Media,
  type User,
} from '@marutime/db';
import type { MetadataProvider } from '@marutime/metadata';
import type { ImportItem, ImportList, ImportMovie, ImportShow } from '../import-format';
import { createList, refreshListCounts } from '../lists';
import { ensureMedia } from '../media/sync';
import { checkShowFinished } from '../tracking/checkin';
import { resolveMovie, resolveShow } from './match';

export type ApplyContext = {
  db: DbExecutor;
  user: User;
  provider: MetadataProvider;
  stats: ImportJobStats;
  /** Item key → media id, for lists. */
  resolved: Record<string, number>;
  /** AniList look-ups this step may still make for new anime (AniList rate-limits hard; the rest are filled in later). */
  enrichBudget: number;
  now: Date;
};

const MAX_UNMATCHED = 300;

export function noteUnmatched(ctx: ApplyContext, kind: 'show' | 'movie', title: string, reason: string): void {
  if (ctx.stats.unmatched.length < MAX_UNMATCHED) ctx.stats.unmatched.push({ kind, title: title.slice(0, 200), reason });
}

/** Run `fn` over `items`, at most `limit` at a time. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

async function ensure(ctx: ApplyContext, type: 'show' | 'movie', externalId: number): Promise<Media> {
  const [known] = await ctx.db
    .select({ id: media.id })
    .from(media)
    .where(and(eq(media.provider, ctx.provider.id), eq(media.externalId, externalId), eq(media.type, type)))
    .limit(1);
  const enrich = !known && ctx.enrichBudget > 0;
  // `wait`: a stale title is refreshed first, so the newest episodes are there to match against.
  const row = await ensureMedia(ctx.db, type, externalId, { skipEnrichment: !enrich, wait: true });
  if (enrich && row.isAnime) ctx.enrichBudget--;
  return row;
}

const toDate = (epoch: number | null, fallback: Date) => (epoch ? new Date(epoch * 1000) : fallback);

async function insertViewings(ctx: ApplyContext, mediaId: number, viewings: Array<{ episodeId: number | null; at: Date }>): Promise<{ inserted: { id: string; at: Date }[]; hadAny: boolean }> {
  // Only add what is not there yet, so running an import twice (or resuming one) never doubles history.
  const existing = await ctx.db
    .select({ episodeId: watches.episodeId, n: count() })
    .from(watches)
    .where(and(eq(watches.userId, ctx.user.id), eq(watches.mediaId, mediaId)))
    .groupBy(watches.episodeId);
  const have = new Map(existing.map((r) => [r.episodeId ?? 0, r.n]));
  const byTarget = new Map<number, Date[]>();
  for (const v of viewings) byTarget.set(v.episodeId ?? 0, [...(byTarget.get(v.episodeId ?? 0) ?? []), v.at]);
  const rows: (typeof watches.$inferInsert)[] = [];
  for (const [target, times] of byTarget) {
    for (const at of times.sort((a, b) => +a - +b).slice(have.get(target) ?? 0)) {
      rows.push({ userId: ctx.user.id, mediaId, episodeId: target || null, watchedAt: at, emotions: [], source: 'import' });
    }
  }
  const inserted: { id: string; at: Date }[] = [];
  for (let i = 0; i < rows.length; i += 1000) {
    const out = await ctx.db.insert(watches).values(rows.slice(i, i + 1000)).returning({ id: watches.id, at: watches.watchedAt });
    inserted.push(...out);
  }
  ctx.stats.watches += inserted.length;
  return { inserted, hadAny: existing.length > 0 };
}

export async function importShow(ctx: ApplyContext, item: ImportShow): Promise<void> {
  const tmdbId = await resolveShow(ctx.provider, item, ctx.db);
  if (!tmdbId) return noteUnmatched(ctx, 'show', item.title, 'No match found');
  let show: Media;
  try {
    show = await ensure(ctx, 'show', tmdbId);
  } catch {
    return noteUnmatched(ctx, 'show', item.title, 'Not available upstream');
  }
  ctx.resolved[item.key] = show.id;
  ctx.stats.shows++;

  const fallback = toDate(item.addedAt ?? null, ctx.now);
  const eps = await ctx.db
    .select({ id: episodes.id, s: episodes.seasonNumber, e: episodes.episodeNumber })
    .from(episodes)
    .where(eq(episodes.mediaId, show.id))
    .orderBy(asc(episodes.seasonNumber), asc(episodes.episodeNumber));
  const byNumber = new Map(eps.map((x) => [`${x.s}:${x.e}`, x.id]));
  const viewings: Array<{ episodeId: number; at: Date }> = [];

  // Episodes by number, except specials and any season whose numbers don't
  // line up with the show's (renumbered or split differently upstream):
  // those go through their TheTVDB ids instead, so nothing lands on the wrong episode.
  const suspect = new Set<number>();
  for (const [s, e] of item.episodes) if (s > 0 && !byNumber.has(`${s}:${e}`)) suspect.add(s);

  const findEpisode = async (tvdbEpisode: number): Promise<number | undefined> => {
    const found = await ctx.provider.findByExternalId('tvdb', tvdbEpisode).catch(() => null);
    const ep = found?.episodes.find((x) => x.showId === tmdbId);
    return ep ? byNumber.get(`${ep.seasonNumber}:${ep.episodeNumber}`) : undefined;
  };

  // A mismatched season is usually the same run of episodes cut differently
  // (one long season upstream, several here, or the reverse). Two look-ups
  // (its first and last watched episode) prove that; then the rest follow by
  // position in airing order, without a look-up per episode.
  const regular = eps.filter((x) => x.s > 0);
  const position = new Map(regular.map((x, i) => [x.id, i]));
  const byPosition = new Map<number, (episode: number) => number | undefined>();
  await mapLimit([...suspect], 4, async (season) => {
    const rows = item.episodes.filter(([s, , , id]) => s === season && id).sort((a, b) => a[1] - b[1]);
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last || first === last) return;
    const [a, b] = await Promise.all([findEpisode(first[3]!), findEpisode(last[3]!)]);
    const pa = a !== undefined ? position.get(a) : undefined;
    const pb = b !== undefined ? position.get(b) : undefined;
    if (pa === undefined || pb === undefined || pb - pa !== last[1] - first[1]) return;
    byPosition.set(season, (episode) => regular[pa + (episode - first[1])]?.id);
  });

  const lookups = new Map<number, Date[]>();
  for (const [s, e, at, tvdbEpisode] of item.episodes) {
    const shifted = byPosition.get(s)?.(e);
    const direct = byNumber.get(`${s}:${e}`);
    if (shifted) viewings.push({ episodeId: shifted, at: toDate(at, fallback) });
    else if ((s === 0 || suspect.has(s)) && tvdbEpisode) lookups.set(tvdbEpisode, [...(lookups.get(tvdbEpisode) ?? []), toDate(at, fallback)]);
    else if (direct && s > 0) viewings.push({ episodeId: direct, at: toDate(at, fallback) });
    else ctx.stats.skippedEpisodes++;
  }
  // Whatever is left (specials, irregular seasons) goes one by one, within reason.
  const MAX_LOOKUPS = 600;
  const pending = [...lookups];
  for (const [, times] of pending.slice(MAX_LOOKUPS)) ctx.stats.skippedEpisodes += times.length;
  await mapLimit(pending.slice(0, MAX_LOOKUPS), 12, async ([tvdbEpisode, times]) => {
    const id = await findEpisode(tvdbEpisode);
    if (id) for (const at of times) viewings.push({ episodeId: id, at });
    else ctx.stats.skippedEpisodes += times.length;
  });

  // Progress counts ("first 12 episodes of season 3").
  const firstYear = show.releaseDate ? Number(show.releaseDate.slice(0, 4)) : null;
  for (const p of item.progress) {
    if (p.count === 0) continue;
    if (p.year && firstYear && Math.abs(firstYear - p.year) > 1) {
      ctx.stats.skippedEpisodes += p.count;
      continue;
    }
    const pool = eps.filter((x) => (p.season === null ? x.s > 0 : x.s === p.season));
    const slice = pool.slice(p.offset, p.offset + p.count);
    ctx.stats.skippedEpisodes += p.count - slice.length;
    for (const x of slice) viewings.push({ episodeId: x.id, at: toDate(p.watchedAt, fallback) });
  }

  const { inserted, hadAny } = await insertViewings(ctx, show.id, viewings);
  const watchedAny = hadAny || inserted.length > 0;

  // Only follow what the source says is being followed (AniList's watching/paused/dropped/completed) or
  // marked as a favourite. Watched episodes alone don't make a follow: the history is enough, and a
  // tracker that follows everything in your library (TV Time) would otherwise flood "Watch next".
  if (item.follow || item.favorite) {
    const finished = watchedAny && (await checkShowFinished(ctx.db, ctx.user.id, show));
    // An explicit "completed" covers what the source tracked; if the show has more, it is still being watched.
    const status = finished ? 'completed' : item.status && item.status !== 'completed' ? item.status : 'watching';
    const last = inserted.reduce<Date | null>((m, w) => (!m || w.at > m ? w.at : m), null);
    await ctx.db
      .insert(showTracking)
      .values({ userId: ctx.user.id, mediaId: show.id, status, isFavorite: item.favorite, lastWatchedAt: last, createdAt: item.addedAt ? fallback : ctx.now, updatedAt: ctx.now })
      .onConflictDoUpdate({
        target: [showTracking.userId, showTracking.mediaId],
        // What the user already set here wins; the import only adds to it.
        set: {
          isFavorite: sql`${showTracking.isFavorite} or excluded.is_favorite`,
          lastWatchedAt: sql`greatest(${showTracking.lastWatchedAt}, excluded.last_watched_at)`,
          status: finished ? sql`case when ${showTracking.status} = 'watching' then 'completed'::tracking_status else ${showTracking.status} end` : sql`${showTracking.status}`,
          updatedAt: ctx.now,
        },
      });
  }
  await syncWatchlist(ctx, show.id, item.watchlist && !watchedAny, inserted.length > 0, fallback);
}

export async function importMovie(ctx: ApplyContext, item: ImportMovie): Promise<void> {
  const tmdbId = await resolveMovie(ctx.provider, item);
  if (!tmdbId) return noteUnmatched(ctx, 'movie', item.title, 'No match found');
  let movie: Media;
  try {
    movie = await ensure(ctx, 'movie', tmdbId);
  } catch {
    return noteUnmatched(ctx, 'movie', item.title, 'Not available upstream');
  }
  ctx.resolved[item.key] = movie.id;
  ctx.stats.movies++;
  const { inserted, hadAny } = await insertViewings(
    ctx,
    movie.id,
    item.watches.map((at) => ({ episodeId: null, at: toDate(at, ctx.now) })),
  );
  if (item.rating && inserted.length) {
    const latest = inserted.reduce((a, b) => (b.at > a.at ? b : a));
    await ctx.db.update(watches).set({ rating: Math.min(10, Math.max(1, Math.round(item.rating))) }).where(eq(watches.id, latest.id));
  }
  await syncWatchlist(ctx, movie.id, item.watchlist && !hadAny && inserted.length === 0, inserted.length > 0, ctx.now);
}

async function syncWatchlist(ctx: ApplyContext, mediaId: number, add: boolean, watchedNow: boolean, at: Date): Promise<void> {
  if (add) {
    const out = await ctx.db.insert(watchlist).values({ userId: ctx.user.id, mediaId, addedAt: at }).onConflictDoNothing().returning({ mediaId: watchlist.mediaId });
    ctx.stats.watchlist += out.length;
  } else if (watchedNow) {
    // Watching something takes it off the watchlist, as a check-in does.
    await ctx.db.delete(watchlist).where(and(eq(watchlist.userId, ctx.user.id), eq(watchlist.mediaId, mediaId)));
  }
}

export async function importList(ctx: ApplyContext, item: ImportList): Promise<void> {
  const ids = [...new Set(item.items.map((k) => ctx.resolved[k]).filter((id): id is number => Boolean(id)))].slice(0, LIMITS.listItemsMax);
  if (!ids.length) return;
  // Importing twice fills the same list instead of making a copy. Imported lists start private.
  const [existing] = await ctx.db
    .select()
    .from(lists)
    .where(and(eq(lists.ownerId, ctx.user.id), eq(lists.title, item.title), isNull(lists.deletedAt)))
    .limit(1);
  const list = existing ?? (await createList(ctx.db, ctx.user, { title: item.title, description: item.description ?? null, visibility: 'private' }));
  const [max] = await ctx.db.select({ n: sql<number>`coalesce(max(${listItems.position}), 0)::int` }).from(listItems).where(eq(listItems.listId, list.id));
  await ctx.db
    .insert(listItems)
    .values(ids.map((mediaId, i) => ({ listId: list.id, mediaId, position: (max?.n ?? 0) + i + 1 })))
    .onConflictDoNothing();
  await refreshListCounts(ctx.db, list.id);
  ctx.stats.lists++;
}

export async function applyItem(ctx: ApplyContext, item: ImportItem): Promise<void> {
  if (item.kind === 'show') return importShow(ctx, item);
  if (item.kind === 'movie') return importMovie(ctx, item);
  return importList(ctx, item);
}
