import { listMediaAdmin } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, Input } from '@marutime/ui';
import Link from 'next/link';
import { MediaTable } from '@/components/admin/media-table';

export default async function AdminMediaPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; type?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const type = sp.type === 'show' || sp.type === 'movie' ? sp.type : 'all';
  const { items, total } = await listMediaAdmin(getDb(), { q: sp.q, page, type });
  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap gap-2" action="/admin/media">
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="Search by title or TMDB id" className="max-w-sm" />
        <select name="type" defaultValue={type} className="h-11 rounded-control border border-border bg-surface-2 px-3 text-sm text-fg">
          <option value="all">All</option><option value="show">Shows</option><option value="movie">Movies</option>
        </select>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <MediaTable items={items} />
      <div className="flex items-center justify-between text-sm text-fg-muted">
        <span>{total} titles imported · the sync cron refreshes airing shows people follow every day</span>
        <span className="flex gap-2">
          {page > 1 ? <Link href={`/admin/media?q=${encodeURIComponent(sp.q ?? '')}&type=${type}&page=${page - 1}`}><Button size="sm" variant="secondary" tabIndex={-1}>Previous</Button></Link> : null}
          <span className="self-center">Page {page} / {pages}</span>
          {page < pages ? <Link href={`/admin/media?q=${encodeURIComponent(sp.q ?? '')}&type=${type}&page=${page + 1}`}><Button size="sm" variant="secondary" tabIndex={-1}>Next</Button></Link> : null}
        </span>
      </div>
    </div>
  );
}
