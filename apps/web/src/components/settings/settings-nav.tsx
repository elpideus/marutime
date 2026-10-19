'use client';

import { Tabs } from '@marutime/ui';
import { usePathname, useRouter } from 'next/navigation';

const ITEMS = [
  { value: '/settings', label: 'Profile' },
  { value: '/settings/account', label: 'Account' },
  { value: '/settings/privacy', label: 'Privacy & preferences' },
  { value: '/settings/data', label: 'Your data' },
  { value: '/settings/tokens', label: 'API tokens' },
];

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();
  const value = ITEMS.find((i) => i.value === pathname)?.value ?? '/settings';
  return <Tabs value={value} items={ITEMS} onChange={(v) => router.push(v)} aria-label="Settings sections" />;
}
