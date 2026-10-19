'use client';

import { Island, IslandHeader } from '@marutime/ui';
import { ChevronRight } from 'lucide-react';
import { usePeople } from '@/components/people/people-provider';
import type { CastMember } from '@/lib/cast';

/** Compact vertical cast list (e.g. an episode's guest stars); each row opens the person. */
export function CastList({ title, members, limit = 8 }: { title: string; members: CastMember[]; limit?: number }) {
  const people = usePeople();
  if (members.length === 0) return null;
  return (
    <Island>
      <IslandHeader title={title} />
      <ul className="-mx-2 flex flex-col">
        {members.slice(0, limit).map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => people.openMember(m)} className="group flex w-full items-center gap-3 rounded-control px-2 py-1.5 text-left text-sm transition-colors duration-200 hover:bg-surface-2">
              <span className="size-9 shrink-0 overflow-hidden rounded-full bg-surface-3">{m.actorImage ?? m.image ? <img src={(m.actorImage ?? m.image)!} alt="" className="size-full object-cover" loading="lazy" /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{m.actorName ?? m.name}</span>
                <span className="block truncate text-xs text-fg-subtle">{m.actorName ? `as ${m.name}` : null}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-fg-subtle transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
      {members.length > limit ? (
        <button type="button" onClick={() => people.open({ kind: 'cast', title, members })} className="mt-2 text-sm font-medium text-accent hover:underline">
          See all {members.length}
        </button>
      ) : null}
    </Island>
  );
}
