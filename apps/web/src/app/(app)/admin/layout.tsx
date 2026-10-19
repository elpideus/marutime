import { countOpenReports } from '@marutime/core';
import { getDb } from '@marutime/db';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/admin-nav';
import { PageHeader } from '@/components/page-header';
import { requireStaff } from '@/lib/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireStaff();
  const open = await countOpenReports(getDb());
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Admin" title="Dashboard" description={`Signed in as ${user.displayName} (${user.role}).`} />
      <AdminNav openReports={open} />
      {children}
    </div>
  );
}
