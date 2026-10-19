import { Island } from '@marutime/ui';
import type { Metadata } from 'next';
import { ListForm } from '@/components/lists/list-form';
import { PageHeader } from '@/components/page-header';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'New list' };

export default async function NewListPage({ searchParams }: { searchParams: Promise<{ media?: string }> }) {
  await requireUser('/lists/new');
  const sp = await searchParams;
  const mediaId = Number(sp.media);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New list" description="Lists can be public, followers-only, unlisted (secret link) or private." />
      <Island padding="lg">
        <ListForm mediaId={Number.isFinite(mediaId) && mediaId > 0 ? mediaId : undefined} />
      </Island>
    </div>
  );
}
