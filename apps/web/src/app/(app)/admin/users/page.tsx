import { listUsersAdmin } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Avatar, Badge, Button, Input, Island } from '@marutime/ui';
import Link from 'next/link';
import { UserActions } from '@/components/admin/user-actions';
import { formatDate, formatRelative } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string }> }) {
  const actor = await requireStaff();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const status = sp.status === 'suspended' || sp.status === 'active' ? sp.status : 'all';
  const { items, total } = await listUsersAdmin(getDb(), { q: sp.q, page, limit: 25, status });
  const pages = Math.max(1, Math.ceil(total / 25));
  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap gap-2" action="/admin/users">
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="Search username, name or email" className="max-w-sm" />
        <select name="status" defaultValue={status} className="h-11 rounded-control border border-border bg-surface-2 px-3 text-sm text-fg">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <Island padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-fg-subtle uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-surface-2/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/u/${u.username}`} className="flex items-center gap-2">
                      <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg">{u.displayName}</span>
                        <span className="block truncate text-xs text-fg-muted">@{u.username}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">
                    {u.email} {u.emailVerifiedAt ? null : <Badge tone="outline" className="ml-1">unverified</Badge>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={u.role === 'admin' ? 'accent' : u.role === 'moderator' ? 'info' : 'neutral'}>{u.role}</Badge>
                    {u.status === 'suspended' ? <Badge tone="danger" className="ml-1">suspended</Badge> : null}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-fg-muted">
                    {u.watchCount} check-ins · {u.commentCount} comments · {u.listCount} lists
                    <br />
                    {u.lastSeenAt ? `seen ${formatRelative(u.lastSeenAt)}` : 'never seen'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-fg-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <UserActions user={u} actorRole={actor.role} actorId={actor.id} />
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-fg-muted">No users match.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Island>
      <div className="flex items-center justify-between text-sm text-fg-muted">
        <span>{total} users</span>
        <span className="flex gap-2">
          {page > 1 ? <Link href={`/admin/users?q=${encodeURIComponent(sp.q ?? '')}&status=${status}&page=${page - 1}`}><Button size="sm" variant="secondary" tabIndex={-1}>Previous</Button></Link> : null}
          <span className="self-center">Page {page} / {pages}</span>
          {page < pages ? <Link href={`/admin/users?q=${encodeURIComponent(sp.q ?? '')}&status=${status}&page=${page + 1}`}><Button size="sm" variant="secondary" tabIndex={-1}>Next</Button></Link> : null}
        </span>
      </div>
    </div>
  );
}
