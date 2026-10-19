import { LIMITS } from '@marutime/config';
import {
  and,
  asc,
  commentLikes,
  comments,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  publicUserColumns,
  sql,
  users,
  type Comment,
  type CommentImage,
  type DbExecutor,
  type PublicUser,
  type User,
} from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { recordActivity, removeActivities } from '../social/activity';
import { createNotification } from '../social/notifications';
import { parseInput } from '../utils';

export type CommentTarget = { episodeId: number } | { mediaId: number } | { listId: string };

const imageSchema = z.object({ url: z.url().max(500), width: z.number().int().positive().max(10000), height: z.number().int().positive().max(10000), alt: z.string().max(200).optional() });

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(LIMITS.commentMax),
  isSpoiler: z.boolean().default(false),
  images: z.array(imageSchema).max(LIMITS.commentImagesMax).default([]),
  parentId: z.uuid().nullable().optional(),
});

export type CreateCommentInput = z.input<typeof createCommentSchema>;

export type CommentView = Comment & {
  author: PublicUser;
  likedByViewer: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type CommentsPage = { items: CommentView[]; nextCursor: string | null; total: number };

function targetCondition(target: CommentTarget) {
  if ('episodeId' in target) return eq(comments.episodeId, target.episodeId);
  if ('mediaId' in target) return eq(comments.mediaId, target.mediaId);
  return eq(comments.listId, target.listId);
}

function targetType(target: CommentTarget): Comment['targetType'] {
  if ('episodeId' in target) return 'episode';
  if ('mediaId' in target) return 'media';
  return 'list';
}

export function isModerator(user: Pick<User, 'role'> | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'moderator';
}

/** Validate image URLs belong to our storage so comments cannot hotlink arbitrary hosts. */
export function assertAllowedImageUrls(images: CommentImage[], allowedPrefixes: string[]): void {
  for (const img of images) {
    if (!allowedPrefixes.some((p) => img.url.startsWith(p))) throw errors.validation('Images must be uploaded through MaruTime');
  }
}

export async function createComment(db: DbExecutor, user: User, target: CommentTarget, rawInput: CreateCommentInput, opts: { allowedImagePrefixes?: string[] } = {}): Promise<CommentView> {
  const input = parseInput(createCommentSchema, rawInput);
  if (opts.allowedImagePrefixes) assertAllowedImageUrls(input.images, opts.allowedImagePrefixes);
  if (user.status !== 'active') throw errors.forbidden('Your account cannot post right now');

  let parent: Comment | null = null;
  if (input.parentId) {
    const rows = await db.select().from(comments).where(and(eq(comments.id, input.parentId), isNull(comments.deletedAt))).limit(1);
    parent = rows[0] ?? null;
    if (!parent) throw errors.notFound('Comment');
    const sameTarget =
      ('episodeId' in target && parent.episodeId === target.episodeId) ||
      ('mediaId' in target && parent.mediaId === target.mediaId) ||
      ('listId' in target && parent.listId === target.listId);
    if (!sameTarget) throw errors.validation('Reply target mismatch');
  }

  const [row] = await db
    .insert(comments)
    .values({
      userId: user.id,
      targetType: targetType(target),
      episodeId: 'episodeId' in target ? target.episodeId : null,
      mediaId: 'mediaId' in target ? target.mediaId : null,
      listId: 'listId' in target ? target.listId : null,
      parentId: parent?.id ?? null,
      rootId: parent ? (parent.rootId ?? parent.id) : null,
      body: input.body,
      isSpoiler: input.isSpoiler,
      images: input.images,
    })
    .returning();
  const created = row!;

  if (parent) {
    const rootId = parent.rootId ?? parent.id;
    await db.update(comments).set({ replyCount: sql`${comments.replyCount} + 1` }).where(eq(comments.id, rootId));
    await createNotification(db, { userId: parent.userId, type: 'comment_reply', actorId: user.id, payload: { commentId: created.id, rootId, excerpt: input.body.slice(0, 120), isSpoiler: input.isSpoiler, episodeId: created.episodeId, mediaId: created.mediaId, listId: created.listId } });
  } else {
    await recordActivity(db, { userId: user.id, type: 'commented', mediaId: created.mediaId, episodeId: created.episodeId, listId: created.listId, meta: { commentId: created.id, isSpoiler: created.isSpoiler } });
  }

  return { ...created, author: publicFromUser(user), likedByViewer: false, canEdit: true, canDelete: true };
}

function publicFromUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    favoriteCharacterName: user.favoriteCharacterName,
    favoriteCharacterMediaId: user.favoriteCharacterMediaId,
    favoriteCharacterImageUrl: user.favoriteCharacterImageUrl,
    socialLinks: user.socialLinks,
    role: user.role,
    isPrivate: user.isPrivate,
    createdAt: user.createdAt,
  };
}

async function decorate(db: DbExecutor, rows: Array<{ c: Comment; author: PublicUser }>, viewer: User | null): Promise<CommentView[]> {
  const liked = new Set<string>();
  if (viewer && rows.length) {
    const likes = await db
      .select({ id: commentLikes.commentId })
      .from(commentLikes)
      .where(and(eq(commentLikes.userId, viewer.id), inArray(commentLikes.commentId, rows.map((r) => r.c.id))));
    for (const l of likes) liked.add(l.id);
  }
  const mod = isModerator(viewer);
  return rows.map((r) => {
    const own = viewer?.id === r.c.userId;
    const deleted = Boolean(r.c.deletedAt);
    return {
      ...r.c,
      body: deleted ? '' : r.c.body,
      images: deleted ? [] : r.c.images,
      author: r.author,
      likedByViewer: liked.has(r.c.id),
      canEdit: own && !deleted,
      canDelete: (own || mod) && !deleted,
    };
  });
}

export async function getComments(db: DbExecutor, target: CommentTarget, opts: { viewer?: User | null; sort?: 'top' | 'new'; limit?: number; before?: string | null } = {}): Promise<CommentsPage> {
  const limit = Math.min(opts.limit ?? 20, 50);
  const viewer = opts.viewer ?? null;
  const base = and(targetCondition(target), isNull(comments.parentId), isModerator(viewer) ? undefined : isNull(comments.hiddenAt));
  const [total] = await db.select({ n: count() }).from(comments).where(and(base, isNull(comments.deletedAt)));
  const rows = await db
    .select({ c: comments, author: publicUserColumns })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(base, opts.before ? lt(comments.createdAt, new Date(opts.before)) : undefined))
    .orderBy(...(opts.sort === 'top' ? [desc(comments.likeCount), desc(comments.createdAt)] : [desc(comments.createdAt)]))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const items = await decorate(db, page.map((r) => ({ c: r.c, author: r.author as PublicUser })), viewer);
  const last = page[page.length - 1];
  return { items, nextCursor: rows.length > limit && last ? last.c.createdAt.toISOString() : null, total: total?.n ?? 0 };
}

export async function getReplies(db: DbExecutor, rootId: string, viewer: User | null): Promise<CommentView[]> {
  const rows = await db
    .select({ c: comments, author: publicUserColumns })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(and(eq(comments.rootId, rootId), isModerator(viewer) ? undefined : isNull(comments.hiddenAt)))
    .orderBy(asc(comments.createdAt))
    .limit(500);
  return decorate(db, rows.map((r) => ({ c: r.c, author: r.author as PublicUser })), viewer);
}

export async function getCommentById(db: DbExecutor, id: string, viewer: User | null): Promise<CommentView | null> {
  const rows = await db.select({ c: comments, author: publicUserColumns }).from(comments).innerJoin(users, eq(comments.userId, users.id)).where(eq(comments.id, id)).limit(1);
  if (!rows[0]) return null;
  const [view] = await decorate(db, [{ c: rows[0].c, author: rows[0].author as PublicUser }], viewer);
  return view ?? null;
}

export async function toggleCommentLike(db: DbExecutor, userId: string, commentId: string): Promise<{ liked: boolean; likeCount: number }> {
  const [target] = await db.select({ id: comments.id, userId: comments.userId, deletedAt: comments.deletedAt }).from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!target || target.deletedAt) throw errors.notFound('Comment');
  const existing = await db.select({ x: sql`1` }).from(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId))).limit(1);
  let liked: boolean;
  if (existing.length) {
    await db.delete(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
    liked = false;
  } else {
    await db.insert(commentLikes).values({ commentId, userId }).onConflictDoNothing();
    liked = true;
    await createNotification(db, { userId: target.userId, type: 'comment_like', actorId: userId, payload: { commentId } });
  }
  const [updated] = await db
    .update(comments)
    .set({ likeCount: sql`(select count(*) from comment_likes cl where cl.comment_id = comments.id)::int` })
    .where(eq(comments.id, commentId))
    .returning({ likeCount: comments.likeCount });
  return { liked, likeCount: updated?.likeCount ?? 0 };
}

export const editCommentSchema = z.object({ body: z.string().trim().min(1).max(LIMITS.commentMax), isSpoiler: z.boolean().optional() });

export async function editComment(db: DbExecutor, userId: string, commentId: string, rawInput: unknown): Promise<Comment> {
  const input = parseInput(editCommentSchema, rawInput);
  const [row] = await db
    .update(comments)
    .set({ body: input.body, isSpoiler: input.isSpoiler, editedAt: new Date() })
    .where(and(eq(comments.id, commentId), eq(comments.userId, userId), isNull(comments.deletedAt)))
    .returning();
  if (!row) throw errors.notFound('Comment');
  return row;
}

/** Soft delete by the author or a moderator. Replies stay visible. */
export async function deleteComment(db: DbExecutor, actor: User, commentId: string): Promise<void> {
  const [row] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
  if (!row) throw errors.notFound('Comment');
  if (row.userId !== actor.id && !isModerator(actor)) throw errors.forbidden();
  await db.update(comments).set({ deletedAt: new Date(), body: '', images: [] }).where(eq(comments.id, commentId));
  await removeActivities(db, { userId: row.userId, type: 'commented', commentId });
}

export async function setCommentHidden(db: DbExecutor, moderator: User, commentId: string, hidden: boolean, reason?: string): Promise<void> {
  if (!isModerator(moderator)) throw errors.forbidden();
  await db.update(comments).set({ hiddenAt: hidden ? new Date() : null, hiddenReason: hidden ? (reason ?? null) : null }).where(eq(comments.id, commentId));
}

export async function getUserComments(db: DbExecutor, userId: string, limit = 50) {
  return db.select().from(comments).where(and(eq(comments.userId, userId), isNull(comments.deletedAt))).orderBy(desc(comments.createdAt)).limit(limit);
}
