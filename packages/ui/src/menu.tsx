'use client';

import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { useFloating, useIsClient } from './floating';
import { exitFast, springs } from './motion';

type MenuContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  id: string;
  anchorRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  /** Focus the first item when the menu was opened from the keyboard. */
  focusFirst: RefObject<boolean>;
};
const MenuContext = createContext<MenuContextValue | null>(null);

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';

export function Menu({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpenState] = useState(false);
  const id = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);

  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (!v) focusFirst.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || contentRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, setOpen]);

  return (
    <MenuContext.Provider value={{ open, setOpen, id, anchorRef, contentRef, focusFirst }}>
      <div ref={anchorRef} className={cn('relative inline-block', className)}>
        {children}
      </div>
    </MenuContext.Provider>
  );
}

function useMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('Menu components must be used inside <Menu>');
  return ctx;
}

type TriggerProps = {
  onClick: () => void;
  onKeyDown: (e: ReactKeyboardEvent) => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu';
  'aria-controls': string;
};

export function MenuTrigger({ children }: { children: (props: TriggerProps) => ReactNode }) {
  const { open, setOpen, id, focusFirst } = useMenu();
  const onClick = useCallback(() => setOpen(!open), [open, setOpen]);
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusFirst.current = true;
        setOpen(true);
      }
    },
    [setOpen, focusFirst],
  );
  return <>{children({ onClick, onKeyDown, 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-controls': id })}</>;
}

export function MenuContent({ children, align = 'end', side = 'bottom', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; side?: 'top' | 'bottom'; className?: string }) {
  const { open, setOpen, id, anchorRef, contentRef, focusFirst } = useMenu();
  const pos = useFloating(anchorRef, contentRef, { open, side, align, offset: 8 });
  const isClient = useIsClient();

  useEffect(() => {
    if (!open || !pos.ready) return;
    const items = contentRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (focusFirst.current) items?.[0]?.focus();
    else contentRef.current?.focus({ preventScroll: true });
  }, [open, pos.ready, contentRef, focusFirst]);

  const close = (restore: boolean) => {
    setOpen(false);
    if (restore) anchorRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const items = Array.from(contentRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={contentRef}
          id={id}
          role="menu"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          initial={{ opacity: 0, scale: 0.9, y: pos.side === 'top' ? 6 : -6 }}
          animate={{ opacity: pos.ready ? 1 : 0, scale: pos.ready ? 1 : 0.9, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, transition: exitFast }}
          transition={springs.bouncy}
          style={{ ...pos.style, transformOrigin: pos.origin }}
          className={cn('z-[70] min-w-48 overflow-y-auto rounded-[16px] border border-border-strong bg-surface-2/95 p-1.5 shadow-float outline-none backdrop-blur-xl', className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function MenuItem({ children, onSelect, destructive, disabled, className, icon, shortcut, active }: { children: ReactNode; onSelect?: () => void; destructive?: boolean; disabled?: boolean; className?: string; icon?: ReactNode; shortcut?: ReactNode; active?: boolean }) {
  const { setOpen } = useMenu();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        setOpen(false);
      }}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm outline-none transition-colors duration-150 focus-visible:bg-surface-3 disabled:opacity-50',
        destructive ? 'text-danger hover:bg-danger/10 focus-visible:bg-danger/10' : 'text-fg hover:bg-surface-3',
        active && 'text-accent',
        className,
      )}
    >
      {icon ? <span className={cn('[&>svg]:size-4', destructive ? 'text-danger' : active ? 'text-accent' : 'text-fg-muted')}>{icon}</span> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {shortcut ? <span className="ml-3 text-[11px] text-fg-subtle">{shortcut}</span> : null}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{children}</div>;
}
