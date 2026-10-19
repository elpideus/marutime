import { getEnv } from '@marutime/config';
import { getListBySlug, getListView } from '@marutime/core';
import { getDb } from '@marutime/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListDetail } from '@/components/lists/list-detail';
import { getCurrentUser } from '@/lib/session';

type Props = { params: Promise<{ username: string; slug: string }>; searchParams: Promise<{ t?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const found = await getListBySlug(getDb(), username, slug);
  if (!found || found.list.visibility !== 'public') return { title: 'List', robots: { index: false } };
  return { title: `${found.list.title} by ${found.owner.displayName}`, description: found.list.description ?? undefined };
}

export default async function ListPage({ params, searchParams }: Props) {
  const [{ username, slug }, sp] = await Promise.all([params, searchParams]);
  const db = getDb();
  const found = await getListBySlug(db, username, slug);
  if (!found) notFound();
  const user = await getCurrentUser();
  const view = await getListView(db, found.list, user, sp.t);
  if (!view) notFound();
  return <ListDetail view={view} signedIn={Boolean(user)} appUrl={getEnv().APP_URL} />;
}
