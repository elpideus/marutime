import { LIMITS, LIST_VISIBILITIES, type ListCategory, type ListVisibility } from '@marutime/config';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  listItems,
  listLikes,
  lists,
  media,
  or,
  publicUserColumns,
  sql,
  users,
  type DbExecutor,
  type List,
  type ListItem,
  type Media,
  type PublicUser,
  type User,
} from '@marutime/db';
import { z } from 'zod';
import { errors } from '../errors';
import { mediaCategory } from '../media/category';
import { getMediaById } from '../media/queries';
import { recordActivity } from '../social/activity';
import { createNotification } from '../social/notifications';
import { isFollowing } from '../users/profile';
import { parseInput, shortId, slugify } from '../utils';

export const listInputSchema = z.object({
  title: z.string().trim().min(1, 'Give your list a title').max(LIMITS.listTitleMax),
  description: z.string().trim().max(LIMITS.listDescriptionMax).nullable().optional(),
  visibility: z.enum(LIST_VISIBILITIES).default('public'),
  isRanked: z.boolean().default(false),
  coverUrl: z.string().max(500).nullable().optional(),
});

export type ListInput = z.input<typeof listInputSchema>;

export type ListWithOwner = { list: List; owner: PublicUser };
export type ListItemWithMedia = { item: ListItem; media: Media };
export type ListView = ListWithOwner & { items: ListItemWithMedia[]; likedByViewer: boolean; canEdit: boolean; previewPosters: string[] };

function isMod(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'moderator';
}

/** Can `viewer` see this list? `token` grants access to unlisted lists. */
export async function canViewList(db: DbExecutor, list: List, viewer: User | null, token?: string | null): Promise<boolean> {
  if (list.deletedAt) return false;
  if (viewer && (viewer.id === list.ownerId || isMod(viewer))) return true;
  switch (list.visibility) {
    case 'public':
      return true;
    case 'unlisted':
      return Boolean(token) && token === list.shareToken;
    case 'followers':
      return Boolean(viewer) && (await isFollowing(db, viewer!.id, list.ownerId));
    case 'private':
    default:
      return false;
  }
}

async function uniqueSlug(db: DbExecutor, ownerId: string, title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const rows = await db
      .select({ id: lists.id })
      .from(lists)
      .where(and(eq(lists.ownerId, ownerId), eq(lists.slug, slug), excludeId ? sql`${lists.id} <> ${excludeId}` : undefined))
      .limit(1);
    if (!rows[0]) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${shortId(4)}`;
}

export async function createList(db: DbExecutor, owner: User, rawInput: ListInput): Promise<List> {
  const input = parseInput(listInputSchema, rawInput);
  const slug = await uniqueSlug(db, owner.id, input.title);
  const [row] = await db
    .insert(lists)
    .values({
      ownerId: owner.id,
      title: input.title,
      slug,
      description: input.description || null,
      visibility: input.visibility,
      isRanked: input.isRanked,
      coverUrl: input.coverUrl ?? null,
      shareToken: shortId(16),
    })
    .returning();
  if (input.visibility === 'public') await recordActivity(db, { userId: owner.id, type: 'created_list', listId: row!.id });
  return row!;
}

export async function updateList(db: DbExecutor, actor: User, listId: string, rawInput: Partial<ListInput>): Promise<List> {
  const input = parseInput(listInputSchema.partial(), rawInput);
  const current = await getListRow(db, listId);
  if (!current) throw errors.notFound('List');
  if (current.ownerId !== actor.id && !isMod(actor)) throw errors.forbidden();
  const slug = input.title && input.title !== current.title ? await uniqueSlug(db, current.ownerId, input.title, listId) : current.slug;
  const [row] = await db
    .update(lists)
    .set({
      ...(input.title !== undefined ? { title: input.title, slug } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.isRanked !== undefined ? { isRanked: input.isRanked } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(lists.id, listId))
    .returning();
  return row!;
}

export async function regenerateShareToken(db: DbExecutor, actor: User, listId: string): Promise<string> {
  const current = await getListRow(db, listId);
  if (!current) throw errors.notFound('List');
  if (current.ownerId !== actor.id) throw errors.forbidden();
  const token = shortId(16);
  await db.update(lists).set({ shareToken: token, updatedAt: new Date() }).where(eq(lists.id, listId));
  return token;
}

export async function deleteList(db: DbExecutor, actor: User, listId: string): Promise<void> {
  const current = await getListRow(db, listId);
  if (!current) throw errors.notFound('List');
  if (current.ownerId !== actor.id && !isMod(actor)) throw errors.forbidden();
  await db.update(lists).set({ deletedAt: new Date() }).where(eq(lists.id, listId));
}

export async function getListRow(db: DbExecutor, listId: string): Promise<List | null> {
  const rows = await db.select().from(lists).where(and(eq(lists.id, listId), isNull(lists.deletedAt))).limit(1);
  return rows[0] ?? null;
}

export async function getListByShareToken(db: DbExecutor, token: string): Promise<List | null> {
  const rows = await db.select().from(lists).where(and(eq(lists.shareToken, token), isNull(lists.deletedAt))).limit(1);
  return rows[0] ?? null;
}

export async function getListBySlug(db: DbExecutor, username: string, slug: string): Promise<ListWithOwner | null> {
  const rows = await db
    .select({ list: lists, owner: publicUserColumns })
    .from(lists)
    .innerJoin(users, eq(lists.ownerId, users.id))
    .where(and(eq(users.username, username.toLowerCase()), eq(lists.slug, slug), isNull(lists.deletedAt)))
    .limit(1);
  return rows[0] ? { list: rows[0].list, owner: rows[0].owner as PublicUser } : null;
}

async function inferCategory(db: DbExecutor, listId: string): Promise<ListCategory> {
  const rows = await db.select({ type: media.type, isAnime: media.isAnime }).from(listItems).innerJoin(media, eq(listItems.mediaId, media.id)).where(eq(listItems.listId, listId));
  if (rows.length === 0) return 'mixed';
  const cats = new Set(rows.map((r) => mediaCategory(r)));
  if (cats.size === 1) return [...cats][0]!;
  return 'mixed';
}

async function refreshListCounts(db: DbExecutor, listId: string): Promise<void> {
  const [c] = await db.select({ n: count() }).from(listItems).where(eq(listItems.listId, listId));
  await db.update(lists).set({ itemCount: c?.n ?? 0, category: await inferCategory(db, listId), updatedAt: new Date() }).where(eq(lists.id, listId));
}

export async function addListItem(db: DbExecutor, actor: User, listId: string, mediaId: number, note?: string | null): Promise<ListItem> {
  const list = await getListRow(db, listId);
  if (!list) throw errors.notFound('List');
  if (list.ownerId !== actor.id) throw errors.forbidden();
  if (list.itemCount >= LIMITS.listItemsMax) throw errors.validation(`Lists can hold up to ${LIMITS.listItemsMax} titles`);
  if (!(await getMediaById(db, mediaId))) throw errors.notFound('Title');
  const [max] = await db.select({ n: sql<number>`coalesce(max(${listItems.position}), 0)::int` }).from(listItems).where(eq(listItems.listId, listId));
  const [row] = await db
    .insert(listItems)
    .values({ listId, mediaId, position: (max?.n ?? 0) + 1, note: note?.slice(0, LIMITS.listNoteMax) ?? null })
    .onConflictDoUpdate({ target: [listItems.listId, listItems.mediaId], set: { note: note?.slice(0, LIMITS.listNoteMax) ?? null } })
    .returning();
  await refreshListCounts(db, listId);
  return row!;
}

export async function removeListItem(db: DbExecutor, actor: User, listId: string, mediaId: number): Promise<void> {
  const list = await getListRow(db, listId);
  if (!list) throw errors.notFound('List');
  if (list.ownerId !== actor.id && !isMod(actor)) throw errors.forbidden();
  await db.delete(listItems).where(and(eq(listItems.listId, listId), eq(listItems.mediaId, mediaId)));
  await refreshListCounts(db, listId);
}

export async function reorderListItems(db: DbExecutor, actor: User, listId: string, orderedMediaIds: number[]): Promise<void> {
  const list = await getListRow(db, listId);
  if (!list) throw errors.notFound('List');
  if (list.ownerId !== actor.id) throw errors.forbidden();
  let position = 1;
  for (const mediaId of orderedMediaIds) {
    await db.update(listItems).set({ position: position++ }).where(and(eq(listItems.listId, listId), eq(listItems.mediaId, mediaId)));
  }
  await db.update(lists).set({ updatedAt: new Date() }).where(eq(lists.id, listId));
}

export async function updateListItemNote(db: DbExecutor, actor: User, listId: string, mediaId: number, note: string | null): Promise<void> {
  const list = await getListRow(db, listId);
  if (!list || list.ownerId !== actor.id) throw errors.forbidden();
  await db.update(listItems).set({ note: note?.trim().slice(0, LIMITS.listNoteMax) || null }).where(and(eq(listItems.listId, listId), eq(listItems.mediaId, mediaId)));
}

export async function getListItems(db: DbExecutor, listId: string): Promise<ListItemWithMedia[]> {
  const rows = await db.select({ item: listItems, media }).from(listItems).innerJoin(media, eq(listItems.mediaId, media.id)).where(eq(listItems.listId, listId)).orderBy(asc(listItems.position), asc(listItems.addedAt));
  return rows;
}

export async function getListView(db: DbExecutor, list: List, viewer: User | null, token?: string | null): Promise<ListView | null> {
  if (!(await canViewList(db, list, viewer, token))) return null;
  const [owner] = await db.select(publicUserColumns).from(users).where(eq(users.id, list.ownerId)).limit(1);
  if (!owner) return null;
  const items = await getListItems(db, list.id);
  let likedByViewer = false;
  if (viewer) {
    const l = await db.select({ x: sql`1` }).from(listLikes).where(and(eq(listLikes.listId, list.id), eq(listLikes.userId, viewer.id))).limit(1);
    likedByViewer = l.length > 0;
  }
  return {
    list,
    owner: owner as PublicUser,
    items,
    likedByViewer,
    canEdit: Boolean(viewer && (viewer.id === list.ownerId || isMod(viewer))),
    previewPosters: items.map((i) => i.media.posterPath).filter((p): p is string => Boolean(p)).slice(0, 4),
  };
}

export async function toggleListLike(db: DbExecutor, userId: string, listId: string): Promise<{ liked: boolean; likeCount: number }> {
  const list = await getListRow(db, listId);
  if (!list) throw errors.notFound('List');
  const existing = await db.select({ x: sql`1` }).from(listLikes).where(and(eq(listLikes.listId, listId), eq(listLikes.userId, userId))).limit(1);
  let liked: boolean;
  if (existing.length) {
    await db.delete(listLikes).where(and(eq(listLikes.listId, listId), eq(listLikes.userId, userId)));
    liked = false;
  } else {
    await db.insert(listLikes).values({ listId, userId }).onConflictDoNothing();
    liked = true;
    await createNotification(db, { userId: list.ownerId, type: 'list_like', actorId: userId, payload: { listId, title: list.title } });
    if (list.visibility === 'public') await recordActivity(db, { userId, type: 'liked_list', listId });
  }
  const [updated] = await db
    .update(lists)
    .set({ likeCount: sql`(select count(*) from list_likes ll where ll.list_id = lists.id)::int` })
    .where(eq(lists.id, listId))
    .returning({ likeCount: lists.likeCount });
  return { liked, likeCount: updated?.likeCount ?? 0 };
}

export type ListCard = ListWithOwner & { previewPosters: string[]; likedByViewer: boolean };

async function toCards(db: DbExecutor, rows: Array<{ list: List; owner: PublicUser }>, viewerId: string | null): Promise<ListCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.list.id);
  const posters = await db
    .select({ listId: listItems.listId, posterPath: media.posterPath, position: listItems.position })
    .from(listItems)
    .innerJoin(media, eq(listItems.mediaId, media.id))
    .where(inArray(listItems.listId, ids))
    .orderBy(asc(listItems.position));
  const byList = new Map<string, string[]>();
  for (const p of posters) {
    if (!p.posterPath) continue;
    const arr = byList.get(p.listId) ?? [];
    if (arr.length < 4) arr.push(p.posterPath);
    byList.set(p.listId, arr);
  }
  const liked = new Set<string>();
  if (viewerId) {
    const l = await db.select({ id: listLikes.listId }).from(listLikes).where(and(eq(listLikes.userId, viewerId), inArray(listLikes.listId, ids)));
    for (const x of l) liked.add(x.id);
  }
  return rows.map((r) => ({ ...r, previewPosters: byList.get(r.list.id) ?? [], likedByViewer: liked.has(r.list.id) }));
}

export type ListsFeedSort = 'popular' | 'new' | 'trending';

/** Public lists feed, filtered by category and sorted by popularity by default. */
export async function getListsFeed(db: DbExecutor, opts: { category?: ListCategory | 'all'; sort?: ListsFeedSort; page?: number; limit?: number; viewerId?: string | null } = {}): Promise<{ items: ListCard[]; hasMore: boolean }> {
  const limit = Math.min(opts.limit ?? 24, 60);
  const page = Math.max(1, opts.page ?? 1);
  const sort = opts.sort ?? 'popular';
  const where = and(
    eq(lists.visibility, 'public'),
    isNull(lists.deletedAt),
    gt(lists.itemCount, 0),
    eq(users.status, 'active'),
    opts.category && opts.category !== 'all' ? eq(lists.category, opts.category) : undefined,
  );
  const order =
    sort === 'new'
      ? [desc(lists.createdAt)]
      : sort === 'trending'
        ? [desc(sql`(select count(*) from list_likes ll where ll.list_id = lists.id and ll.created_at > now() - interval '7 days')`), desc(lists.likeCount), desc(lists.updatedAt)]
        : [desc(lists.likeCount), desc(lists.itemCount), desc(lists.updatedAt)];
  const rows = await db
    .select({ list: lists, owner: publicUserColumns })
    .from(lists)
    .innerJoin(users, eq(lists.ownerId, users.id))
    .where(where)
    .orderBy(...order)
    .limit(limit + 1)
    .offset((page - 1) * limit);
  const pageRows = rows.slice(0, limit).map((r) => ({ list: r.list, owner: r.owner as PublicUser }));
  return { items: await toCards(db, pageRows, opts.viewerId ?? null), hasMore: rows.length > limit };
}

/** Lists on a profile page, filtered by what the viewer may see. */
export async function getUserLists(db: DbExecutor, ownerId: string, viewer: User | null): Promise<ListCard[]> {
  const isOwner = viewer?.id === ownerId || isMod(viewer);
  const follows = viewer && !isOwner ? await isFollowing(db, viewer.id, ownerId) : false;
  const allowed: ListVisibility[] = isOwner ? ['public', 'unlisted', 'followers', 'private'] : follows ? ['public', 'followers'] : ['public'];
  const rows = await db
    .select({ list: lists, owner: publicUserColumns })
    .from(lists)
    .innerJoin(users, eq(lists.ownerId, users.id))
    .where(and(eq(lists.ownerId, ownerId), isNull(lists.deletedAt), inArray(lists.visibility, allowed)))
    .orderBy(desc(lists.updatedAt));
  return toCards(db, rows.map((r) => ({ list: r.list, owner: r.owner as PublicUser })), viewer?.id ?? null);
}

/** Lists for the "save to list" picker, flagged with whether they already contain the title. */
export async function getListsForPicker(db: DbExecutor, ownerId: string, mediaId: number): Promise<Array<{ list: List; contains: boolean }>> {
  const rows = await db
    .select({ list: lists, contains: sql<boolean>`exists(select 1 from list_items li where li.list_id = lists.id and li.media_id = ${mediaId})` })
    .from(lists)
    .where(and(eq(lists.ownerId, ownerId), isNull(lists.deletedAt)))
    .orderBy(desc(lists.updatedAt))
    .limit(100);
  return rows.map((r) => ({ list: r.list, contains: Boolean(r.contains) }));
}

/** Public lists that include a title, for the "appears in" island on media pages. */
export async function getListsContainingMedia(db: DbExecutor, mediaId: number, viewerId: string | null, limit = 6): Promise<ListCard[]> {
  const rows = await db
    .select({ list: lists, owner: publicUserColumns })
    .from(listItems)
    .innerJoin(lists, eq(listItems.listId, lists.id))
    .innerJoin(users, eq(lists.ownerId, users.id))
    .where(and(eq(listItems.mediaId, mediaId), isNull(lists.deletedAt), or(eq(lists.visibility, 'public'), viewerId ? eq(lists.ownerId, viewerId) : sql`false`)))
    .orderBy(desc(lists.likeCount))
    .limit(limit);
  return toCards(db, rows.map((r) => ({ list: r.list, owner: r.owner as PublicUser })), viewerId);
}

export async function getLikedLists(db: DbExecutor, userId: string): Promise<ListCard[]> {
  const rows = await db
    .select({ list: lists, owner: publicUserColumns })
    .from(listLikes)
    .innerJoin(lists, eq(listLikes.listId, lists.id))
    .innerJoin(users, eq(lists.ownerId, users.id))
    .where(and(eq(listLikes.userId, userId), isNull(lists.deletedAt), eq(lists.visibility, 'public')))
    .orderBy(desc(listLikes.createdAt));
  return toCards(db, rows.map((r) => ({ list: r.list, owner: r.owner as PublicUser })), userId);
}

export { listHref, listShareHref } from '../hrefs';
