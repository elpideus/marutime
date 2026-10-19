'use client';

import { buttonClasses, cn, springs, useToast } from '@marutime/ui';
import { UserCheck, UserPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toggleFollowAction } from '@/actions/social';

/** Flips instantly and morphs in place; only a failure is announced (and rolled back). */
export function FollowButton({ userId, following, signedIn, size = 'md' }: { userId: string; following: boolean; signedIn: boolean; size?: 'sm' | 'md' }) {
  const [on, setOn] = useState(following);
  const [, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const toggle = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const prev = on;
    setOn(!on);
    start(async () => {
      const r = await toggleFollowAction(userId, prev);
      if (!r.ok) {
        setOn(prev);
        toast({ tone: 'error', title: r.error });
        return;
      }
      router.refresh();
    });
  };
  const label = on ? 'Following' : 'Follow';
  return (
    <motion.button type="button" layout onClick={toggle} aria-pressed={on} whileTap={{ scale: 0.94 }} transition={springs.bouncy} className={cn(buttonClasses({ variant: on ? 'secondary' : 'primary', size }), 'overflow-hidden')}>
      <span className="relative inline-flex size-4 items-center justify-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={label} initial={{ scale: 0.3, rotate: on ? -25 : 25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.3, opacity: 0, transition: { duration: 0.1 } }} transition={springs.pop} className="inline-flex">
            {on ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
          </motion.span>
        </AnimatePresence>
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={label} layout="position" initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(3px)', transition: { duration: 0.12 } }} transition={springs.smooth}>
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
