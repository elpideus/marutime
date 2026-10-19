import { getListBySlug } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Island } from '@marutime/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ListForm } from '@/components/lists/list-form';
import { PageHeader } from '@/components/page-header';
import { isStaff, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Edit list' };

export default async function EditListPage({ params }: { params: Promise<{ username: string; slug: string }> }) {
  const { username, slug } = await params;
  const user = await requireUser(`/u/${username}/lists/${slug}/edit`);
  const found = await getListBySlug(getDb(), username, slug);
  if (!found) notFound();
  if (found.list.ownerId !== user.id && !isStaff(user)) redirect(`/u/${username}/lists/${slug}`);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit list" description={found.list.title} />
      <Island padding="lg">
        <ListForm list={found.list} ownerUsername={found.owner.username} />
      </Island>
    </div>
  );
}
