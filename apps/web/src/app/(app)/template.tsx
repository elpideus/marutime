'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const EPISODE = /^\/show\/[^/]+\/s\/[^/]+\/e\/[^/]+/;

/**
 * Re-mounted on every navigation: pages rise into place on a spring. Episode
 * pages opt out because their own view transition carries the motion.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className={EPISODE.test(pathname) ? undefined : 'page-enter'}>{children}</div>;
}
