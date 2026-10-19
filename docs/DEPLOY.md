# Deployment

Two supported targets: **Vercel free tier** (recommended for marutime.elpideus.com) and **Docker** on any box.

## 1. Vercel (free) + Neon (free) + Cloudflare R2 (free)

### 1.1 Database: Neon
1. Sign up at https://neon.tech (free tier: 0.5 GB storage, autosuspend).
2. Create a project named `marutime` in a region close to your users (Frankfurt for the EU).
3. Copy the **pooled** connection string (contains `-pooler` and ends with `?sslmode=require`). That is `DATABASE_URL`.
   Alternative: in Vercel, *Storage → Create Database → Neon*; it injects `DATABASE_URL` for you.

### 1.2 Storage: Cloudflare R2
1. Cloudflare dashboard → R2 → Create bucket `marutime` (location hint: EU).
2. *Settings → Public access*: connect a custom domain such as `cdn.marutime.elpideus.com` (or enable the `r2.dev` URL). That URL is `STORAGE_PUBLIC_URL`.
3. *R2 → Manage R2 API tokens → Create API token* with **Object Read & Write** on this bucket. Copy the Access Key ID, the Secret Access Key and the endpoint `https://<account-id>.r2.cloudflarestorage.com`.
4. Set `STORAGE_PROVIDER=s3`, `S3_ENDPOINT`, `S3_BUCKET=marutime`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE=true`.
   Backups go into the same bucket under `backups/`. The app never links to them, and with `BACKUP_ENCRYPTION_KEY` set they are encrypted at rest.

### 1.3 Vercel project
1. Import the GitHub repository. Set **Root Directory: `apps/web`**, Framework: Next.js, Node 22. Vercel detects pnpm from the `packageManager` field.
2. Environment variables (Production and Preview), from `.env.example`:
   - `APP_URL=https://marutime.elpideus.com`
   - `DATABASE_URL`, `SESSION_SECRET` (`openssl rand -base64 48`), `CRON_SECRET` (`openssl rand -hex 32`)
   - `TMDB_ACCESS_TOKEN`
   - the storage variables from 1.2 and `BACKUP_ENCRYPTION_KEY`
   - `EMAIL_PROVIDER=none` for now (switch to `resend` with `RESEND_API_KEY` later)
3. Cron jobs: the root `vercel.json` declares them, but Vercel reads `vercel.json` from the Root Directory. Copy it to `apps/web/vercel.json` (already done in this repo) or add them under *Project → Settings → Cron Jobs*:
   - `/api/cron/backup` at `0 4 * * *`
   - `/api/cron/sync` at `0 6 * * *`
   Hobby plan crons run once a day, which is what these need. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
4. Domain: *Settings → Domains*, add `marutime.elpideus.com`. In Cloudflare DNS add the CNAME Vercel shows. Use proxy status **DNS only** (grey cloud), or keep the orange cloud with SSL mode "Full (strict)".

### 1.4 Migrate and seed (once)
From your machine, with the production `DATABASE_URL` in `.env`:
```bash
pnpm install
pnpm db:migrate
ADMIN_EMAIL=you@example.com ADMIN_USERNAME=you ADMIN_PASSWORD='…' pnpm db:seed
```
Then sign in at `/login`, change your password in *Settings → Account*, and fill *Admin → Settings → Legal identity*.

After that, Vercel keeps the schema current by itself: a **production** build runs `pnpm --filter @marutime/db migrate:deploy` before `next build`, which applies any pending migrations. If a migration fails, the build fails and the previous deployment stays live. Preview builds share the production database, so they never migrate. Keep migrations additive (new tables, nullable or defaulted columns) so an instant rollback to the previous deployment still works against the newer schema.

> Migration `0002_import_jobs` adds the `import_jobs` table for TV Time and AniList imports; production builds on Vercel apply it automatically.

> Upgrading an existing install: migration `0001_cache_and_people` adds the `cache_entries` table (the shared cache), voice-actor columns on `characters`, and re-flags existing Chinese/Korean animation (donghua such as *Link Click*) as anime. On Vercel the production build applies it; elsewhere run `pnpm db:migrate` before starting this release, because title pages read the new `characters` columns.

### Free-tier notes
- Images are served straight from TMDB and R2, so no Vercel image optimisation quota is used.
- The serverless body limit is 4.5 MB; the uploader downsizes images in the browser first.
- Neon autosuspends after inactivity; the first request after a pause takes about a second.
- Cron runs daily; backups older than the `backup.retentionDays` admin setting are pruned.

## 2. Docker (self-hosted)

```bash
cp .env.example .env     # set APP_URL, SESSION_SECRET, CRON_SECRET, TMDB_ACCESS_TOKEN, STORAGE_PROVIDER=local
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml --profile tools run --rm tools pnpm db:migrate
docker compose -f docker/docker-compose.yml --profile tools run --rm tools pnpm db:seed
```
- `web` serves on port 3000. Put Caddy, Traefik or Nginx with TLS in front.
- Uploads live in the `uploads` volume and are served from `/api/uploads/*`.
- `pgbackup` writes a nightly `pg_dump` into the `pg-backups` volume (14-day retention). The `cron` service also triggers the app's own logical backup and the metadata sync.
- Restore: `docker compose -f docker/docker-compose.yml --profile tools run --rm tools pnpm restore --id <backup id> --yes`.

## 3. Operations cheat sheet

| Task | How |
| --- | --- |
| Manual backup | Admin → Backups → *Run backup now*, or `pnpm backup` |
| Download a backup | Admin → Backups → download icon |
| Restore | `pnpm restore --id <id> --yes` (CLI only, on purpose) |
| Export a user's data (data subject request) | Admin → Users → menu → Export data |
| Reset a user's password without email | Admin → Users → menu → Set temporary password |
| Rotate secrets | Change `SESSION_SECRET` (signs everyone out) and redeploy |
| Health check | `GET /api/health` |
