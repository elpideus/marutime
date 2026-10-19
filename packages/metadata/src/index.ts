import { getEnv } from '@marutime/config';
import { FixtureProvider } from './fixture/provider';
import { TmdbProvider } from './tmdb/provider';
import type { MetadataProvider } from './types';

export * from './types';
export * from './util';
export * from './images';
export { TmdbProvider } from './tmdb/provider';
export { TmdbClient } from './tmdb/client';
export { FixtureProvider } from './fixture/provider';
export { AniListClient, type AnimeEnrichment, type AnimeCharacter, type AniListCharacterDetails, type AniListStaffDetails, type AniListMediaRef, type AniListVoiceActor, type AniListListEntry, type AniListListStatus } from './anilist/client';

type GlobalWithProvider = typeof globalThis & { __marutimeMetadata?: MetadataProvider };

export function createMetadataProviderFromEnv(): MetadataProvider {
  const env = getEnv();
  if (env.METADATA_PROVIDER === 'fixture') return new FixtureProvider();
  if (!env.TMDB_ACCESS_TOKEN && !env.TMDB_API_KEY) {
    if (env.NODE_ENV !== 'production') {
      console.warn('[metadata] TMDB credentials missing; falling back to the fixture provider');
      return new FixtureProvider();
    }
    throw new Error('TMDB credentials missing: set TMDB_ACCESS_TOKEN (preferred) or TMDB_API_KEY');
  }
  return new TmdbProvider({ accessToken: env.TMDB_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY });
}

export function getMetadataProvider(): MetadataProvider {
  const g = globalThis as GlobalWithProvider;
  if (!g.__marutimeMetadata) g.__marutimeMetadata = createMetadataProviderFromEnv();
  return g.__marutimeMetadata;
}
