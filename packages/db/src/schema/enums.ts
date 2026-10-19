import { pgEnum } from 'drizzle-orm/pg-core';

export const mediaTypeEnum = pgEnum('media_type', ['show', 'movie']);
export const userRoleEnum = pgEnum('user_role', ['user', 'moderator', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'suspended', 'deleted']);
export const listVisibilityEnum = pgEnum('list_visibility', [
  'public',
  'unlisted',
  'followers',
  'private',
]);
export const listCategoryEnum = pgEnum('list_category', ['shows', 'movies', 'anime', 'mixed']);
export const trackingStatusEnum = pgEnum('tracking_status', [
  'watching',
  'on_hold',
  'dropped',
  'completed',
]);
export const watchSourceEnum = pgEnum('watch_source', ['web', 'api', 'import', 'bulk']);
export const characterKindEnum = pgEnum('character_kind', ['main', 'guest']);
export const commentTargetEnum = pgEnum('comment_target', ['episode', 'media', 'list']);
export const authTokenTypeEnum = pgEnum('auth_token_type', [
  'email_verify',
  'password_reset',
  'email_change',
]);
export const activityTypeEnum = pgEnum('activity_type', [
  'watched_episode',
  'watched_movie',
  'started_show',
  'finished_show',
  'added_watchlist',
  'created_list',
  'liked_list',
  'followed_user',
  'commented',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'comment_reply',
  'comment_like',
  'list_like',
  'new_follower',
  'export_ready',
  'system',
]);
export const reportTargetEnum = pgEnum('report_target', ['comment', 'list', 'user']);
export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'unmarked_spoiler',
  'nsfw',
  'illegal',
  'other',
]);
export const reportStatusEnum = pgEnum('report_status', ['open', 'resolved', 'dismissed']);
export const backupKindEnum = pgEnum('backup_kind', ['scheduled', 'manual']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed']);
