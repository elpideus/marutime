import { schema } from '@marutime/db';
import { getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Tables in dependency order so a restore can insert without deferring
 * foreign keys. Keep in sync with packages/db/src/schema.
 */
export const BACKUP_TABLES: PgTable[] = [
  schema.users,
  schema.devices,
  schema.services,
  schema.media,
  schema.seasons,
  schema.episodes,
  schema.characters,
  schema.episodeCharacters,
  schema.animeDetails,
  schema.sessions,
  schema.oauthAccounts,
  schema.authTokens,
  schema.loginAttempts,
  schema.apiTokens,
  schema.showTracking,
  schema.watchlist,
  schema.watches,
  schema.lists,
  schema.listItems,
  schema.listLikes,
  schema.comments,
  schema.commentLikes,
  schema.userFollows,
  schema.activities,
  schema.notifications,
  schema.platformSettings,
  schema.backups,
  schema.dataExports,
  schema.auditLogs,
  schema.reports,
];

export const BACKUP_TABLE_NAMES = BACKUP_TABLES.map((t) => getTableName(t));

export function tableByName(name: string): PgTable | undefined {
  return BACKUP_TABLES.find((t) => getTableName(t) === name);
}
