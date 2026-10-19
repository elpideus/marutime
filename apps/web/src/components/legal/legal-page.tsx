import { getSettings } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Island } from '@marutime/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';

export async function legalContext() {
  const s = await getSettings(getDb());
  return {
    siteName: s['site.name'],
    controller: s['legal.controllerName'] || '[Controller name not set in admin settings]',
    email: s['legal.controllerEmail'] || '[Contact email not set in admin settings]',
    address: s['legal.controllerAddress'] || '',
    country: s['legal.country'] || '',
    updated: 'October 2026',
  };
}

export function LegalLayout({ title, description, updated, children }: { title: string; description?: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Legal" title={title} description={description} />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm" aria-label="Legal pages">
        {[
          ['/legal/privacy', 'Privacy'],
          ['/legal/terms', 'Terms'],
          ['/legal/cookies', 'Cookies'],
          ['/legal/imprint', 'Imprint'],
        ].map(([href, label]) => (
          <Link key={href} href={href!} className="rounded-pill border border-border px-3 py-1 text-fg-muted hover:text-fg">
            {label}
          </Link>
        ))}
      </nav>
      <Island padding="lg" className="prose-legal">
        <p className="mb-6 text-xs text-fg-subtle">Last updated: {updated}</p>
        {children}
      </Island>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-8 mb-2 text-lg font-semibold tracking-tight text-fg first:mt-0">{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-fg-muted">{children}</p>;
}
export function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-muted">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
