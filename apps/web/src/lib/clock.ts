/**
 * The server time a page was rendered at. Client components compare it with
 * the times of their own optimistic changes (see watch-store), so a stale
 * render can never overwrite something the viewer just did.
 */
export function renderedAt(): number {
  return Date.now();
}
