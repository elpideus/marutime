import 'server-only';

import { headers } from 'next/headers';

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? null;
}

export async function getUserAgent(): Promise<string | null> {
  return (await headers()).get('user-agent');
}

/** Basic same-origin check for cookie-authenticated route handlers. */
export function isSameOrigin(request: Request, appUrl: string): boolean {
  const origin = request.headers.get('origin') ?? request.headers.get('referer');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin || new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
