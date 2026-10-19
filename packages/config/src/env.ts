import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),

  /** Random 32+ byte secret used to sign cookies and derive token hashes. */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  TMDB_ACCESS_TOKEN: optionalString,
  TMDB_API_KEY: optionalString,
  METADATA_PROVIDER: z.enum(['tmdb', 'fixture']).default('tmdb'),

  STORAGE_PROVIDER: z.enum(['local', 's3', 'vercel-blob']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./data/uploads'),
  STORAGE_PUBLIC_URL: optionalString,
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: booleanish.default(false),
  BLOB_READ_WRITE_TOKEN: optionalString,

  EMAIL_PROVIDER: z.enum(['console', 'resend', 'none']).default('console'),
  EMAIL_FROM: z.string().default('MaruTime <no-reply@localhost>'),
  RESEND_API_KEY: optionalString,

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  DISCORD_CLIENT_ID: optionalString,
  DISCORD_CLIENT_SECRET: optionalString,

  CRON_SECRET: optionalString,
  /** Optional passphrase; when set, backups are AES-256-GCM encrypted before upload. */
  BACKUP_ENCRYPTION_KEY: optionalString,

  ADMIN_EMAIL: optionalString,
  ADMIN_USERNAME: optionalString,
  ADMIN_PASSWORD: optionalString,

  VERCEL: optionalString,
  VERCEL_ENV: optionalString,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Parse and cache process.env. Throws a readable error listing every problem
 * so misconfiguration is caught at boot instead of deep inside a request.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests and scripts that need to override env after import. */
export function resetEnvCache(): void {
  cached = undefined;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isVercel(): boolean {
  return Boolean(getEnv().VERCEL);
}

/** Which OAuth providers are configured, derived from env at runtime. */
export function enabledOAuthProviders(): Array<'google' | 'github' | 'discord'> {
  const env = getEnv();
  const out: Array<'google' | 'github' | 'discord'> = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push('google');
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.push('github');
  if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) out.push('discord');
  return out;
}
