'use client';

import { Tooltip, buttonClasses, cn, springs, type ButtonSize } from '@marutime/ui';
import { Pencil, Repeat } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCommands } from '@/components/keyboard/command-palette';
import { useShortcut, useShortcutKeys } from '@/components/keyboard/shortcut-provider';
import { watchKey, type CheckInCharacter, type CheckInInitial, type CheckInTarget } from '@/lib/check-in';
import { useCheckIn } from './check-in-provider';
import { useWatchState } from './watch-store';

export type WatchedButtonProps = {
  target: CheckInTarget;
  /** Server-rendered state and the server time it was rendered at. */
  watched: boolean;
  watchCount?: number;
  serverAt: number;
  /** Prefill for "edit" when the page already has it (otherwise loaded on demand). */
  lastWatch?: CheckInInitial | null;
  characters?: CheckInCharacter[];
  guestCharacters?: CheckInCharacter[];
  size?: 'sm' | 'md' | 'lg';
  /** `full` adds separate Edit and Rewatch buttons; `row` adds an icon-only Edit (for lists); `compact` is the toggle alone. */
  variant?: 'full' | 'row' | 'compact';
  className?: string;
};

/**
 * The watched toggle. One tap marks it watched (instantly, then saved in the
 * background) and opens the optional check-in sheet; tapping "Watched" marks
 * it unwatched again, with an Undo toast. While the server works the button
 * shows a soft sweep instead of blocking.
 */
export function WatchedButton({ target, watched, watchCount, serverAt, lastWatch, characters, guestCharacters, size = 'md', variant = 'full', className }: WatchedButtonProps) {
  const checkIn = useCheckIn();
  const state = useWatchState(watchKey(target), { count: watched ? Math.max(1, watchCount ?? 1) : 0 }, serverAt);
  const isWatched = state.count > 0;
  const sheet = { characters, guestCharacters };

  const toggle = () => {
    if (isWatched) checkIn.unwatch(target, state.count);
    else checkIn.markWatched(target, sheet);
  };
  const edit = () => checkIn.edit(target, state.count, { ...sheet, initial: lastWatch ?? undefined });
  const rewatch = () => checkIn.rewatch(target, state.count, sheet);

  // The page's main watched button answers the keyboard and the command bar.
  const primary = variant === 'full' && checkIn.signedIn;
  useShortcut('title.watched', primary ? toggle : null);
  useShortcut('title.edit', primary && isWatched ? edit : null);
  useShortcut('title.rewatch', primary && isWatched ? rewatch : null);
  const watchedKeys = useShortcutKeys('title.watched');
  useCommands(
    primary
      ? [
          { id: 'watched', group: 'This page', title: isWatched ? `Mark ${target.label} as unwatched` : `Mark ${target.label} as watched`, shortcutId: 'title.watched', perform: toggle },
          ...(isWatched
            ? [
                { id: 'edit', group: 'This page', title: 'Edit your check-in', subtitle: target.label, shortcutId: 'title.edit', perform: edit },
                { id: 'rewatch', group: 'This page', title: 'Log a rewatch', subtitle: target.label, shortcutId: 'title.rewatch', perform: rewatch },
              ]
            : []),
        ]
      : null,
  );

  const iconSize: ButtonSize = size === 'lg' ? 'icon-lg' : size === 'sm' ? 'icon-sm' : 'icon';

  return (
    <div className={cn('flex items-center gap-2', variant === 'row' && 'gap-1.5', className)}>
      {variant === 'row' ? (
        // Left of the toggle, so the toggle stays put when this appears.
        <AnimatePresence initial={false}>
          {isWatched ? (
            <motion.div key="edit" initial={{ opacity: 0, scale: 0.5, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.12 } }} transition={springs.bouncy}>
              <Tooltip content="Edit your check-in">
                <motion.button type="button" whileTap={{ scale: 0.88 }} transition={springs.snappy} onClick={edit} aria-label={`Edit your check-in for ${target.label}`} className={buttonClasses({ variant: 'ghost', size: iconSize })}>
                  <Pencil className="size-4" />
                </motion.button>
              </Tooltip>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}
      <Tooltip content={isWatched ? (state.count > 1 ? `Watched ${state.count} times. Click to mark as unwatched` : 'Click to mark as unwatched') : 'Mark as watched'} shortcut={primary ? watchedKeys : undefined} disabled={!checkIn.signedIn}>
        <WatchToggle watched={isWatched} count={state.count} pending={Boolean(state.pending)} size={size} compact={variant !== 'full'} onClick={toggle} />
      </Tooltip>
      {variant === 'full' ? (
        <AnimatePresence initial={false}>
          {isWatched ? (
            <motion.div
              key="extras"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, x: -10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -6, scale: 0.92, transition: { duration: 0.14 } }}
              transition={springs.bouncy}
            >
              <Tooltip content="Edit your check-in: rating, feelings, device, favourite character">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  transition={springs.snappy}
                  onClick={edit}
                  className={buttonClasses({ variant: 'secondary', size })}
                >
                  <Pencil className="size-4" /> Edit
                </motion.button>
              </Tooltip>
              <Tooltip content="Log a rewatch">
                <motion.button type="button" whileTap={{ scale: 0.9 }} transition={springs.snappy} onClick={rewatch} aria-label="Log a rewatch" className={buttonClasses({ variant: 'ghost', size: iconSize })}>
                  <Repeat className="size-4" />
                </motion.button>
              </Tooltip>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : null}
    </div>
  );
}

/** The morphing pill: outline circle ↔ filled check, label and count animate in place. */
export function WatchToggle({ watched, count, pending, size, compact, onClick }: { watched: boolean; count: number; pending: boolean; size: 'sm' | 'md' | 'lg'; compact?: boolean; onClick: () => void }) {
  const label = watched ? 'Watched' : compact ? 'Mark watched' : 'Mark watched';
  return (
    <motion.button
      type="button"
      layout
      onClick={onClick}
      aria-pressed={watched}
      aria-busy={pending || undefined}
      whileTap={{ scale: 0.94 }}
      transition={springs.bouncy}
      className={cn(
        buttonClasses({ variant: watched ? 'accent-soft' : compact ? 'secondary' : 'primary', size }),
        'overflow-hidden',
        watched && 'ring-1 ring-inset ring-accent/25',
      )}
    >
      <motion.span layout="position" className="relative inline-flex size-4 items-center justify-center">
        <AnimatePresence initial={false} mode="popLayout">
          {watched ? (
            <motion.svg key="check" viewBox="0 0 24 24" className="size-4" initial={{ scale: 0.3, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.1 } }} transition={springs.pop} aria-hidden>
              <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.18" />
              <motion.path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.05 }} />
            </motion.svg>
          ) : (
            <motion.svg key="circle" viewBox="0 0 24 24" className="size-4" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.1 } }} transition={springs.pop} aria-hidden>
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={label} layout="position" initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(3px)', transition: { duration: 0.12 } }} transition={springs.smooth}>
          {label}
        </motion.span>
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {watched && count > 1 ? (
          <motion.span key="count" layout="position" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} transition={springs.pop} className="rounded-pill bg-accent/20 px-1.5 text-[11px] font-semibold tabular-nums">
            ×{count}
          </motion.span>
        ) : null}
      </AnimatePresence>
      {/* Server still working: a soft sweep instead of a spinner. */}
      <AnimatePresence>
        {pending ? (
          <motion.span
            key="sweep"
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            initial={{ x: '-120%', opacity: 0 }}
            animate={{ x: ['-120%', '260%'], opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ x: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.2 } }}
          />
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
}
