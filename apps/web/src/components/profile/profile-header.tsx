import type { ProfileView } from '@marutime/core';
import { SOCIAL_PLATFORMS } from '@marutime/config';
import { Avatar, Badge, Button, Island } from '@marutime/ui';
import { Globe, Lock, Pencil, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { FollowButton } from './follow-button';
import { formatDate, formatWatchTime } from '@/lib/format';

export function ProfileHeader({ profile, signedIn }: { profile: ProfileView; signedIn: boolean }) {
  const { user, stats, viewer } = profile;
  const platformLabel = (id: string) => SOCIAL_PLATFORMS.find((p) => p.id === id)?.label ?? id;
  return (
    <Island padding="none" className="overflow-hidden">
      <div className="relative h-40 bg-surface-3 sm:h-56">
        {user.coverUrl ? <img src={user.coverUrl} alt="" className="size-full object-cover" /> : <div className="size-full bg-gradient-to-br from-accent/30 via-surface-3 to-surface" />}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
      </div>
      <div className="relative px-5 pb-5 sm:px-7 sm:pb-7">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar src={user.avatarUrl} name={user.displayName} size="2xl" ring className="shrink-0 shadow-float" />
            <div className="min-w-0 pb-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                {user.displayName}
                {user.role !== 'user' ? <Badge tone="accent">{user.role}</Badge> : null}
                {profile.visibility !== 'public' ? <Lock className="size-4 text-fg-subtle" aria-label="Private profile" /> : null}
              </h1>
              <p className="text-sm text-fg-muted">@{user.username} · joined {formatDate(user.createdAt, { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:pb-1">
            {viewer.isSelf ? (
              <Link href="/settings">
                <Button variant="secondary" tabIndex={-1}>
                  <Pencil className="size-4" /> Edit profile
                </Button>
              </Link>
            ) : (
              <FollowButton userId={user.id} following={viewer.isFollowing} signedIn={signedIn} />
            )}
          </div>
        </div>
        {user.bio ? <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg whitespace-pre-line">{user.bio}</p> : null}
        {user.favoriteCharacterName ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-pill border border-accent/30 bg-accent-soft px-3 py-1 text-sm text-fg">
            {user.favoriteCharacterImageUrl ? <img src={user.favoriteCharacterImageUrl} alt="" className="size-6 rounded-full object-cover" /> : <Sparkles className="size-4 text-accent" />}
            <span className="text-fg-muted">Favorite character ever:</span> <span className="font-medium">{user.favoriteCharacterName}</span>
          </p>
        ) : null}
        {user.socialLinks.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {user.socialLinks.map((l) => (
              <li key={l.platform + l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer me" className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-3 py-1 text-xs text-fg-muted hover:border-border-strong hover:text-fg">
                  <Globe className="size-3" /> {l.label ?? platformLabel(l.platform)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Episodes', value: stats.episodes.toLocaleString() },
            { label: 'Movies', value: stats.movies.toLocaleString() },
            { label: 'Time watched', value: formatWatchTime(stats.minutes) },
            { label: 'Followers', value: stats.followers.toLocaleString(), href: `/u/${user.username}/followers` },
            { label: 'Following', value: stats.following.toLocaleString(), href: `/u/${user.username}/following` },
          ].map((s) => (
            <div key={s.label} className="rounded-card border border-border bg-surface-2 px-3 py-2.5">
              <dt className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{s.href ? <Link href={s.href} className="hover:text-fg">{s.label}</Link> : s.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-fg tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Island>
  );
}
