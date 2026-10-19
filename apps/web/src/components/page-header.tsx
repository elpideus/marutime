import { cn } from '@marutime/ui';
import type { ReactNode } from 'react';

export function PageHeader({ title, description, action, eyebrow, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-semibold tracking-wide text-accent uppercase">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-fg text-balance sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-fg-muted sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
