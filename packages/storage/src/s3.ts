import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { assertSafeKey, StorageError, type ListedObject, type PutOptions, type StorageProvider, type StoredObject } from './types';

export type S3StorageOptions = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  /** Public base URL (custom domain / r2.dev). Without it public URLs are not exposed. */
  publicBaseUrl?: string;
};

/** Works with Cloudflare R2, MinIO, Backblaze B2, Supabase Storage and AWS S3. */
export class S3Storage implements StorageProvider {
  readonly id = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly opts: S3StorageOptions) {
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: opts.forcePathStyle ?? Boolean(opts.endpoint),
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
    });
  }

  async put(key: string, body: Uint8Array, options: PutOptions): Promise<StoredObject> {
    assertSafeKey(key);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.opts.bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          CacheControl: options.cacheControl ?? 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      throw new StorageError(`S3 put failed for ${key}`, err);
    }
    return { key, url: options.access === 'private' ? null : this.publicUrl(key), size: body.byteLength };
  }

  async get(key: string): Promise<Uint8Array | null> {
    assertSafeKey(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
      if (!res.Body) return null;
      return await res.Body.transformToByteArray();
    } catch (err) {
      if ((err as { name?: string }).name === 'NoSuchKey') return null;
      throw new StorageError(`S3 get failed for ${key}`, err);
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }

  async list(prefix: string): Promise<ListedObject[]> {
    const out: ListedObject[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.opts.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const o of res.Contents ?? []) {
        if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? null });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  publicUrl(key: string): string | null {
    if (!this.opts.publicBaseUrl) return null;
    return `${this.opts.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }
}
