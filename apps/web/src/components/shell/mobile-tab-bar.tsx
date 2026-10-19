'use client';

import type { PublicUser } from '@marutime/db';
import { Avatar, cn, springs } from '@marutime/ui';
import { Compass, House, ListVideo, Search, Tv } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActivePath } from './nav-link';

export function MobileTabBar({ user }: { user: PublicUser | null }) {
  const pathname = usePathname();
  const items = [
    { href: '/', label: 'Home', icon: <House />, exact: true },
    { href: '/discover', label: 'Discover', icon: <Compass /> },
    { href: '/search', label: 'Search', icon: <Search /> },
    user ? { href: '/shows', label: 'Shows', icon: <Tv /> } : { href: '/lists', label: 'Lists', icon: <ListVideo /> },
    user ? { href: `/u/${user.username}`, label: 'You', icon: <Avatar src={user.avatarUrl} name={user.displayName} size="xs" /> } : { href: '/login', label: 'Sign in', icon: <Avatar name="?" size="xs" /> },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/85 backdrop-blur-xl lg:hidden" aria-label="Primary" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, item.exact);
          return (
            <li key={item.href} className="relative">
              <Link href={item.href} aria-current={active ? 'page' : undefined} className={cn('relative flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium', active ? 'text-accent' : 'text-fg-subtle')}>
                {active ? <motion.span layoutId="tab-dot" transition={springs.bouncy} className="absolute top-1 h-1 w-6 rounded-full bg-accent" /> : null}
                <span className="[&>svg]:size-5">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
