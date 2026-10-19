'use client';

import { Tabs } from '@marutime/ui';
import { usePathname, useRouter } from 'next/navigation';

const ITEMS = [
  { value: '/admin', label: 'Overview' },
  { value: '/admin/users', label: 'Users' },
  { value: '/admin/reports', label: 'Reports' },
  { value: '/admin/media', label: 'Titles' },
  { value: '/admin/catalog', label: 'Devices & services' },
  { value: '/admin/settings', label: 'Settings' },
  { value: '/admin/backups', label: 'Backups' },
  { value: '/admin/audit', label: 'Audit log' },
];

export function AdminNav({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const value = ITEMS.find((i) => i.value !== '/admin' && pathname.startsWith(i.value))?.value ?? '/admin';
  return <Tabs value={value} items={ITEMS.map((i) => (i.value === '/admin/reports' && openReports ? { ...i, count: openReports } : i))} onChange={(v) => router.push(v)} aria-label="Admin sections" />;
}
