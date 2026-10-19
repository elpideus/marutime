import { getEnv } from '@marutime/config';
import { getListByShareToken, getListView } from '@marutime/core';
import { getDb } from '@marutime/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListDetail } from '@/components/lists/list-detail';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Shared list', robots: { index: false, follow: false } };

/** Secret-link access for unlisted lists. */
export default async function SharedListPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const list = await getListByShareToken(db, token);
  if (!list) notFound();
  const user = await getCurrentUser();
  const view = await getListView(db, list, user, token);
  if (!view) notFound();
  return <ListDetail view={view} signedIn={Boolean(user)} appUrl={getEnv().APP_URL} />;
}
