import 'server-only';

import { isAppError } from '@marutime/core';
import { unstable_rethrow } from 'next/navigation';

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string; details?: Record<string, string[]> };

/** Run a server action body and normalise errors for the client. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    if (isAppError(err)) return { ok: false, error: err.message, code: err.code, details: err.details };
    console.error('[action]', err);
    return { ok: false, error: 'Something went wrong. Please try again.', code: 'internal' };
  }
}

export function fieldError(result: ActionResult<unknown>, field: string): string | undefined {
  if (result.ok) return undefined;
  return result.details?.[field]?.[0];
}
