'use client';

import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { springs } from './motion';

type MenuContextValue = { open: boolean; setOpen: (v: boolean) => void; id: string };
const MenuContext = createContext<MenuContextValue | null>(null);

export function Menu({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <MenuContext.Provider value={{ open, setOpen, id }}>
      <div ref={ref} className={cn('relative inline-block', className)}>
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

export function MenuTrigger({ children }: { children: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; 'aria-controls': string }) => ReactNode }) {
  const { open, setOpen, id } = useMenu();
  const onClick = useCallback(() => setOpen(!open), [open, setOpen]);
  return <>{children({ onClick, 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-controls': id })}</>;
}

export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end'; className?: string }) {
  const { open, id } = useMenu();
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          id={id}
          role="menu"
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } }}
          transition={springs.bouncy}
          style={{ originY: 0, originX: align === 'end' ? 1 : 0 }}
          className={cn('absolute z-40 mt-2 min-w-48 overflow-hidden rounded-[18px] border border-border bg-surface-2 p-1.5 shadow-2xl', align === 'end' ? 'right-0' : 'left-0', className)}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function MenuItem({ children, onSelect, destructive, disabled, className, icon }: { children: ReactNode; onSelect?: () => void; destructive?: boolean; disabled?: boolean; className?: string; icon?: ReactNode }) {
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
        'flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-surface-3 disabled:opacity-50',
        destructive ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-surface-3',
        className,
      )}
    >
      {icon ? <span className="text-fg-muted [&>svg]:size-4">{icon}</span> : null}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{children}</div>;
}
