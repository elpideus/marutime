import type { Character } from '@marutime/db';
import { img } from '@marutime/metadata/images';
import { Island, IslandHeader } from '@marutime/ui';

export function CastStrip({ characters, title = 'Characters' }: { characters: Character[]; title?: string }) {
  if (characters.length === 0) return null;
  return (
    <Island>
      <IslandHeader title={title} description="Pick your favourite when you check in" />
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 no-scrollbar">
        {characters.map((c) => {
          const src = c.imageUrl ?? img.profile(c.profilePath, 'w185');
          return (
            <li key={c.id} className="w-24 shrink-0 text-center">
              <div className="mx-auto size-20 overflow-hidden rounded-full bg-surface-3 ring-1 ring-border">
                {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : <span className="flex size-full items-center justify-center text-xl font-semibold text-fg-muted">{c.name[0]}</span>}
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium leading-tight text-fg">{c.name}</p>
              {c.actorName ? <p className="mt-0.5 line-clamp-1 text-[11px] text-fg-subtle">{c.actorName}</p> : null}
            </li>
          );
        })}
      </ul>
    </Island>
  );
}
