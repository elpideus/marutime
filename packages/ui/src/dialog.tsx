'use client';

import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';
import { cn } from './cn';
import { useIsClient } from './floating';
import { exitFast, springs } from './motion';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Hide the close button (e.g. blocking flows). */
  dismissible?: boolean;
  className?: string;
};

const sizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', '2xl': 'sm:max-w-6xl' } as const;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. Bottom sheet on phones, centred card on larger screens.
 * Traps focus, closes on Escape / backdrop, restores focus on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 10);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
        if (nodes.length === 0) return;
        const first = nodes[0]!;
        const last = nodes[nodes.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [dismissible, onClose],
  );

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="presentation" onKeyDown={onKeyDown}>
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={dismissible ? onClose : undefined}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 56, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97, transition: exitFast }}
            transition={springs.elastic}
            className={cn(
              'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-island border border-border bg-surface shadow-2xl outline-none sm:rounded-island',
              sizes[size],
              className,
            )}
          >
            <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border-strong sm:hidden" aria-hidden />
            {(title || dismissible) && (
              <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:px-6 sm:pt-5">
                <div className="min-w-0">
                  {title ? (
                    <h2 id={titleId} className="text-lg font-semibold tracking-tight text-fg">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                      {description}
                    </p>
                  ) : null}
                </div>
                {dismissible ? (
                  <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1">
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
            {footer ? <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-2/60 px-5 py-3 sm:px-6 pb-[max(env(safe-area-inset-bottom),12px)]">{footer}</div> : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
