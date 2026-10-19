import type { PublicUser } from '@marutime/db';
import { Button } from '@marutime/ui';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CommandButton } from './command-button';
import { Logo } from './logo';
import { MobileTabBar } from './mobile-tab-bar';
import { SearchBar } from './search-bar';
import { Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

export type AppShellProps = {
  user: PublicUser | null;
  staff: boolean;
  unread: number;
  theme: 'dark' | 'light';
  donation: { enabled: boolean; url: string; title: string; message: string } | null;
  children: ReactNode;
};

export function AppShell({ user, staff, unread, theme, donation, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-[90] rounded-control bg-accent px-4 py-2 text-sm font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Sidebar user={user} unread={unread} staff={staff} donation={donation} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <div className="mx-auto hidden w-full max-w-xl items-center gap-2 sm:flex">
              <SearchBar />
              <CommandButton />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="sm:hidden">
                <CommandButton />
              </div>
              {user ? (
                <>
                  <Link href="/notifications" className="relative lg:hidden" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                    <Button variant="ghost" size="icon" tabIndex={-1}>
                      <Bell className="size-5" />
                    </Button>
                    {unread ? <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-accent ring-2 ring-bg" /> : null}
                  </Link>
                  <UserMenu user={user} staff={staff} theme={theme} />
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm" tabIndex={-1}>Sign in</Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm" tabIndex={-1}>Join free</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileTabBar user={user} />
    </div>
  );
}
