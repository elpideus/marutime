import { Island } from '@marutime/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shell/logo';

export function AuthCard({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8">
        <Logo />
      </div>
      <Island padding="lg" className="w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </Island>
      {footer ? <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div> : null}
      <div className="mt-8 flex gap-4 text-xs text-fg-subtle">
        <Link href="/legal/privacy" className="hover:text-fg-muted">Privacy</Link>
        <Link href="/legal/terms" className="hover:text-fg-muted">Terms</Link>
        <Link href="/" className="hover:text-fg-muted">Back home</Link>
      </div>
    </div>
  );
}
