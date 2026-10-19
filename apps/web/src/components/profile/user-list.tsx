import type { PublicUser } from '@marutime/db';
import { Avatar, Island } from '@marutime/ui';
import Link from 'next/link';
import { FollowButton } from './follow-button';

export function UserList({ users, viewerId, following }: { users: PublicUser[]; viewerId: string | null; following: Set<string> }) {
  if (users.length === 0) return <Island className="py-10 text-center text-sm text-fg-muted">Nobody here yet.</Island>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {users.map((u) => (
        <li key={u.id}>
          <Island padding="sm" className="flex items-center gap-3">
            <Link href={`/u/${u.username}`}>
              <Avatar src={u.avatarUrl} name={u.displayName} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/u/${u.username}`} className="block truncate text-sm font-semibold text-fg hover:text-accent">{u.displayName}</Link>
              <p className="truncate text-xs text-fg-muted">@{u.username}{u.bio ? ` · ${u.bio}` : ''}</p>
            </div>
            {viewerId && viewerId !== u.id ? <FollowButton userId={u.id} following={following.has(u.id)} signedIn size="sm" /> : null}
          </Island>
        </li>
      ))}
    </ul>
  );
}
