import { THEME_COOKIE } from '@marutime/config';
import { getActiveDevices, getActiveServices, getDonationConfig, getUnreadNotificationCount, isApiAvailable, toPublicUser } from '@marutime/core';
import { getDb } from '@marutime/db';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { CommandPaletteProvider } from '@/components/keyboard/command-palette';
import { ShortcutProvider } from '@/components/keyboard/shortcut-provider';
import { PeopleProvider } from '@/components/people/people-provider';
import { CheckInProvider } from '@/components/tracking/check-in-provider';
import { getCurrentUser, isStaff } from '@/lib/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const db = getDb();
  const user = await getCurrentUser();
  const [unread, donation, devices, services, apiTokens] = await Promise.all([
    user ? getUnreadNotificationCount(db, user.id) : Promise.resolve(0),
    getDonationConfig(db).catch(() => null),
    user ? getActiveDevices(db) : Promise.resolve([]),
    user ? getActiveServices(db) : Promise.resolve([]),
    user ? isApiAvailable(db, user) : Promise.resolve(false),
  ]);
  const theme = (await cookies()).get(THEME_COOKIE)?.value === 'light' ? 'light' : 'dark';
  const sidebarDonation = donation && donation.placements.includes('sidebar') ? { enabled: donation.enabled, url: donation.url, title: donation.title, message: donation.message } : null;
  const defaults = user ? { deviceId: user.preferences.defaultDeviceId ?? null, serviceId: user.preferences.defaultServiceId ?? null } : undefined;
  return (
    <CheckInProvider signedIn={Boolean(user)} devices={devices} services={services} defaults={defaults}>
      <ShortcutProvider custom={user?.preferences.keybindings} username={user?.username ?? null} theme={theme}>
        <CommandPaletteProvider signedIn={Boolean(user)} staff={isStaff(user)} username={user?.username ?? null} preferences={user?.preferences ?? null} apiTokens={apiTokens}>
          <PeopleProvider>
            <AppShell user={user ? toPublicUser(user) : null} staff={isStaff(user)} unread={unread} theme={theme} donation={sidebarDonation}>
              {children}
            </AppShell>
          </PeopleProvider>
        </CommandPaletteProvider>
      </ShortcutProvider>
    </CheckInProvider>
  );
}
