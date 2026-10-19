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
- **Sync on demand**: `ensureMedia()` imports or refreshes a title when a page or API call needs it (TTL: 12 h for airing shows, 7 d for ended shows and movies). A daily cron refreshes airing shows that people follow.
- **Anime**: classified from TMDB (Animation genre plus Japanese origin, or the `anime` keyword), then enriched from AniList by title and year matching. AniList characters (with character art) take precedence over TMDB voice-actor credits in pickers.
- **Watches**: one row per viewing; rewatches are additional rows. Private fields (`device_id`, `service_id`, `emotions`, `favorite_character_id`, `note`) are never joined into public views; aggregates require at least 3 distinct viewers (`STATS_MIN_VIEWERS`).
- **Progress**: derived, never stored. "Watch next" is the first aired, unwatched episode per followed show (`DISTINCT ON`); "upcoming" is the first unaired episode.
- **Lists**: `visibility` is one of public, unlisted, followers, private; `share_token` grants unlisted access; `category` is inferred from items.
- **Activities**: a public-safe event stream for feeds; never includes private check-in fields.
- **Settings**: key/value `platform_settings` overlaying defaults in `config`; editable in the admin dashboard; 30 s in-process cache.

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

A mobile app or a plugin needs only `/api/v1` plus a personal access token. The OpenAPI description is served at `/api/v1/openapi.json`. The scrobble endpoint (`POST /api/v1/watch`) accepts TMDB ids with season and episode numbers, which is what Plex, Jellyfin and Kodi expose.
