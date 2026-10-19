<p align="center">
  <img src="apps/web/public/icon.svg" width="72" alt="" />
</p>
<h1 align="center">MaruTime</h1>
<p align="center">A modern, clean, social tracker for shows, movies and anime. The spiritual successor to TV Time.</p>

## What it does

- **Episode-level tracking** — follow shows, tick off episodes, see what to watch next and when the next one airs. Bulk-mark seasons or "catch up to here".
- **Check-ins with feeling** — every episode and movie can carry your device, streaming service, six-emotion reaction (Good · Fun · Wow · Sad · So-so · Bad), favourite character and a private note. Those details are **private**: they only ever surface as anonymous totals, hidden until three different people have checked in.
- **Spoiler-safe discussion** — threaded comments with images under every episode, movie and list; spoiler blur; likes; reports and moderation.
- **Lists** — public, followers-only, unlisted (secret link) or private; ranked or not; a feed sorted by popularity with Shows / Movies / Anime tabs that remember your choice.
- **Watchlist**, **profiles** (cover, avatar, bio, favourite character ever, social links, stats), **follows** and a **friends feed**.
- **Anime done right** — TMDB data enriched with AniList (character art, studios, scores, tags).
- **Admin dashboard** — metrics, users, roles, suspensions, reports, catalogue of devices/services, platform settings (including the donation call to action), backups, audit log.
- **Automatic encrypted backups**, **GDPR exports** (JSON/CSV) and **one-click account deletion**.
- **Open API** (`/api/v1`, OpenAPI at `/api/v1/openapi.json`) with personal access tokens for mobile apps and player plugins (scrobbling).

Runs on **Vercel's free tier** (Neon Postgres + Cloudflare R2) or anywhere with **Docker**.

## Repository layout

```
apps/web            Next.js 16 app (App Router, server actions, route handlers)
packages/config     constants, env schema (zod), platform settings defaults
packages/db         Drizzle ORM schema, client, migrations
packages/auth       sessions, scrypt passwords, OAuth (arctic), API tokens, rate limiting
packages/metadata   MetadataProvider interface: TMDB, AniList, offline fixtures
packages/storage    StorageProvider interface: local disk, S3/R2, Vercel Blob; image processing
packages/core       domain services: users, media sync, tracking, stats, comments, lists, social,
                    uploads, backups/restore, GDPR export, admin
packages/ui         design system (dark-first, yellow accent, bento islands, spring motion)
docker/             Dockerfile, docker-compose, nightly pg_dump
docs/               architecture, deployment, legal notes
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit and how to swap them, and [docs/DEPLOY.md](docs/DEPLOY.md) for Vercel and Docker deployment.

## Quick start (local)

Requirements: Node 20.9+, pnpm 10, PostgreSQL 14+ (or Docker).

```bash
pnpm install
cp .env.example .env            # fill DATABASE_URL, SESSION_SECRET, TMDB_ACCESS_TOKEN, ADMIN_*
pnpm db:migrate                 # apply SQL migrations
pnpm db:seed                    # devices, services, settings, admin account
pnpm dev                        # http://localhost:3000
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `pnpm db:generate` | generate a new SQL migration after editing `packages/db/src/schema` |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm backup` / `pnpm backup --out file.gz` | logical backup to storage or a file |
| `pnpm restore --id <id> --yes` | restore (replaces all data) |
| `pnpm --filter @marutime/core smoke` | live smoke test against TMDB/AniList |
| `pnpm typecheck`, `pnpm lint`, `pnpm test` | checks |

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Anime data courtesy of AniList.

## License

AGPL-3.0. Run it, fork it, improve it; keep it open.
