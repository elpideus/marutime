import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertSafeKey, StorageError, type ListedObject, type PutOptions, type StorageProvider, type StoredObject } from './types';

export type LocalStorageOptions = {
  /** Directory on disk. Private objects live under `<dir>/private`. */
  directory: string;
  /** Base URL under which public objects are served, e.g. https://app/api/uploads */
  publicBaseUrl: string;
};

/**
 * Filesystem storage for Docker / self-hosted deployments. Public files are
 * served by the web app from `publicBaseUrl/<key>`.
 */
export class LocalStorage implements StorageProvider {
  readonly id = 'local' as const;
  private readonly privateKeys = new Set<string>();

  constructor(private readonly opts: LocalStorageOptions) {}

  private resolve(key: string, access: 'public' | 'private'): string {
    const root = path.resolve(this.opts.directory, access);
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new StorageError(`Key escapes storage root: ${key}`);
    return full;
  }

  private async locate(key: string): Promise<string | null> {
    for (const access of ['public', 'private'] as const) {
      const p = this.resolve(key, access);
      try {
        await stat(p);
        return p;
      } catch {
        /* keep looking */
      }
    }
    return null;
  }

  async put(key: string, body: Uint8Array, options: PutOptions): Promise<StoredObject> {
    assertSafeKey(key);
    const access = options.access ?? 'public';
    const full = this.resolve(key, access);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    if (access === 'private') this.privateKeys.add(key);
    return { key, url: access === 'public' ? this.publicUrl(key) : null, size: body.byteLength };
  }

  async get(key: string): Promise<Uint8Array | null> {
    assertSafeKey(key);
    const full = await this.locate(key);
    if (!full) return null;
    return new Uint8Array(await readFile(full));
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    const full = await this.locate(key);
    if (full) await rm(full, { force: true });
  }

  async list(prefix: string): Promise<ListedObject[]> {
    const out: ListedObject[] = [];
    for (const access of ['public', 'private'] as const) {
      const root = path.resolve(this.opts.directory, access);
      const start = path.resolve(root, prefix);
      if (!start.startsWith(root)) continue;
      let dir = start;
      try {
        const s = await stat(start);
        if (!s.isDirectory()) dir = path.dirname(start);
      } catch {
        dir = path.dirname(start);
      }
      const walk = async (d: string): Promise<void> => {
        let entries: import('node:fs').Dirent[] = [];
        try {
          entries = await readdir(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) await walk(p);
          else {
            const rel = path.relative(root, p).split(path.sep).join('/');
            if (!rel.startsWith(prefix)) continue;
            const s = await stat(p);
            out.push({ key: rel, size: s.size, lastModified: s.mtime });
          }
        }
      };
      await walk(dir);
    }
    return out;
  }

  publicUrl(key: string): string {
    return `${this.opts.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  /** Used by the serving route to decide whether a key may be served publicly. */
  async publicPath(key: string): Promise<string | null> {
    assertSafeKey(key);
    const p = this.resolve(key, 'public');
    try {
      const s = await stat(p);
      return s.isFile() ? p : null;
    } catch {
      return null;
    }
  }
}
