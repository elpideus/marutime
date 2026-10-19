'use client';

import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react';

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';

export type FloatingOptions = {
  open: boolean;
  side?: Side;
  align?: Align;
  /** Gap between anchor and floating element, in px. */
  offset?: number;
  /** Minimum distance kept from the viewport edges, in px. */
  padding?: number;
  /** Stretch the floating element to at least the anchor's width. */
  matchWidth?: boolean;
};

export type FloatingState = { style: CSSProperties; side: Side; origin: string; ready: boolean };

const HIDDEN: FloatingState = { style: { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }, side: 'bottom', origin: 'top', ready: false };

/**
 * Positions a portalled element next to an anchor with `position: fixed`, so
 * no `overflow: hidden` ancestor can clip it. Flips to the opposite side when
 * there is not enough room, clamps to the viewport, and follows the anchor on
 * scroll and resize.
 */
export function useFloating(anchorRef: RefObject<HTMLElement | null>, floatingRef: RefObject<HTMLElement | null>, opts: FloatingOptions): FloatingState {
  const { open, side = 'bottom', align = 'center', offset = 8, padding = 8, matchWidth = false } = opts;
  const [state, setState] = useState<FloatingState>(HIDDEN);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const floating = floatingRef.current;
    if (!anchor || !floating) return;
    const a = anchor.getBoundingClientRect();
    const fw = Math.max(floating.offsetWidth, matchWidth ? a.width : 0);
    const fh = floating.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let actual: Side = side;
    if (side === 'bottom' && a.bottom + offset + fh > vh - padding && a.top - offset - fh >= padding) actual = 'top';
    else if (side === 'top' && a.top - offset - fh < padding && a.bottom + offset + fh <= vh - padding) actual = 'bottom';
    else if (side === 'right' && a.right + offset + fw > vw - padding && a.left - offset - fw >= padding) actual = 'left';
    else if (side === 'left' && a.left - offset - fw < padding && a.right + offset + fw <= vw - padding) actual = 'right';

    let top: number;
    let left: number;
    if (actual === 'top' || actual === 'bottom') {
      top = actual === 'bottom' ? a.bottom + offset : a.top - offset - fh;
      left = align === 'start' ? a.left : align === 'end' ? a.right - fw : a.left + a.width / 2 - fw / 2;
    } else {
      left = actual === 'right' ? a.right + offset : a.left - offset - fw;
      top = align === 'start' ? a.top : align === 'end' ? a.bottom - fh : a.top + a.height / 2 - fh / 2;
    }
    left = Math.min(Math.max(left, padding), Math.max(padding, vw - fw - padding));
    top = Math.min(Math.max(top, padding), Math.max(padding, vh - fh - padding));

    // Transform origin points back at the anchor so scale animations grow out of it.
    const ox = Math.min(Math.max(a.left + a.width / 2 - left, 0), fw);
    const oy = Math.min(Math.max(a.top + a.height / 2 - top, 0), fh);
    const origin = actual === 'bottom' ? `${ox}px 0px` : actual === 'top' ? `${ox}px ${fh}px` : actual === 'right' ? `0px ${oy}px` : `${fw}px ${oy}px`;

    setState({
      style: { position: 'fixed', top, left, minWidth: matchWidth ? a.width : undefined, maxHeight: vh - padding * 2 },
      side: actual,
      origin,
      ready: true,
    });
  }, [anchorRef, floatingRef, side, align, offset, padding, matchWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setState(HIDDEN);
      return;
    }
    update();
    // A second pass once fonts/images inside the floating element settle.
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (floatingRef.current) ro?.observe(floatingRef.current);
    if (anchorRef.current) ro?.observe(anchorRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [open, update, anchorRef, floatingRef]);

  return state;
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true once mounted in the browser. */
export function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
