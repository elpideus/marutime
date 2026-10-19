import { LISTS_CATEGORY_COOKIE, type MediaCategory } from '@marutime/config';
import { discoverSections } from '@marutime/core';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CategoryTabs } from '@/components/media/category-tabs';
import { MediaRow } from '@/components/media/media-row';
import { PageHeader } from '@/components/page-header';
import { cardFromSummary } from '@/lib/media-card';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Discover' };

function pickCategory(value: string | undefined, fallback: string | undefined): MediaCategory {
  const v = value ?? fallback;
  return v === 'movies' || v === 'anime' ? v : 'shows';
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const cookieCategory = (await cookies()).get(LISTS_CATEGORY_COOKIE)?.value ?? user?.preferences.listsCategory;
  const category = pickCategory(sp.c, cookieCategory);
  const sections = await discoverSections(category).catch(() => []);
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Discover" description="Trending, airing and all-time favourites. Pick a lane; MaruTime remembers it." action={<CategoryTabs value={category} />} />
      {sections.length === 0 ? <p className="text-sm text-fg-muted">The metadata service is unavailable right now. Try again in a minute.</p> : null}
      {sections.map((s) => (
        <MediaRow key={s.key} title={s.title} items={s.items.map(cardFromSummary)} emptyText="Nothing to show here right now." />
      ))}
    </div>
  );
}
