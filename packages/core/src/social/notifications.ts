import { and, count, desc, eq, inArray, isNull, notifications, publicUserColumns, users, type DbExecutor, type Notification, type PublicUser } from '@marutime/db';

export type NotificationInput = {
  userId: string;
  type: Notification['type'];
  actorId?: string | null;
  payload?: Record<string, unknown>;
};

export async function createNotification(db: DbExecutor, input: NotificationInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;
  await db.insert(notifications).values({ userId: input.userId, type: input.type, actorId: input.actorId ?? null, payload: input.payload ?? {} });
}

export type NotificationView = Notification & { actor: PublicUser | null };

export async function getNotifications(db: DbExecutor, userId: string, limit = 30): Promise<NotificationView[]> {
  const rows = await db
    .select({ n: notifications, actor: publicUserColumns })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.n, actor: r.actor && r.actor.id ? (r.actor as PublicUser) : null }));
}

export async function getUnreadNotificationCount(db: DbExecutor, userId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function markNotificationsRead(db: DbExecutor, userId: string, ids?: string[]): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ids && ids.length ? inArray(notifications.id, ids) : undefined));
}
