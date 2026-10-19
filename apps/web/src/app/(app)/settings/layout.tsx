import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { SettingsNav } from '@/components/settings/settings-nav';
import { requireUser } from '@/lib/session';

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireUser('/settings');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="Settings" />
      <SettingsNav />
      {children}
    </div>
  );
}
