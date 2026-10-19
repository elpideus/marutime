import { randomBytes } from 'node:crypto';
import type { ZodType } from 'zod';
import { errors } from './errors';

export function shortId(bytes = 9): string {
  return randomBytes(bytes).toString('base64url');
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function clampPage(page: unknown, max = 500): number {
  const n = Number(page);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), max);
}

export function clampLimit(limit: unknown, fallback = 20, max = 100): number {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/** Parse with zod and convert failures into an AppError with per-field details. */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  const first = result.error.issues[0];
  throw errors.validation(first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', details);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'untitled';
}

export function safeUrl(input: string): string | null {
  try {
    const u = new URL(input.startsWith('http') ? input : `https://${input}`);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.toString();
  } catch {
    return null;
  }
}
