import { loadDotenv } from '@marutime/config/dotenv';
import { defineConfig } from 'drizzle-kit';

loadDotenv();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://marutime:marutime@127.0.0.1:5432/marutime',
  },
  strict: true,
  verbose: true,
});
