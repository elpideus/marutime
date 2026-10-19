'use server';

import { LISTS_CATEGORY_COOKIE, THEME_COOKIE } from '@marutime/config';
import { updatePreferences } from '@marutime/core';
import { getDb } from '@marutime/db';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/session';

const YEAR = 365 * 24 * 60 * 60;

export async function setThemeAction(theme: 'dark' | 'light'): Promise<void> {
  (await cookies()).set(THEME_COOKIE, theme, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  const user = await getCurrentUser();
  if (user) await updatePreferences(getDb(), user.id, { theme }).catch(() => {});
}

/** The lists feed remembers the category you picked, on this device and in your account. */
export async function setListsCategoryAction(category: 'shows' | 'movies' | 'anime'): Promise<void> {
  (await cookies()).set(LISTS_CATEGORY_COOKIE, category, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  const user = await getCurrentUser();
  if (user) await updatePreferences(getDb(), user.id, { listsCategory: category }).catch(() => {});
}
