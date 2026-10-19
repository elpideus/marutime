import type { PublicUser } from '@marutime/db';
import { Bell, Bookmark, Compass, House, ListVideo, Settings, Shield, Tv, Users } from 'lucide-react';
import Link from 'next/link';
import { DonationCard } from './donation-card';
import { Logo } from './logo';
import { NavLink, type NavItem } from './nav-link';

export type SidebarProps = {
  user: PublicUser | null;
  unread: number;
  staff: boolean;
  donation: { enabled: boolean; url: string; title: string; message: string } | null;
};

export function Sidebar({ user, unread, staff, donation }: SidebarProps) {
  const items: NavItem[] = user
    ? [
        { href: '/', label: 'Home', icon: <House />, exact: true },
        { href: '/discover', label: 'Discover', icon: <Compass /> },
        { href: '/shows', label: 'My shows', icon: <Tv /> },
        { href: '/watchlist', label: 'Watchlist', icon: <Bookmark /> },
        { href: '/lists', label: 'Lists', icon: <ListVideo /> },
        { href: '/feed', label: 'Friends', icon: <Users /> },
        { href: '/notifications', label: 'Notifications', icon: <Bell />, badge: unread },
      ]
    : [
        { href: '/', label: 'Home', icon: <House />, exact: true },
        { href: '/discover', label: 'Discover', icon: <Compass /> },
        { href: '/lists', label: 'Lists', icon: <ListVideo /> },
      ];
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-bg px-4 py-5 lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <nav className="mt-7 flex flex-col gap-1" aria-label="Primary">
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
      {user ? (
        <nav className="mt-4 flex flex-col gap-1 border-t border-border pt-4" aria-label="Account">
          <NavLink item={{ href: '/settings', label: 'Settings', icon: <Settings /> }} />
          {staff ? <NavLink item={{ href: '/admin', label: 'Admin', icon: <Shield /> }} /> : null}
        </nav>
      ) : null}
      <div className="mt-auto flex flex-col gap-4">
        {donation?.enabled ? <DonationCard donation={donation} compact /> : null}
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-[11px] text-fg-subtle">
          <Link href="/legal/privacy" className="hover:text-fg-muted">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-fg-muted">Terms</Link>
          <Link href="/legal/cookies" className="hover:text-fg-muted">Cookies</Link>
          <Link href="/legal/imprint" className="hover:text-fg-muted">Imprint</Link>
          <Link href="/about" className="hover:text-fg-muted">About</Link>
        </div>
      </div>
    </aside>
  );
}
