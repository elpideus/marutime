'use client';

import { Tooltip } from '@marutime/ui';
import { Command } from 'lucide-react';
import { openCommandPalette } from '@/components/keyboard/command-palette';
import { useShortcutKeys } from '@/components/keyboard/shortcut-provider';

/** Opens the command bar; shows its shortcut so people learn it. */
export function CommandButton() {
  const keys = useShortcutKeys('palette.open');
  return (
    <Tooltip content="Command bar: go anywhere, change settings, mark things watched" shortcut={keys}>
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Open command bar"
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill border border-border bg-surface px-3 text-xs font-medium text-fg-muted transition-[border-color,color,background-color] duration-200 hover:border-border-strong hover:text-fg"
      >
        <Command className="size-4" />
        <span className="hidden tabular-nums lg:inline">{keys?.join(' ') ?? ''}</span>
      </button>
    </Tooltip>
  );
}
