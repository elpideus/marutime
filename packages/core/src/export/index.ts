import {
  activities,
  and,
  apiTokens,
  characters,
  commentLikes,
  comments,
  dataExports,
  desc,
  devices,
  episodes,
  eq,
  importJobs,
  listItems,
  listLikes,
  lists,
  media,
  notifications,
  oauthAccounts,
  reports,
  services,
  sessions,
  showTracking,
  userFollows,
  users,
  watches,
  watchlist,
  type DbExecutor,
} from '@marutime/db';
import { errors } from '../errors';

export const EXPORT_FORMAT_VERSION = 1;

/**
 * Everything MaruTime holds about one person, in a portable JSON structure
 * (GDPR Art. 15 / Art. 20). Private check-in fields are included because the
 * data belongs to the user; secrets (password hash, token hashes) are not.
 */
export async function buildUserExport(db: DbExecutor, userId: string): Promise<Record<string, unknown>> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw errors.notFound('User');
  const { passwordHash: _ph, ...profile } = user;

  const watchRows = await db
    .select({
      id: watches.id,
      watchedAt: watches.watchedAt,
      title: media.title,
      mediaType: media.type,
      tmdbId: media.externalId,
      seasonNumber: episodes.seasonNumber,
      episodeNumber: episodes.episodeNumber,
      episodeName: episodes.name,
      device: devices.name,
      service: services.name,
      emotions: watches.emotions,
      favoriteCharacter: characters.name,
      rating: watches.rating,
      note: watches.note,
      source: watches.source,
    })
    .from(watches)
    .innerJoin(media, eq(watches.mediaId, media.id))
    .leftJoin(episodes, eq(watches.episodeId, episodes.id))
    .leftJoin(devices, eq(watches.deviceId, devices.id))
    .leftJoin(services, eq(watches.serviceId, services.id))
    .leftJoin(characters, eq(watches.favoriteCharacterId, characters.id))
    .where(eq(watches.userId, userId))
    .orderBy(desc(watches.watchedAt));

  const tracking = await db
    .select({ title: media.title, tmdbId: media.externalId, status: showTracking.status, isFavorite: showTracking.isFavorite, since: showTracking.createdAt, lastWatchedAt: showTracking.lastWatchedAt })
    .from(showTracking)
    .innerJoin(media, eq(showTracking.mediaId, media.id))
    .where(eq(showTracking.userId, userId));

  const watchlistRows = await db
    .select({ title: media.title, mediaType: media.type, tmdbId: media.externalId, note: watchlist.note, addedAt: watchlist.addedAt })
    .from(watchlist)
    .innerJoin(media, eq(watchlist.mediaId, media.id))
    .where(eq(watchlist.userId, userId));

  const listRows = await db.select().from(lists).where(eq(lists.ownerId, userId));
  const listsWithItems = [];
  for (const l of listRows) {
    const items = await db
      .select({ title: media.title, mediaType: media.type, tmdbId: media.externalId, position: listItems.position, note: listItems.note, addedAt: listItems.addedAt })
      .from(listItems)
      .innerJoin(media, eq(listItems.mediaId, media.id))
      .where(eq(listItems.listId, l.id));
    listsWithItems.push({ ...l, shareToken: undefined, items });
  }

  const commentRows = await db
    .select({ id: comments.id, body: comments.body, isSpoiler: comments.isSpoiler, images: comments.images, createdAt: comments.createdAt, editedAt: comments.editedAt, deletedAt: comments.deletedAt, parentId: comments.parentId, targetType: comments.targetType, mediaTitle: media.title, seasonNumber: episodes.seasonNumber, episodeNumber: episodes.episodeNumber, listId: comments.listId })
    .from(comments)
    .leftJoin(media, eq(comments.mediaId, media.id))
    .leftJoin(episodes, eq(comments.episodeId, episodes.id))
    .where(eq(comments.userId, userId));

  const likedComments = await db.select({ commentId: commentLikes.commentId, createdAt: commentLikes.createdAt }).from(commentLikes).where(eq(commentLikes.userId, userId));
  const likedLists = await db.select({ listId: listLikes.listId, createdAt: listLikes.createdAt }).from(listLikes).where(eq(listLikes.userId, userId));
  const following = await db.select({ username: users.username, since: userFollows.createdAt }).from(userFollows).innerJoin(users, eq(userFollows.followeeId, users.id)).where(eq(userFollows.followerId, userId));
  const followers = await db.select({ username: users.username, since: userFollows.createdAt }).from(userFollows).innerJoin(users, eq(userFollows.followerId, users.id)).where(eq(userFollows.followeeId, userId));
  const activityRows = await db.select().from(activities).where(eq(activities.userId, userId)).orderBy(desc(activities.createdAt)).limit(5000);
  const notificationRows = await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(2000);
  const sessionRows = await db.select({ createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt, expiresAt: sessions.expiresAt, userAgent: sessions.userAgent }).from(sessions).where(eq(sessions.userId, userId));
  const oauthRows = await db.select({ provider: oauthAccounts.provider, email: oauthAccounts.email, createdAt: oauthAccounts.createdAt }).from(oauthAccounts).where(eq(oauthAccounts.userId, userId));
  const tokenRows = await db.select({ name: apiTokens.name, prefix: apiTokens.prefix, scopes: apiTokens.scopes, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt, revokedAt: apiTokens.revokedAt }).from(apiTokens).where(eq(apiTokens.userId, userId));
  const reportRows = await db.select().from(reports).where(and(eq(reports.reporterId, userId)));
  const importRows = await db
    .select({ source: importJobs.source, label: importJobs.label, status: importJobs.status, stats: importJobs.stats, createdAt: importJobs.createdAt, finishedAt: importJobs.finishedAt })
    .from(importJobs)
    .where(eq(importJobs.userId, userId))
    .orderBy(desc(importJobs.createdAt));

  return {
    format: 'marutime-user-export',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    watches: watchRows,
    showTracking: tracking,
    watchlist: watchlistRows,
    lists: listsWithItems,
    comments: commentRows,
    likes: { comments: likedComments, lists: likedLists },
    social: { following, followers },
    activity: activityRows,
    notifications: notificationRows,
    account: { sessions: sessionRows, linkedAccounts: oauthRows, apiTokens: tokenRows },
    reportsFiled: reportRows,
    imports: importRows,
  };
}

/** Watch history as CSV for spreadsheet users. */
export function watchesToCsv(exportData: Record<string, unknown>): string {
  const rows = (exportData.watches as Array<Record<string, unknown>>) ?? [];
  const headers = ['watchedAt', 'title', 'mediaType', 'tmdbId', 'seasonNumber', 'episodeNumber', 'episodeName', 'device', 'service', 'emotions', 'favoriteCharacter', 'rating', 'note'];
  const esc = (v: unknown) => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('|') : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export async function recordExportRequest(db: DbExecutor, userId: string, requestedById: string, sizeBytes: number): Promise<void> {
  await db.insert(dataExports).values({ userId, requestedById, status: 'completed', sizeBytes, completedAt: new Date() });
}

export async function listExportRequests(db: DbExecutor, userId: string) {
  return db.select().from(dataExports).where(eq(dataExports.userId, userId)).orderBy(desc(dataExports.requestedAt)).limit(20);
}
