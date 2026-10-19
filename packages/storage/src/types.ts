export type PutOptions = {
  contentType: string;
  cacheControl?: string;
  /** Private objects are only readable through the server (backups, exports). */
  access?: 'public' | 'private';
};

export type StoredObject = { key: string; url: string | null; size: number };

export type ListedObject = { key: string; size: number; lastModified: Date | null };

export interface StorageProvider {
  readonly id: 'local' | 's3' | 'vercel-blob';
  put(key: string, body: Uint8Array, options: PutOptions): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<ListedObject[]>;
  /** Public URL for a key, or null when the object is private. */
  publicUrl(key: string): string | null;
}

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9/_\-.]{0,254}$/;

/** Reject path traversal and odd characters before a key reaches any backend. */
export function assertSafeKey(key: string): string {
  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//')) {
    throw new StorageError(`Unsafe storage key: ${key}`);
  }
  return key;
}
