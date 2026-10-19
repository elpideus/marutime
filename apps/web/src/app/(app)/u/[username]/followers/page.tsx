import { getFollowStateForUsers, getFollowers, getProfile } from '@marutime/core';
import { getDb } from '@marutime/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { UserList } from '@/components/profile/user-list';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Followers' };

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const db = getDb();
  const viewer = await getCurrentUser();
  const profile = await getProfile(db, username, viewer?.id ?? null);
  if (!profile) notFound();
  const users = profile.viewer.canViewContent ? await getFollowers(db, profile.user.id, 100) : [];
  const following = viewer ? await getFollowStateForUsers(db, viewer.id, users.map((u) => u.id)) : new Set<string>();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={<Link href={`/u/${profile.user.username}`}>@{profile.user.username}</Link>} title="Followers" description={`${users.length} people`} />
      <UserList users={users} viewerId={viewer?.id ?? null} following={following} />
    </div>
  );
}
