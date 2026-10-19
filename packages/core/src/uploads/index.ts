import { getEnv } from '@marutime/config';
import { eq, lists, users, type DbExecutor, type User } from '@marutime/db';
import { ImageError, processImage, type ImageKind, type StorageProvider } from '@marutime/storage';
import { errors } from '../errors';
import { getListRow } from '../lists';
import { shortId } from '../utils';

export type UploadedImage = { url: string; width: number; height: number };

/**
 * Every user-owned file lives under `users/<userId>/`, so account deletion is a
 * single prefix sweep and comment images can be checked against our own hosts.
 */
function userPrefix(userId: string): string {
  return `users/${userId}/`;
}

function isMod(user: User): boolean {
  return user.role === 'admin' || user.role === 'moderator';
}

async function storeImage(storage: StorageProvider, key: string, bytes: Uint8Array, kind: ImageKind): Promise<UploadedImage> {
  let image;
  try {
    image = await processImage(bytes, kind);
  } catch (err) {
    if (err instanceof ImageError) throw errors.validation(err.message);
    throw err;
  }
  const stored = await storage.put(key, image.data, {
    contentType: image.contentType,
    cacheControl: 'public, max-age=31536000, immutable',
    access: 'public',
  });
  const url = stored.url ?? storage.publicUrl(key);
  if (!url) throw errors.unavailable('Image hosting is not configured (set STORAGE_PUBLIC_URL)');
  return { url, width: image.width, height: image.height };
}

/** Map a public URL we issued back to its storage key, but only inside `prefix`. */
function keyFromUrl(url: string | null | undefined, prefix: string): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  const at = pathname.indexOf(`/${prefix}`);
  return at === -1 ? null : pathname.slice(at + 1);
}

async function deleteByUrl(storage: StorageProvider, url: string | null | undefined, prefix: string): Promise<void> {
  const key = keyFromUrl(url, prefix);
  if (key) await storage.delete(key).catch(() => {});
}

/** Upload a new avatar or profile cover, persist it and drop the previous file. */
export async function uploadUserImage(db: DbExecutor, storage: StorageProvider, user: User, kind: 'avatar' | 'cover', bytes: Uint8Array): Promise<string> {
  const prefix = userPrefix(user.id);
  const { url } = await storeImage(storage, `${prefix}${kind}-${shortId()}.webp`, bytes, kind);
  const previous = kind === 'avatar' ? user.avatarUrl : user.coverUrl;
  await db
    .update(users)
    .set(kind === 'avatar' ? { avatarUrl: url, updatedAt: new Date() } : { coverUrl: url, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await deleteByUrl(storage, previous, prefix);
  return url;
}

export async function removeUserImage(db: DbExecutor, storage: StorageProvider, user: User, kind: 'avatar' | 'cover'): Promise<void> {
  const previous = kind === 'avatar' ? user.avatarUrl : user.coverUrl;
  await db
    .update(users)
    .set(kind === 'avatar' ? { avatarUrl: null, updatedAt: new Date() } : { coverUrl: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await deleteByUrl(storage, previous, userPrefix(user.id));
}

/** Upload a list cover. Stored under the list owner's prefix so it is removed with their account. */
export async function uploadListCover(db: DbExecutor, storage: StorageProvider, actor: User, listId: string, bytes: Uint8Array): Promise<string> {
  if (!listId) throw errors.validation('listId is required');
  const list = await getListRow(db, listId);
  if (!list) throw errors.notFound('List');
  if (list.ownerId !== actor.id && !isMod(actor)) throw errors.forbidden();
  const prefix = `${userPrefix(list.ownerId)}lists/`;
  const { url } = await storeImage(storage, `${prefix}${list.id}-${shortId()}.webp`, bytes, 'list-cover');
  await db.update(lists).set({ coverUrl: url, updatedAt: new Date() }).where(eq(lists.id, list.id));
  await deleteByUrl(storage, list.coverUrl, prefix);
  return url;
}

/** Upload an image to attach to a comment. The comment itself is created separately. */
export async function uploadCommentImage(storage: StorageProvider, userId: string, bytes: Uint8Array): Promise<UploadedImage> {
  return storeImage(storage, `${userPrefix(userId)}comments/${shortId()}.webp`, bytes, 'comment');
}

/** Remove every file a user uploaded (account deletion). */
export async function deleteUserFiles(storage: StorageProvider, userId: string): Promise<number> {
  const objects = await storage.list(userPrefix(userId));
  for (const obj of objects) await storage.delete(obj.key).catch(() => {});
  return objects.length;
}

/**
 * URL prefixes that comment images must start with. Vercel Blob URLs are only
 * known after upload, so its public host is derived from the store id in the token.
 */
export function allowedImagePrefixes(storage: StorageProvider): string[] {
  if (storage.id === 'vercel-blob') {
    const storeId = getEnv().BLOB_READ_WRITE_TOKEN?.split('_')[3];
    return storeId ? [`https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/users/`] : [];
  }
  const base = storage.publicUrl('users/');
  return base ? [base] : [];
}
