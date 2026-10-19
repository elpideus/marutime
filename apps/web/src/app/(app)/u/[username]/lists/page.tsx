import { getProfile, getUserLists } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, EmptyState } from '@marutime/ui';
import { ListVideo, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ListCard } from '@/components/lists/list-card';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Lists' };

export default async function UserListsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = getDb();
  const viewer = await getCurrentUser();
  const profile = await getProfile(db, username, viewer?.id ?? null);
  if (!profile) notFound();
  const lists = profile.viewer.canViewContent ? await getUserLists(db, profile.user.id, viewer) : [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={<Link href={`/u/${profile.user.username}`}>@{profile.user.username}</Link>} title={profile.viewer.isSelf ? 'Your lists' : `${profile.user.displayName}’s lists`} action={profile.viewer.isSelf ? <Link href="/lists/new"><Button tabIndex={-1}><Plus className="size-4" /> New list</Button></Link> : null} />
      {lists.length === 0 ? <EmptyState icon={<ListVideo />} title="No lists here" description={profile.viewer.isSelf ? 'Create your first list from any show or movie page, or start fresh.' : 'Nothing shared yet.'} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((card) => (
            <ListCard key={card.list.id} card={card} signedIn={Boolean(viewer)} />
          ))}
        </div>
      )}
    </div>
  );
}
