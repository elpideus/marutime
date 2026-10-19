import 'server-only';

import { clearedSessionCookie, sessionCookie, validateSession } from '@marutime/auth';
import { SESSION_COOKIE } from '@marutime/config';
import { getDb, type Session, type User } from '@marutime/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

export const getCurrentSession = cache(async (): Promise<{ session: Session; user: User } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await validateSession(getDb(), token);
  } catch (err) {
    console.error('[session] validation failed', err);
    return null;
  }
});

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const s = await getCurrentSession();
  return s?.user ?? null;
});

export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login');
  if (user.status === 'suspended') redirect('/suspended');
  return user;
}

export function isStaff(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'moderator';
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser('/admin');
  if (!isStaff(user)) redirect('/');
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser('/admin');
  if (user.role !== 'admin') redirect('/admin');
  return user;
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = sessionCookie(token);
  (await cookies()).set(c.name, c.value, { httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite, path: c.path, maxAge: c.maxAge });
}

export async function clearSessionCookie(): Promise<void> {
  const c = clearedSessionCookie();
  (await cookies()).set(c.name, '', { httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite, path: c.path, maxAge: 0 });
}

export async function currentSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}
