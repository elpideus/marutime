'use client';

import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { springs } from './motion';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
export type ToastInput = { title: ReactNode; description?: ReactNode; tone?: ToastTone; duration?: number; action?: { label: string; onClick: () => void } };
type Toast = ToastInput & { id: number };

type ToastContextValue = { toast: (t: ToastInput) => void; dismiss: (id: number) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastTone, ReactNode> = {
  success: <CircleCheck className="size-5 text-success" />,
  error: <CircleX className="size-5 text-danger" />,
  info: <Info className="size-5 text-info" />,
  warning: <TriangleAlert className="size-5 text-accent" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-3), { ...input, id }]);
      const duration = input.duration ?? (input.tone === 'error' ? 6000 : 3800);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.14 } }}
              transition={springs.bouncy}
              className={cn('pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[18px] border border-border bg-surface-2/95 p-3.5 shadow-2xl backdrop-blur-xl')}
              role="status"
            >
              <span className="mt-0.5 shrink-0">{icons[t.tone ?? 'info']}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-fg">{t.title}</div>
                {t.description ? <div className="mt-0.5 text-xs text-fg-muted">{t.description}</div> : null}
                {t.action ? (
                  <button type="button" onClick={() => { t.action?.onClick(); dismiss(t.id); }} className="mt-2 text-xs font-semibold text-accent hover:underline">
                    {t.action.label}
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="-m-1 rounded-md p-1 text-fg-subtle hover:text-fg" aria-label="Dismiss">
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
