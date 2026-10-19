'use client';

import type { PublicUser } from '@marutime/db';
import { Avatar, Button, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@marutime/ui';
import { LogOut, Moon, Settings, Shield, Sun, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { logoutAction } from '@/actions/auth';
import { setThemeAction } from '@/actions/preferences';

export function UserMenu({ user, staff, theme }: { user: PublicUser; staff: boolean; theme: 'dark' | 'light' }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    start(async () => {
      await setThemeAction(next);
      router.refresh();
    });
  };
  return (
    <Menu>
      <MenuTrigger>
        {(props) => (
          <button type="button" {...props} className="rounded-full outline-none ring-offset-2 ring-offset-bg focus-visible:ring-2 focus-visible:ring-accent/60" aria-label="Account menu">
            <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
          </button>
        )}
      </MenuTrigger>
      <MenuContent className="w-60">
        <MenuLabel>
          <span className="normal-case tracking-normal text-fg">{user.displayName}</span>
          <span className="block font-normal text-fg-subtle">@{user.username}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem icon={<User />} onSelect={() => router.push(`/u/${user.username}`)}>Your profile</MenuItem>
        <MenuItem icon={<Settings />} onSelect={() => router.push('/settings')}>Settings</MenuItem>
        {staff ? <MenuItem icon={<Shield />} onSelect={() => router.push('/admin')}>Admin dashboard</MenuItem> : null}
        <MenuItem icon={theme === 'dark' ? <Sun /> : <Moon />} onSelect={toggleTheme} disabled={pending}>
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </MenuItem>
        <MenuSeparator />
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start gap-2.5 px-3 font-normal text-fg">
            <LogOut className="size-4 text-fg-muted" /> Sign out
          </Button>
        </form>
      </MenuContent>
    </Menu>
  );
}
