import { getActiveDevices, getActiveServices } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Island, IslandHeader } from '@marutime/ui';
import type { Metadata } from 'next';
import { PreferencesForm } from '@/components/settings/preferences-form';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Privacy & preferences' };

export default async function PrivacySettingsPage() {
  const user = await requireUser('/settings/privacy');
  const db = getDb();
  const [devices, services] = await Promise.all([getActiveDevices(db), getActiveServices(db)]);
  return (
    <Island>
      <IslandHeader title="Privacy & preferences" description="Where and how you watch is never shown next to your name. These settings control the rest." />
      <PreferencesForm preferences={user.preferences} devices={devices} services={services} />
    </Island>
  );
}
