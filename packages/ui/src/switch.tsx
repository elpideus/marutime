'use client';

import { motion } from 'motion/react';
import { cn } from './cn';
import { springs } from './motion';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  name?: string;
  id?: string;
};

export function Switch({ checked, onCheckedChange, disabled, label, className, name, id }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border border-border p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-surface-3',
        className,
      )}
    >
      {name ? <input type="hidden" name={name} value={checked ? 'true' : 'false'} /> : null}
      <motion.span
        layout
        transition={springs.snappy}
        className={cn('block size-6 rounded-full shadow-sm', checked ? 'ml-auto bg-on-accent' : 'bg-fg')}
      />
    </button>
  );
}
