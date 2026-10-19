import type { FeedItem } from '@marutime/core';
import { episodeHref, mediaHref } from '@marutime/core/hrefs';
import { Avatar, cn } from '@marutime/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Poster } from '@/components/media/poster';
import { episodeCode, formatRelative } from '@/lib/format';

function describe(item: FeedItem): ReactNode {
  const { activity, media, episode, list, targetUser } = item;
  const mediaLink = media ? (
    <Link href={mediaHref(media)} className="font-medium text-fg hover:text-accent">
      {media.title}
    </Link>
  ) : null;
  switch (activity.type) {
    case 'watched_episode': {
      const bulk = (activity.meta as { bulkCount?: number }).bulkCount;
      return (
        <>
          watched {bulk && bulk > 1 ? `${bulk} episodes of ` : ''}
          {mediaLink}
          {episode && !bulk ? (
            <>
              {' '}
              <Link href={episodeHref(media!, episode.seasonNumber, episode.episodeNumber)} className="text-accent hover:underline">
                {episodeCode(episode.seasonNumber, episode.episodeNumber)}
              </Link>
            </>
          ) : null}
        </>
      );
    }
    case 'watched_movie':
      return <>watched {mediaLink}</>;
    case 'started_show':
      return <>started watching {mediaLink}</>;
    case 'finished_show':
      return <>finished {mediaLink} 🎉</>;
    case 'added_watchlist':
      return <>wants to watch {mediaLink}</>;
    case 'created_list':
      return (
        <>
          created the list{' '}
          {list ? (
            <Link href={`/u/${item.user.username}/lists/${list.slug}`} className="font-medium text-fg hover:text-accent">
              {list.title}
            </Link>
          ) : null}
        </>
      );
    case 'liked_list':
      return <>liked a list{list ? <>: <span className="font-medium text-fg">{list.title}</span></> : null}</>;
    case 'followed_user':
      return (
        <>
          started following{' '}
          {targetUser ? (
            <Link href={`/u/${targetUser.username}`} className="font-medium text-fg hover:text-accent">
              {targetUser.displayName}
            </Link>
          ) : 'someone'}
        </>
      );
    case 'commented':
      return (
        <>
          commented on {mediaLink}
          {episode ? ` ${episodeCode(episode.seasonNumber, episode.episodeNumber)}` : ''}
          {(activity.meta as { isSpoiler?: boolean }).isSpoiler ? <span className="ml-1 rounded-pill bg-accent-soft px-1.5 text-[10px] font-semibold text-accent uppercase">spoiler</span> : null}
        </>
      );
    default:
      return null;
  }
}

export function ActivityItem({ item, className }: { item: FeedItem; className?: string }) {
  return (
    <li className={cn('flex items-start gap-3 py-3', className)}>
      <Link href={`/u/${item.user.username}`} data-nav-item className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/70">
        <Avatar src={item.user.avatarUrl} name={item.user.displayName} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 text-sm text-fg-muted">
        <Link href={`/u/${item.user.username}`} className="font-semibold text-fg hover:underline">
          {item.user.displayName}
        </Link>{' '}
        {describe(item)}
        <div className="mt-0.5 text-xs text-fg-subtle">{formatRelative(item.activity.createdAt)}</div>
      </div>
      {item.media ? (
        <Link href={mediaHref(item.media)} className="w-10 shrink-0 overflow-hidden rounded-[8px]">
          <Poster path={item.media.posterPath} title={item.media.title} size="w185" rounded="none" />
        </Link>
      ) : null}
    </li>
  );
}
