# Architecture

MaruTime is a pnpm monorepo. The web app is thin; nearly all behaviour lives in framework-agnostic packages so a mobile app, a CLI or a player plugin can reuse them (or talk to the same HTTP API).

```
 ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
 │  apps/web    │───▶│ packages/core │───▶│ packages/db  │──▶ PostgreSQL
 │  Next.js 16  │    │ domain logic  │    │ Drizzle ORM  │
 └──────┬───────┘    └──┬────────┬───┘    └──────────────┘
        │               │        │
        │        ┌──────▼──┐  ┌──▼────────────┐
        │        │metadata │  │   storage     │
        │        │TMDB     │  │ local / S3-R2 │
        │        │AniList  │  │ Vercel Blob   │
        │        └─────────┘  └───────────────┘
        └──▶ packages/auth (sessions, passwords, OAuth, API tokens)
        └──▶ packages/ui   (design system)
```

## Packages

| Package | Responsibility | Swap points |
| --- | --- | --- |
| `@marutime/config` | Constants (emotions, default devices/services, limits), zod env schema, platform-setting defaults | Change emotions or limits in one file |
| `@marutime/db` | Schema (`src/schema/*.ts`), `getDb()` singleton (postgres.js), migrations | Any Postgres: Neon, Supabase, RDS, Docker |
| `@marutime/auth` | scrypt password hashing, DB-backed sessions with sliding expiry, signed cookies, OAuth via `arctic`, personal API tokens, login rate limiting | Add a provider in `oauth.ts` |
| `@marutime/metadata` | `MetadataProvider` interface. `TmdbProvider` (search/trending/discover/details/seasons/credits), `AniListClient` (match + enrich), `FixtureProvider` (offline) | Implement the interface for TVDB/Trakt; set `METADATA_PROVIDER` |
| `@marutime/storage` | `StorageProvider` interface: `LocalStorage`, `S3Storage` (R2/MinIO/B2/AWS), `VercelBlobStorage`; `processImage` (sharp: validate, strip EXIF, resize, WebP) | Set `STORAGE_PROVIDER` |
| `@marutime/core` | All use-cases. Pure functions taking a `DbExecutor` (db or transaction) so they run in server actions, route handlers, cron and CLIs alike | Add features here, not in the app |
| `@marutime/ui` | Design system | Theming via CSS variables in `apps/web/src/app/globals.css` |

## Key domain decisions

- **Media identity**: `media(provider, external_id, type)` is unique. URLs use the TMDB id (`/show/1396-breaking-bad`), like TV Time used TVDB ids, so plugins can deep-link without knowing internal ids.
- **Sync on demand, stale-while-revalidate**: `ensureMedia()` imports a title the first time a page or API call needs it. After that, pages always get the stored row immediately; when it is stale (12 h for shows airing this week, 3 d for other running shows, 30 d for ended shows and older movies) one server instance refreshes it in the background under a lease. Routine refreshes only re-fetch seasons that can still change (new, latest, recently aired or undated); every title gets a full pass at most monthly. A daily cron refreshes airing shows that people follow.
- **Cache** (`core/cache`): `cached(key, { ttl, staleTtl, persist }, fn)` is a two-tier read-through cache: an in-process LRU plus the `cache_entries` table shared by every instance. Stale values are served while a single background refresh runs (`after()` in Next.js), concurrent misses share one upstream call, and failures keep serving the stale copy. Search, trending, discover, genres, people and AniList lookups go through it (`getProvider()`); per-title page data is memoised in memory under a key that includes `syncedAt`, so a re-sync invalidates it automatically. The daily cron prunes expired rows.
- **Anime**: classified from TMDB (Animation genre plus Japanese origin, or the `anime` keyword), then enriched from AniList by title and year matching. AniList characters (with character art) take precedence over TMDB voice-actor credits in pickers.
- **Watches**: one row per viewing; rewatches are additional rows. Private fields (`device_id`, `service_id`, `emotions`, `favorite_character_id`, `note`) are never joined into public views; aggregates require at least 3 distinct viewers (`STATS_MIN_VIEWERS`).
- **Progress**: derived, never stored. "Watch next" is the first aired, unwatched episode per followed show (`DISTINCT ON`); "upcoming" is the first unaired episode.
- **Lists**: `visibility` is one of public, unlisted, followers, private; `share_token` grants unlisted access; `category` is inferred from items.
- **Activities**: a public-safe event stream for feeds; never includes private check-in fields. Undoing an action (unwatching, unfollowing, unliking, deleting) removes the activity it created, and the friends feed never shows your own activity.
- **Optimistic UI**: watch state lives in a small client store (`components/tracking/watch-store.ts`) shared by every control. Changes apply instantly, are saved in the background in per-item order, and only failures interrupt with a toast; unwatch and bulk marks offer Undo (the server returns the removed rows so they can be restored).
- **Settings**: key/value `platform_settings` overlaying defaults in `config`; editable in the admin dashboard; 30 s in-process cache.

## Imports

- `@marutime/core/import-format` (browser-safe) defines the normalised import shape (shows with episode viewings or AniList-style progress, movies, lists) and the TV Time parser. The TV Time zip is unpacked with `fflate` and parsed in the browser, so only the relevant history (a few hundred KB) reaches the server, where it is validated again.
- `@marutime/core` `imports/` stores each import as an `import_jobs` row and works through it in steps (`runImportStep`, ~25 s each, saved after every batch, guarded by a lease). The settings page drives the steps while it is open; closing it only pauses the job.
- Matching: TheTVDB ids (TV Time) go through TMDB `/find`; seasons whose numbering doesn't line up with TMDB, and specials, are matched per episode through their TheTVDB episode ids. AniList ids map to TMDB shows, seasons and episode offsets through the Fribb/anime-lists dataset (split cours get offsets from AniList episode counts); anything unmapped falls back to a title search. Movies without ids match on title and year.
- Viewings are only added where missing (per episode, counting rewatches), so re-running an import is a no-op. Imports don't post to the friends feed. Anime that arrive in bulk skip AniList enrichment after a small per-step budget; the daily cron fills it in.

## Web app

- `src/app/(app)`: shell with sidebar, top bar and mobile tab bar; all product pages.
- `src/app/(auth)`: sign in, sign up and reset flows.
- `src/actions/*`: server actions. Each wraps core calls in `run()` which converts `AppError` into `{ ok: false, error, code, details }`.
- `src/app/api/*`: route handlers for search, uploads, exports, cron, admin downloads and the public `v1` API.
- `src/lib/session.ts`: `getCurrentUser()` (request-cached), `requireUser`, `requireStaff`, `requireAdmin`.
- Pages are server components; interactivity lives in small client components (`WatchedButton`, `CheckInDialog`, `CommentFeed`, …) that call server actions and `router.refresh()`.

## Backups

`core/backup` writes an NDJSON stream of every table (dependency-ordered), gzips it, optionally encrypts it (AES-256-GCM, `BACKUP_ENCRYPTION_KEY`) and uploads it as a private object. This works where `pg_dump` cannot run (serverless). `restoreBackup()` truncates and reinserts inside one transaction. Docker users additionally get a nightly `pg_dump` sidecar.

## Adding a feature

1. Schema change in `packages/db/src/schema`, then `pnpm db:generate`, review the SQL, `pnpm db:migrate`.
2. Service function in `packages/core/<area>` with zod validation and `AppError`s.
3. Server action in `apps/web/src/actions` (and/or a `v1` route for API clients).
4. UI in `apps/web/src/components` using `@marutime/ui` primitives.

## Future clients

A mobile app or a plugin needs only `/api/v1` plus a personal access token. The API is off by default (`api.public` platform setting, *Admin → Settings → API*); while it is off it answers 404 to everyone except admins. The OpenAPI description is served at `/api/v1/openapi.json`. The scrobble endpoint (`POST /api/v1/watch`) accepts TMDB ids with season and episode numbers, which is what Plex, Jellyfin and Kodi expose.
