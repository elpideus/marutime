'use client';

import { LoaderCircle } from 'lucide-react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { cn } from './cn';
import { springs, tap } from './motion';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'accent-soft';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';

const base =
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium tracking-[-0.01em] select-none outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent shadow-[0_8px_24px_-10px_var(--mt-accent-glow)] hover:bg-accent-strong',
  secondary: 'bg-surface-2 text-fg border border-border hover:bg-surface-3 hover:border-border-strong',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  outline: 'border border-border-strong text-fg hover:bg-surface-2',
  danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
  'accent-soft': 'bg-accent-soft text-accent hover:bg-accent/25',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-[10px]',
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base rounded-[16px]',
  icon: 'size-10 rounded-control',
  'icon-sm': 'size-8 rounded-[10px]',
  'icon-lg': 'size-12 rounded-[16px]',
};

export function buttonClasses(opts: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(base, variants[opts.variant ?? 'primary'], sizes[opts.size ?? 'md'], opts.className);
}

export type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || loading ? undefined : tap}
      transition={springs.snappy}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </motion.button>
  );
});
