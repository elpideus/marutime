'use client';

import type { CharacterView, PersonView, WorkView } from '@marutime/core';
import { Button, Dialog, Input, Segmented, Skeleton, cn, springs } from '@marutime/ui';
import { ArrowLeft, ExternalLink, Mic, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TypeLabel } from '@/components/media/type-badge';
import type { CastMember } from '@/lib/cast';

type Preview = { name: string; image: string | null; subtitle?: string | null };

export type PeopleEntry =
  | { kind: 'person'; source: 'tmdb' | 'anilist'; id: number; preview?: Preview }
  | { kind: 'character'; id: number; mediaAnilistId?: number | null; preview?: Preview }
  | { kind: 'cast'; title: string; members: CastMember[]; mediaAnilistId?: number | null };

type PeopleApi = {
  open: (entry: PeopleEntry) => void;
  /** Open whatever best describes a cast member: the AniList character, or the actor. */
  openMember: (m: CastMember, mediaAnilistId?: number | null) => void;
  openActor: (m: CastMember) => void;
};

const PeopleContext = createContext<PeopleApi | null>(null);

export function usePeople(): PeopleApi {
  const ctx = useContext(PeopleContext);
  if (!ctx) throw new Error('usePeople must be used inside <PeopleProvider>');
  return ctx;
}

// Fetched views survive closing and reopening the modal within a session.
const viewCache = new Map<string, Promise<unknown>>();

function fetchView<T>(url: string): Promise<T> {
  let p = viewCache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as T;
    });
    p.catch(() => viewCache.delete(url));
    viewCache.set(url, p);
  }
  return p;
}

function memberEntry(m: CastMember, mediaAnilistId?: number | null): PeopleEntry | null {
  if (m.source === 'anilist' && m.characterId) return { kind: 'character', id: m.characterId, mediaAnilistId, preview: { name: m.name, image: m.image, subtitle: m.actorName } };
  if (m.actorSource && m.actorId) return { kind: 'person', source: m.actorSource, id: m.actorId, preview: { name: m.actorName ?? m.name, image: m.actorImage, subtitle: m.actorName ? `as ${m.name}` : null } };
  return null;
}

/**
 * One modal for everything cast related. Opening something from inside it
 * (a voice actor from a character, a character from the full cast) pushes onto
 * a stack with a Back button, sliding in like a navigation controller.
 */
export function PeopleProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<PeopleEntry[]>([]);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [open, setOpen] = useState(false);

  const openEntry = useCallback((entry: PeopleEntry) => {
    setDirection(1);
    setStack((s) => (open ? [...s, entry] : [entry]));
    setOpen(true);
  }, [open]);

  const api = useMemo<PeopleApi>(
    () => ({
      open: openEntry,
      openMember: (m, mediaAnilistId) => {
        const e = memberEntry(m, mediaAnilistId);
        if (e) openEntry(e);
      },
      openActor: (m) => {
        if (m.actorSource && m.actorId) openEntry({ kind: 'person', source: m.actorSource, id: m.actorId, preview: { name: m.actorName ?? m.name, image: m.actorImage, subtitle: `as ${m.name}` } });
      },
    }),
    [openEntry],
  );

  const top = stack[stack.length - 1];
  const back = () => {
    setDirection(-1);
    setStack((s) => s.slice(0, -1));
  };
  const close = () => setOpen(false);

  return (
    <PeopleContext.Provider value={api}>
      {children}
      <Dialog
        open={open && Boolean(top)}
        onClose={close}
        size="xl"
        title={
          stack.length > 1 ? (
            <button type="button" onClick={back} className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-sm font-medium text-fg-muted transition-colors hover:text-fg">
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : top?.kind === 'cast' ? (
            top.title
          ) : top?.kind === 'character' ? (
            'Character'
          ) : (
            'Person'
          )
        }
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          {top ? (
            <motion.div
              key={`${stack.length}:${top.kind}:${'id' in top ? top.id : top.title}`}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 48 }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: d * -48, transition: { duration: 0.14 } }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springs.smooth}
            >
              {top.kind === 'person' ? (
                <PersonPanel entry={top} onNavigate={close} />
              ) : top.kind === 'character' ? (
                <CharacterPanel entry={top} onNavigate={close} onPerson={(e) => openEntry(e)} />
              ) : (
                <CastPanel members={top.members} onPick={(m) => api.openMember(m, top.mediaAnilistId)} onActor={api.openActor} />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Dialog>
    </PeopleContext.Provider>
  );
}

function useView<T>(url: string): { data: T | null; error: boolean } {
  const [state, setState] = useState<{ url: string; data: T | null; error: boolean }>({ url, data: null, error: false });
  useEffect(() => {
    let alive = true;
    fetchView<T>(url).then(
      (data) => alive && setState({ url, data, error: false }),
      () => alive && setState({ url, data: null, error: true }),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return state.url === url ? state : { data: null, error: false };
}

function Header({ image, name, nativeName, subtitle, facts, links, round }: { image: string | null; name: string; nativeName?: string | null; subtitle?: string | null; facts?: Array<{ label: string; value: string }>; links?: Array<{ label: string; href: string }>; round?: boolean }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <motion.div layoutId={undefined} className={cn('w-28 shrink-0 overflow-hidden bg-surface-3 ring-1 ring-border sm:w-36', round ? 'aspect-square rounded-full' : 'aspect-[2/3] rounded-card')}>
        {image ? <img src={image} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-3xl font-semibold text-fg-muted">{name[0]}</span>}
      </motion.div>
      <div className="min-w-0 flex-1">
        <h3 className="text-2xl font-semibold tracking-tight text-fg text-balance">{name}</h3>
        {nativeName ? <p className="mt-0.5 text-sm text-fg-muted">{nativeName}</p> : null}
        {subtitle ? <p className="mt-1 text-sm text-accent">{subtitle}</p> : null}
        {facts?.length ? (
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-xs text-fg-subtle">{f.label}</dt>
                <dd className="truncate text-fg">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {links?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-pill border border-border px-2.5 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg">
                {l.label} <ExternalLink className="size-3" />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Bio({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const long = text.length > 420;
  return (
    <section className="mt-6">
      <p className={cn('whitespace-pre-line text-sm leading-relaxed text-fg-muted', long && !expanded && 'line-clamp-5')}>{text}</p>
      {long ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-sm font-medium text-accent hover:underline">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      ) : null}
    </section>
  );
}

function PanelSkeleton({ preview, round }: { preview?: Preview; round?: boolean }) {
  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className={cn('w-28 shrink-0 overflow-hidden bg-surface-3 sm:w-36', round ? 'aspect-square rounded-full' : 'aspect-[2/3] rounded-card')}>{preview?.image ? <img src={preview.image} alt="" className="size-full object-cover" /> : null}</div>
        <div className="flex-1">
          {preview ? <h3 className="text-2xl font-semibold tracking-tight text-fg">{preview.name}</h3> : <Skeleton className="h-7 w-1/2 rounded-md" />}
          {preview?.subtitle ? <p className="mt-1 text-sm text-accent">{preview.subtitle}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 rounded-md" />
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="mt-6 h-20 rounded-card" />
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="aspect-[2/3] rounded-card" />
        ))}
      </div>
    </div>
  );
}

function Failed() {
  return <p className="py-10 text-center text-sm text-fg-muted">Could not load this right now. Try again in a moment.</p>;
}

const KIND_LABEL = { all: 'All', show: 'Shows', movie: 'Movies', anime: 'Anime', manga: 'Manga' } as const;

function Works({ title, works, onNavigate }: { title: string; works: WorkView[]; onNavigate: () => void }) {
  const kinds = Array.from(new Set(works.map((w) => w.kind)));
  const [filter, setFilter] = useState<'all' | WorkView['kind']>('all');
  const [limit, setLimit] = useState(20);
  if (works.length === 0) return null;
  const shown = works.filter((w) => filter === 'all' || w.kind === filter);
  return (
    <section className="mt-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-fg">
          {title} <span className="font-normal text-fg-subtle tabular-nums">{works.length}</span>
        </h4>
        {kinds.length > 1 ? <Segmented size="sm" value={filter} onChange={(v) => setFilter(v)} items={(['all', ...kinds] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }))} aria-label="Filter works" /> : null}
      </div>
      <motion.ul layout className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.slice(0, limit).map((w) => (
            <motion.li key={w.key} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springs.bouncy}>
              <Link href={w.href} onClick={onNavigate} className="group block outline-none">
                <div className="lift relative aspect-[2/3] overflow-hidden rounded-card bg-surface-3 ring-1 ring-border transition-[box-shadow] group-hover:ring-border-strong group-focus-visible:ring-2 group-focus-visible:ring-accent/70">
                  {w.image ? <img src={w.image} alt="" className="size-full object-cover" loading="lazy" /> : <span className="flex size-full items-end p-2 text-xs font-semibold text-fg-muted">{w.title}</span>}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight text-fg group-hover:text-accent">{w.title}</p>
                {w.role ? <p className="line-clamp-1 text-[11px] text-fg-muted">{w.role}</p> : null}
                <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                  {w.year ? <span>{w.year}</span> : null}
                  {w.kind === 'manga' ? <span>Manga</span> : <TypeLabel type={w.kind === 'movie' ? 'movie' : 'show'} isAnime={w.kind === 'anime'} />}
                  {w.note ? <span className="truncate">· {w.note}</span> : null}
                </p>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
      {shown.length > limit ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + 20)}>
            Show more
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function PersonPanel({ entry, onNavigate }: { entry: Extract<PeopleEntry, { kind: 'person' }>; onNavigate: () => void }) {
  const { data, error } = useView<PersonView>(`/api/people/${entry.source}/${entry.id}`);
  if (error) return <Failed />;
  if (!data) return <PanelSkeleton preview={entry.preview} />;
  return (
    <div>
      <Header image={data.image} name={data.name} nativeName={data.nativeName} subtitle={entry.preview?.subtitle ?? data.knownFor} facts={data.facts} links={data.links} />
      <Bio text={data.bio} />
      <Works title={entry.source === 'anilist' ? 'Roles' : 'Known for'} works={data.works} onNavigate={onNavigate} />
    </div>
  );
}

function CharacterPanel({ entry, onNavigate, onPerson }: { entry: Extract<PeopleEntry, { kind: 'character' }>; onNavigate: () => void; onPerson: (e: PeopleEntry) => void }) {
  const { data, error } = useView<CharacterView>(`/api/characters/${entry.id}${entry.mediaAnilistId ? `?media=${entry.mediaAnilistId}` : ''}`);
  if (error) return <Failed />;
  if (!data) return <PanelSkeleton preview={entry.preview} round />;
  return (
    <div>
      <Header image={data.image} name={data.name} nativeName={data.nativeName} subtitle={data.alternativeNames.length ? `Also ${data.alternativeNames.slice(0, 3).join(', ')}` : null} facts={data.facts} links={data.links} round />
      <Bio text={data.bio} />
      {data.voiceActors.length ? (
        <section className="mt-7">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
            <Mic className="size-4 text-fg-muted" /> Voiced by
          </h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.voiceActors.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onPerson({ kind: 'person', source: 'anilist', id: v.id, preview: { name: v.name, image: v.image, subtitle: `Voice of ${data.name}` } })}
                  className="group flex w-full items-center gap-3 rounded-card border border-border bg-surface-2 p-2 text-left transition-colors duration-200 hover:border-border-strong hover:bg-surface-3"
                >
                  <span className="size-11 shrink-0 overflow-hidden rounded-full bg-surface-3">{v.image ? <img src={v.image} alt="" className="size-full object-cover" loading="lazy" /> : null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg group-hover:text-accent">{v.name}</span>
                    <span className="block truncate text-xs text-fg-subtle">{[v.language, v.nativeName].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Works title="Appears in" works={data.appearances} onNavigate={onNavigate} />
    </div>
  );
}

function CastPanel({ members, onPick, onActor }: { members: CastMember[]; onPick: (m: CastMember) => void; onActor: (m: CastMember) => void }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = term ? members.filter((m) => m.name.toLowerCase().includes(term) || m.actorName?.toLowerCase().includes(term)) : members;
  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a character or actor" className="pl-10" aria-label="Filter cast" data-autofocus />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {shown.map((m) => (
          <li key={m.id} className="flex flex-col items-center rounded-card border border-border bg-surface-2/50 p-3 text-center">
            <button type="button" onClick={() => onPick(m)} className="group flex flex-col items-center outline-none" aria-label={`About ${m.name}`}>
              <span className="size-20 overflow-hidden rounded-full bg-surface-3 ring-1 ring-border transition-[box-shadow,transform] duration-500 ease-spring group-hover:scale-105 group-hover:ring-accent/60 group-focus-visible:ring-2 group-focus-visible:ring-accent">
                {m.image ? <img src={m.image} alt="" className="size-full object-cover" loading="lazy" /> : <span className="flex size-full items-center justify-center text-xl font-semibold text-fg-muted">{m.name[0]}</span>}
              </span>
              <span className="mt-2 line-clamp-2 text-xs font-medium leading-tight text-fg group-hover:text-accent">{m.name}</span>
            </button>
            {m.actorName ? (
              m.actorSource ? (
                <button type="button" onClick={() => onActor(m)} className="mt-0.5 line-clamp-1 text-[11px] text-fg-subtle transition-colors hover:text-fg">
                  {m.actorName}
                </button>
              ) : (
                <span className="mt-0.5 line-clamp-1 text-[11px] text-fg-subtle">{m.actorName}</span>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="py-8 text-center text-sm text-fg-muted">Nobody matches “{q}”.</p> : null}
    </div>
  );
}
