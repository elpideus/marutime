'use client';

import { cn } from '@marutime/ui';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { springs } from '@marutime/ui';

export type NavItem = { href: string; label: string; icon: ReactNode; exact?: boolean; badge?: number };

export function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact || href === '/') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({ item, layoutId = 'sidebar-active' }: { item: NavItem; layoutId?: string }) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href, item.exact);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        active ? 'text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {active ? <motion.span layoutId={layoutId} transition={springs.bouncy} className="absolute inset-0 rounded-control bg-surface-2 ring-1 ring-border" /> : null}
      <span className={cn('relative z-10 [&>svg]:size-5', active && 'text-accent')}>{item.icon}</span>
      <span className="relative z-10 flex-1 truncate">{item.label}</span>
      {item.badge ? <span className="relative z-10 rounded-pill bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-on-accent tabular-nums">{item.badge > 99 ? '99+' : item.badge}</span> : null}
    </Link>
  );
}
