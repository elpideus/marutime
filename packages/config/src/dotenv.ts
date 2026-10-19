import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Load the nearest `.env` file (walking up from cwd) into process.env without
 * overriding variables that are already set. Used by CLI scripts; Next.js
 * loads env files on its own.
 */
export function loadDotenv(startDir = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.env');
    if (existsSync(candidate)) {
      const before = { ...process.env };
      try {
        process.loadEnvFile(candidate);
      } catch {
        return null;
      }
      for (const [k, v] of Object.entries(before)) if (v !== undefined) process.env[k] = v;
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
