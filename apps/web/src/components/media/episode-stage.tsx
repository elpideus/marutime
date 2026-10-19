'use client';

import { Tooltip, cn } from '@marutime/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ViewTransition, type ReactNode } from 'react';
import { useCommands } from '@/components/keyboard/command-palette';
import { useShortcut } from '@/components/keyboard/shortcut-provider';

export type StageEpisode = { id: number; code: string; name: string | null; still: string | null; href: string };

/** Transition types used by episode-to-episode navigation (see globals.css). */
export const EP_NEXT = 'ep-next';
export const EP_PREV = 'ep-prev';

const directional = {
  enter: { [EP_NEXT]: 'ep-enter-from-right', [EP_PREV]: 'ep-enter-from-left', default: 'none' },
  exit: { [EP_NEXT]: 'ep-exit-to-left', [EP_PREV]: 'ep-exit-to-right', default: 'none' },
};

/**
 * Episode hero laid out like a carousel. On desktop the previous and next
 * episodes peek in at the edges; hovering one reveals an arrow, clicking it
 * navigates, and the browser's view transition morphs the peeking still into
 * the hero (and the hero into the opposite peek) on an elastic curve. Every
 * still is named by episode id, so the same picture is one continuous object.
 */
export function EpisodeStage({ current, prev, next, still, info }: { current: StageEpisode; prev: StageEpisode | null; next: StageEpisode | null; still: ReactNode; info: ReactNode }) {
  const router = useRouter();
  const goNext = next ? () => router.push(next.href, { scroll: false, transitionTypes: [EP_NEXT] }) : null;
  const goPrev = prev ? () => router.push(prev.href, { scroll: false, transitionTypes: [EP_PREV] }) : null;
  useShortcut('episode.next', goNext);
  useShortcut('episode.prev', goPrev);
  useCommands([
    ...(next && goNext ? [{ id: 'ep-next', group: 'This page', title: `Next episode: ${next.code}`, subtitle: next.name ?? undefined, shortcutId: 'episode.next', perform: goNext }] : []),
    ...(prev && goPrev ? [{ id: 'ep-prev', group: 'This page', title: `Previous episode: ${prev.code}`, subtitle: prev.name ?? undefined, shortcutId: 'episode.prev', perform: goPrev }] : []),
  ]);
  return (
    <section className="relative flex items-stretch gap-3 lg:gap-4" aria-label="Episode">
      <Peek side="left" episode={prev} />
      <div className="grid min-w-0 flex-1 gap-6 lg:grid-cols-5">
        <ViewTransition name={`ep-still-${current.id}`} share="ep-morph" default="none">
          <div className="relative overflow-hidden rounded-island border border-border bg-surface-3 lg:col-span-3">{still}</div>
        </ViewTransition>
        <ViewTransition key={current.id} {...directional} default="none">
          <div className="flex flex-col justify-center gap-4 lg:col-span-2">{info}</div>
        </ViewTransition>
      </div>
      <Peek side="right" episode={next} />
    </section>
  );
}

function Peek({ side, episode }: { side: 'left' | 'right'; episode: StageEpisode | null }) {
  // Keep the grid symmetric even at the first or last episode.
  if (!episode) return <div className="hidden w-14 shrink-0 lg:block" aria-hidden />;
  const Arrow = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <Tooltip content={`${side === 'left' ? 'Previous' : 'Next'}: ${episode.code}${episode.name ? ` · ${episode.name}` : ''}`} side={side === 'left' ? 'right' : 'left'} className="hidden shrink-0 lg:flex">
      <Link
        href={episode.href}
        prefetch
        scroll={false}
        transitionTypes={[side === 'left' ? EP_PREV : EP_NEXT]}
        aria-label={`${side === 'left' ? 'Previous' : 'Next'} episode, ${episode.code}`}
        className="group/peek relative flex w-14 items-center overflow-hidden rounded-island outline-none transition-[width] duration-700 ease-spring hover:w-24 focus-visible:w-24 focus-visible:ring-2 focus-visible:ring-accent/70"
      >
        {/* The named element is exactly the visible box, so nothing escapes its clipping mid-morph. */}
        <ViewTransition name={`ep-still-${episode.id}`} share="ep-morph" default="none">
          <div className="absolute inset-0 overflow-hidden rounded-island border border-border bg-surface-3">
            <div className={cn('absolute inset-y-0 w-[min(56vw,720px)]', side === 'left' ? 'right-0' : 'left-0')}>
              {episode.still ? <img src={episode.still} alt="" className="size-full object-cover" loading="lazy" decoding="async" /> : null}
            </div>
            {/* Dimming lives inside the named element so it cross-fades during the morph. */}
            <span className="absolute inset-0 bg-bg/55 transition-colors duration-500 group-hover/peek:bg-bg/20 group-focus-visible/peek:bg-bg/20" aria-hidden />
          </div>
        </ViewTransition>
        <span
          className={cn(
            'absolute top-1/2 flex size-10 -translate-y-1/2 scale-50 items-center justify-center rounded-full border border-border-strong bg-surface-2/90 text-fg opacity-0 shadow-float backdrop-blur-xl transition-[opacity,scale,translate] duration-500 ease-bounce group-hover/peek:scale-100 group-hover/peek:opacity-100 group-focus-visible/peek:scale-100 group-focus-visible/peek:opacity-100',
            side === 'left' ? 'left-1/2 -translate-x-1/2 group-hover/peek:-translate-x-[60%]' : 'left-1/2 -translate-x-1/2 group-hover/peek:-translate-x-[40%]',
          )}
          aria-hidden
        >
          <Arrow className="size-5" />
        </span>
      </Link>
    </Tooltip>
  );
}

/** Wraps below-the-hero content so it slides with episode navigation. */
export function EpisodeContentTransition({ episodeId, children }: { episodeId: number; children: ReactNode }) {
  return (
    <ViewTransition key={episodeId} {...directional} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}

/** Small previous/next links for phones and tablets, where nothing peeks. */
export function EpisodeStepper({ prev, next }: { prev: StageEpisode | null; next: StageEpisode | null }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm lg:hidden">
      {prev ? (
        <Link href={prev.href} scroll={false} transitionTypes={[EP_PREV]} className="inline-flex items-center gap-1 text-fg-muted transition-colors hover:text-fg">
          <ChevronLeft className="size-4" /> {prev.code}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} scroll={false} transitionTypes={[EP_NEXT]} className="cta-arrow inline-flex items-center gap-1 text-fg-muted transition-colors hover:text-fg">
          {next.code} <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}
