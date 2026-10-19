import { runMigrations } from './migrate';

/**
 * Runs before `next build`. Production deploys on Vercel apply pending
 * migrations first, so a release and the schema it reads ship together; a
 * failed migration fails the build and the previous deployment stays live.
 * Preview builds share the production database, so they never migrate.
 * Elsewhere set MIGRATE_ON_BUILD=1 to opt in.
 */
const enabled = process.env.VERCEL_ENV === 'production' || process.env.MIGRATE_ON_BUILD === '1';

if (!enabled) {
  console.log('Skipping migrations (not a production deploy).');
} else {
  runMigrations().catch((err) => {
    console.error('Migration failed, aborting the build:', err);
    process.exit(1);
  });
}
