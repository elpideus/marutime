import { del, head, list, put } from '@vercel/blob';
import { assertSafeKey, StorageError, type ListedObject, type PutOptions, type StorageProvider, type StoredObject } from './types';

/**
 * Vercel Blob adapter. Blobs are public-by-URL; private objects get an
 * unguessable random suffix and callers are expected to encrypt sensitive
 * payloads (see core/backup) before storing them here.
 */
export class VercelBlobStorage implements StorageProvider {
  readonly id = 'vercel-blob' as const;
  private readonly urls = new Map<string, string>();

  constructor(private readonly token: string) {}

  async put(key: string, body: Uint8Array, options: PutOptions): Promise<StoredObject> {
    assertSafeKey(key);
    try {
      const res = await put(key, Buffer.from(body), {
        access: 'public',
        token: this.token,
        contentType: options.contentType,
        addRandomSuffix: options.access === 'private',
        cacheControlMaxAge: options.access === 'private' ? 0 : 31536000,
        allowOverwrite: true,
      });
      this.urls.set(key, res.url);
      return { key, url: options.access === 'private' ? null : res.url, size: body.byteLength };
    } catch (err) {
      throw new StorageError(`Vercel Blob put failed for ${key}`, err);
    }
  }

  private async resolveUrl(key: string): Promise<string | null> {
    const cached = this.urls.get(key);
    if (cached) return cached;
    const res = await list({ prefix: key, token: this.token, limit: 5 });
    const match = res.blobs.find((b) => b.pathname === key || b.pathname.startsWith(key));
    if (match) this.urls.set(key, match.url);
    return match?.url ?? null;
  }

  async get(key: string): Promise<Uint8Array | null> {
    assertSafeKey(key);
    const url = await this.resolveUrl(key);
    if (!url) return null;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    const url = await this.resolveUrl(key);
    if (url) {
      await del(url, { token: this.token });
      this.urls.delete(key);
    }
  }

  async list(prefix: string): Promise<ListedObject[]> {
    const out: ListedObject[] = [];
    let cursor: string | undefined;
    do {
      const res = await list({ prefix, token: this.token, cursor, limit: 1000 });
      for (const b of res.blobs) {
        this.urls.set(b.pathname, b.url);
        out.push({ key: b.pathname, size: b.size, lastModified: b.uploadedAt ?? null });
      }
      cursor = res.hasMore ? res.cursor : undefined;
    } while (cursor);
    return out;
  }

  publicUrl(key: string): string | null {
    return this.urls.get(key) ?? null;
  }

  async exists(key: string): Promise<boolean> {
    const url = await this.resolveUrl(key);
    if (!url) return false;
    try {
      await head(url, { token: this.token });
      return true;
    } catch {
      return false;
    }
  }
}
