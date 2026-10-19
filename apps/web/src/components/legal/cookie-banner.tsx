'use client';

import { CONSENT_COOKIE } from '@marutime/config';
import { Button, springs } from '@marutime/ui';
import { Cookie } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { notifyClientStore, useHasCookie } from '@/lib/client-store';

/**
 * Information notice for strictly necessary cookies (session, theme,
 * preferences). Nothing optional is set, so no toggles are required; we still
 * inform visitors as the ePrivacy Directive expects.
 */
export function CookieBanner() {
  const visible = !useHasCookie(CONSENT_COOKIE);
  const accept = () => {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE}=necessary; Max-Age=${365 * 86400}; Path=/; SameSite=Lax${secure}`;
    notifyClientStore();
  };
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="region"
          aria-label="Cookie notice"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97, transition: { duration: 0.16 } }}
          transition={springs.bouncy}
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 mx-auto max-w-lg rounded-island border border-border bg-surface-2/95 p-4 shadow-float backdrop-blur-xl sm:left-auto sm:right-6 sm:bottom-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
              <Cookie className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">Only the cookies we need</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                MaruTime uses strictly necessary cookies to keep you signed in and remember your preferences. No advertising or tracking cookies.{' '}
                <Link href="/legal/cookies" className="text-accent underline-offset-2 hover:underline">
                  Cookie policy
                </Link>
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={accept}>
                  Got it
                </Button>
                <Link href="/legal/privacy">
                  <Button size="sm" variant="ghost" tabIndex={-1}>
                    Privacy policy
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
