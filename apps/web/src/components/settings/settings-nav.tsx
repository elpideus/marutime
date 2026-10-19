'use client';

import { Tabs } from '@marutime/ui';
import { usePathname, useRouter } from 'next/navigation';

const ITEMS = [
  { value: '/settings', label: 'Profile' },
  { value: '/settings/account', label: 'Account' },
  { value: '/settings/privacy', label: 'Privacy & preferences' },
  { value: '/settings/keyboard', label: 'Keyboard' },
  { value: '/settings/data', label: 'Your data' },
  { value: '/settings/tokens', label: 'API tokens' },
];

export function SettingsNav({ showApiTokens }: { showApiTokens: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = showApiTokens ? ITEMS : ITEMS.filter((i) => i.value !== '/settings/tokens');
  const value = items.find((i) => i.value === pathname)?.value ?? '/settings';
  return <Tabs value={value} items={items} onChange={(v) => router.push(v)} aria-label="Settings sections" />;
}
