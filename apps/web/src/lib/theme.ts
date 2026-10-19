'use client';

/** Flip the theme on the page right away; returns the new theme for persisting. */
export function flipTheme(): 'dark' | 'light' {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  return next;
}
