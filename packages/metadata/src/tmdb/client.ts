import { MetadataError } from '../types';

const BASE_URL = 'https://api.themoviedb.org/3';

export type TmdbAuth = { accessToken?: string; apiKey?: string };

export type TmdbRequestOptions = {
  /** Seconds the host framework may cache the response (used as a `next.revalidate` hint). */
  revalidate?: number;
  signal?: AbortSignal;
};

export class TmdbClient {
  private readonly language: string;

  constructor(
    private readonly auth: TmdbAuth,
    options: { language?: string } = {},
  ) {
    if (!auth.accessToken && !auth.apiKey) {
      throw new MetadataError('TMDB credentials missing: set TMDB_ACCESS_TOKEN or TMDB_API_KEY');
    }
    this.language = options.language ?? 'en-US';
  }

  async get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}, options: TmdbRequestOptions = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('language', this.language);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    if (!this.auth.accessToken && this.auth.apiKey) url.searchParams.set('api_key', this.auth.apiKey);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.auth.accessToken) headers.Authorization = `Bearer ${this.auth.accessToken}`;

    let attempt = 0;
    for (;;) {
      const init: RequestInit & { next?: { revalidate?: number } } = { headers, signal: options.signal };
      if (options.revalidate !== undefined) init.next = { revalidate: options.revalidate };
      else init.cache = 'no-store';
      const res = await fetch(url, init);
      if (res.status === 429 && attempt < 2) {
        const retry = Number(res.headers.get('retry-after') ?? '1');
        await new Promise((r) => setTimeout(r, Math.min(retry, 5) * 1000));
        attempt += 1;
        continue;
      }
      if (res.status === 404) return null as T;
      if (!res.ok) {
        let message = `TMDB request failed (${res.status})`;
        try {
          const body = (await res.json()) as { status_message?: string };
          if (body.status_message) message += `: ${body.status_message}`;
        } catch {
          /* ignore */
        }
        throw new MetadataError(message, res.status);
      }
      return (await res.json()) as T;
    }
  }
}
