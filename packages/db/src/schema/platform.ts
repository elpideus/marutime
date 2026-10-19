import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { backupKindEnum, jobStatusEnum, reportReasonEnum, reportStatusEnum, reportTargetEnum } from './enums';
import { users } from './users';

/** Key/value platform settings editable from the admin dashboard. */
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
});

export const backups = pgTable(
  'backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: backupKindEnum('kind').notNull(),
    status: jobStatusEnum('status').notNull().default('pending'),
    storageKey: text('storage_key'),
    sizeBytes: integer('size_bytes'),
    tableCounts: jsonb('table_counts').$type<Record<string, number>>(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('backups_started_idx').on(t.startedAt)],
);

export const dataExports = pgTable(
  'data_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: jobStatusEnum('status').notNull().default('pending'),
    storageKey: text('storage_key'),
    sizeBytes: integer('size_bytes'),
    error: text('error'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    requestedById: uuid('requested_by_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('data_exports_user_idx').on(t.userId, t.requestedAt)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text('ip_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt), index('audit_logs_actor_idx').on(t.actorId)],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    targetType: reportTargetEnum('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('open'),
    resolvedById: uuid('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reports_status_created_idx').on(t.status, t.createdAt), index('reports_target_idx').on(t.targetType, t.targetId)],
);

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type Backup = typeof backups.$inferSelect;
export type DataExport = typeof dataExports.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Report = typeof reports.$inferSelect;
