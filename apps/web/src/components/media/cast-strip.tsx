'use client';

import { Button, Island, IslandHeader } from '@marutime/ui';
import { Maximize2 } from 'lucide-react';
import { usePeople } from '@/components/people/people-provider';
import { ScrollRow } from '@/components/scroll-row';
import type { CastMember } from '@/lib/cast';

/**
 * Characters (or cast) carousel with arrows. Tapping a character opens their
 * page (AniList characters) or the actor's; tapping the actor's name always
 * opens the actor. "View all" opens the full, searchable cast.
 */
export function CastStrip({ members, title = 'Characters', mediaAnilistId }: { members: CastMember[]; title?: string; mediaAnilistId?: number | null }) {
  const people = usePeople();
  if (members.length === 0) return null;
  return (
    <Island>
      <IslandHeader
        title={title}
        description={`${members.length} ${members.length === 1 ? 'person' : 'people'} · tap for details`}
        action={
          <Button variant="ghost" size="sm" onClick={() => people.open({ kind: 'cast', title, members, mediaAnilistId })} tooltip={`See the whole ${title.toLowerCase()} list`}>
            <Maximize2 className="size-3.5" /> View all
          </Button>
        }
      />
      <ScrollRow label={title.toLowerCase()} innerClassName="-mx-1 gap-3 px-1 pb-1">
        {members.map((m) => (
          <div key={m.id} className="w-24 shrink-0 snap-start text-center">
            <button type="button" onClick={() => people.openMember(m, mediaAnilistId)} className="group flex w-full flex-col items-center outline-none" aria-label={`About ${m.name}`}>
              <span className="size-20 overflow-hidden rounded-full bg-surface-3 ring-1 ring-border transition-[box-shadow,scale] duration-500 ease-spring group-hover:scale-105 group-hover:ring-accent/60 group-focus-visible:ring-2 group-focus-visible:ring-accent">
                {m.image ? <img src={m.image} alt="" className="size-full object-cover" loading="lazy" /> : <span className="flex size-full items-center justify-center text-xl font-semibold text-fg-muted">{m.name[0]}</span>}
              </span>
              <span className="mt-2 line-clamp-2 text-xs font-medium leading-tight text-fg transition-colors group-hover:text-accent">{m.name}</span>
            </button>
            {m.actorName ? (
              m.actorSource ? (
                <button type="button" onClick={() => people.openActor(m)} className="mt-0.5 line-clamp-1 w-full text-[11px] text-fg-subtle transition-colors hover:text-fg">
                  {m.actorName}
                </button>
              ) : (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-fg-subtle">{m.actorName}</p>
              )
            ) : null}
          </div>
        ))}
      </ScrollRow>
    </Island>
  );
}
