import { LISTS_CATEGORY_COOKIE, type MediaCategory } from '@marutime/config';
import { getListsFeed, type ListsFeedSort } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, EmptyState } from '@marutime/ui';
import { ListVideo, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ListCard } from '@/components/lists/list-card';
import { ListsSortTabs } from '@/components/lists/lists-sort-tabs';
import { CategoryTabs } from '@/components/media/category-tabs';
import { PageHeader } from '@/components/page-header';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Lists' };

export default async function ListsPage({ searchParams }: { searchParams: Promise<{ c?: string; sort?: string; page?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const cookieCategory = (await cookies()).get(LISTS_CATEGORY_COOKIE)?.value ?? user?.preferences.listsCategory;
  const raw = sp.c ?? cookieCategory;
  const category: MediaCategory = raw === 'movies' || raw === 'anime' ? raw : 'shows';
  const sort: ListsFeedSort = sp.sort === 'new' || sp.sort === 'trending' ? sp.sort : 'popular';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const feed = await getListsFeed(getDb(), { category, sort, page, viewerId: user?.id ?? null });
  const qs = (p: number) => `/lists?c=${category}&sort=${sort}&page=${p}`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lists"
        description="Curated by people, ranked by love. Pick a category and MaruTime keeps it selected."
        action={
          user ? (
            <Link href="/lists/new">
              <Button tabIndex={-1}>
                <Plus className="size-4" /> New list
              </Button>
            </Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoryTabs value={category} />
        <ListsSortTabs value={sort} />
      </div>
      {feed.items.length === 0 ? (
        <EmptyState icon={<ListVideo />} title={`No ${category} lists yet`} description="Be the first to publish one. Public lists with at least one title appear here." action={user ? <Link href="/lists/new"><Button tabIndex={-1}>Create a list</Button></Link> : <Link href="/register"><Button tabIndex={-1}>Join to create lists</Button></Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {feed.items.map((card) => (
            <ListCard key={card.list.id} card={card} signedIn={Boolean(user)} />
          ))}
        </div>
      )}
      {(page > 1 || feed.hasMore) && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 ? <Link href={qs(page - 1)}><Button variant="secondary" size="sm" tabIndex={-1}>Previous</Button></Link> : null}
          <span className="text-sm text-fg-muted">Page {page}</span>
          {feed.hasMore ? <Link href={qs(page + 1)}><Button variant="secondary" size="sm" tabIndex={-1}>Next</Button></Link> : null}
        </div>
      )}
    </div>
  );
}
