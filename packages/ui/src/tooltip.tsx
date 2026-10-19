'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { useFloating, useIsClient, type Side } from './floating';
import { exitFast, springs } from './motion';

export type TooltipProps = {
  /** What the control does. Short, sentence case, no trailing period. */
  content: ReactNode;
  /** Optional keyboard shortcut shown after the text. */
  shortcut?: string[];
  side?: Side;
  /** Hover delay in ms before showing. Focus shows immediately. */
  delay?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

// Once one tooltip has been seen, neighbours open instantly (like macOS).
let warmUntil = 0;

/**
 * Hover/focus hint for controls whose purpose is not obvious from their look
 * alone (icon buttons, toggles, chips). Never shown for touch input.
 */
export function Tooltip({ content, shortcut, side = 'top', delay = 450, disabled, className, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const pos = useFloating(anchorRef, floatingRef, { open, side, align: 'center', offset: 8 });
  const isClient = useIsClient();

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback(
    (immediate: boolean) => {
      clear();
      if (disabled) return;
      if (immediate || Date.now() < warmUntil) setOpen(true);
      else timer.current = setTimeout(() => setOpen(true), delay);
    },
    [delay, disabled],
  );
  const hide = useCallback(() => {
    clear();
    setOpen((was) => {
      if (was) warmUntil = Date.now() + 500;
      return false;
    });
  }, []);

  useEffect(() => () => clear(), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hide]);

  return (
    <span
      ref={anchorRef}
      className={cn('inline-flex', className)}
      aria-describedby={open ? id : undefined}
      onPointerEnter={(e) => e.pointerType !== 'touch' && show(false)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        // Only keyboard focus: mouse clicks already show it on hover.
        if ((e.target as HTMLElement).matches?.(':focus-visible')) show(true);
      }}
      onBlur={hide}
    >
      {children}
      {isClient
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={floatingRef}
                  id={id}
                  role="tooltip"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: pos.ready ? 1 : 0, scale: pos.ready ? 1 : 0.85 }}
                  exit={{ opacity: 0, scale: 0.92, transition: exitFast }}
                  transition={springs.pop}
                  style={{ ...pos.style, transformOrigin: pos.origin }}
                  className="pointer-events-none z-[80] flex max-w-64 items-center gap-2 rounded-[10px] border border-border-strong bg-surface-3/95 px-2.5 py-1.5 text-xs font-medium text-fg shadow-float backdrop-blur-xl"
                >
                  <span className="min-w-0">{content}</span>
                  {shortcut?.length ? (
                    <span className="flex shrink-0 items-center gap-0.5">
                      {shortcut.map((k) => (
                        <kbd key={k} className="rounded-[5px] border border-border-strong bg-surface-2 px-1 font-sans text-[10px] leading-4 text-fg-muted">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </span>
  );
}
