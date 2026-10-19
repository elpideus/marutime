import { getEnv } from '@marutime/config';
import { LocalStorage } from './local';
import { S3Storage } from './s3';
import type { StorageProvider } from './types';
import { VercelBlobStorage } from './vercel-blob';

export * from './types';
export * from './local';
export * from './s3';
export * from './vercel-blob';
export * from './images';

type GlobalWithStorage = typeof globalThis & { __marutimeStorage?: StorageProvider };

/** Build the configured storage provider from environment variables. */
export function createStorageFromEnv(): StorageProvider {
  const env = getEnv();
  switch (env.STORAGE_PROVIDER) {
    case 's3': {
      if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
        throw new Error('STORAGE_PROVIDER=s3 requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
      }
      return new S3Storage({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        publicBaseUrl: env.STORAGE_PUBLIC_URL,
      });
    }
    case 'vercel-blob': {
      if (!env.BLOB_READ_WRITE_TOKEN) throw new Error('STORAGE_PROVIDER=vercel-blob requires BLOB_READ_WRITE_TOKEN');
      return new VercelBlobStorage(env.BLOB_READ_WRITE_TOKEN);
    }
    case 'local':
    default:
      return new LocalStorage({
        directory: env.STORAGE_LOCAL_DIR,
        publicBaseUrl: env.STORAGE_PUBLIC_URL ?? `${env.APP_URL}/api/uploads`,
      });
  }
}

export function getStorage(): StorageProvider {
  const g = globalThis as GlobalWithStorage;
  if (!g.__marutimeStorage) g.__marutimeStorage = createStorageFromEnv();
  return g.__marutimeStorage;
}
