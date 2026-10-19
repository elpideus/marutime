import { THEME_COOKIE } from '@marutime/config';
import { getDonationConfig, getUnreadNotificationCount, toPublicUser } from '@marutime/core';
import { getDb } from '@marutime/db';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getCurrentUser, isStaff } from '@/lib/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const db = getDb();
  const user = await getCurrentUser();
  const [unread, donation] = await Promise.all([user ? getUnreadNotificationCount(db, user.id) : Promise.resolve(0), getDonationConfig(db).catch(() => null)]);
  const theme = (await cookies()).get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';
  const sidebarDonation = donation && donation.placements.includes('sidebar') ? { enabled: donation.enabled, url: donation.url, title: donation.title, message: donation.message } : null;
  return (
    <AppShell user={user ? toPublicUser(user) : null} staff={isStaff(user)} unread={unread} theme={theme} donation={sidebarDonation}>
      {children}
    </AppShell>
  );
}
