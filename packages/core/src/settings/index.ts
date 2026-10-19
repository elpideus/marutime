import { DEFAULT_PLATFORM_SETTINGS, type PlatformSettingKey, type PlatformSettings } from '@marutime/config';
import { eq, platformSettings, type DbExecutor } from '@marutime/db';

const CACHE_TTL_MS = 30_000;
let cache: { at: number; value: PlatformSettings } | null = null;

export function defaultSettings(): PlatformSettings {
  return structuredClone(DEFAULT_PLATFORM_SETTINGS) as unknown as PlatformSettings;
}

/** Load all settings, overlaying stored values on defaults. Cached briefly per process. */
export async function getSettings(db: DbExecutor, opts: { fresh?: boolean } = {}): Promise<PlatformSettings> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  const rows = await db.select().from(platformSettings);
  const merged = defaultSettings();
  for (const row of rows) {
    if (row.key in merged) (merged as Record<string, unknown>)[row.key] = row.value;
  }
  cache = { at: Date.now(), value: merged };
  return merged;
}

export async function getSetting<K extends PlatformSettingKey>(db: DbExecutor, key: K): Promise<PlatformSettings[K]> {
  const all = await getSettings(db);
  return all[key];
}

export async function setSettings(db: DbExecutor, patch: Partial<PlatformSettings>, actorId: string | null): Promise<PlatformSettings> {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_PLATFORM_SETTINGS)) continue;
    await db
      .insert(platformSettings)
      .values({ key, value: value as unknown, updatedById: actorId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: value as unknown, updatedById: actorId, updatedAt: new Date() } });
  }
  cache = null;
  return getSettings(db, { fresh: true });
}

export function invalidateSettingsCache(): void {
  cache = null;
}

export type DonationConfig = {
  enabled: boolean;
  provider: string;
  handle: string;
  url: string;
  title: string;
  message: string;
  placements: string[];
  frequency: string;
};

export async function getDonationConfig(db: DbExecutor): Promise<DonationConfig> {
  const s = await getSettings(db);
  return {
    enabled: s['donation.enabled'],
    provider: s['donation.provider'],
    handle: s['donation.handle'],
    url: s['donation.url'],
    title: s['donation.title'],
    message: s['donation.message'],
    placements: s['donation.placements'],
    frequency: s['donation.frequency'],
  };
}

/**
 * Whether the public API (/api/v1, personal access tokens) is open to this
 * person. While `api.public` is off only admins can use it, for testing.
 */
export async function isApiAvailable(db: DbExecutor, user: { role: string } | null): Promise<boolean> {
  if (user?.role === 'admin') return true;
  return (await getSettings(db))['api.public'];
}
