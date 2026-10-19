'use client';

import { Button, springs } from '@marutime/ui';
import { UserCheck, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toggleFollowAction } from '@/actions/social';

export function FollowButton({ userId, following, signedIn, size = 'md' }: { userId: string; following: boolean; signedIn: boolean; size?: 'sm' | 'md' }) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const prev = on;
    setOn(!on);
    start(async () => {
      const r = await toggleFollowAction(userId, prev);
      if (!r.ok) setOn(prev);
      router.refresh();
    });
  };
  return (
    <motion.div whileTap={{ scale: 0.95 }} transition={springs.snappy}>
      <Button variant={on ? 'secondary' : 'primary'} size={size} onClick={toggle} loading={pending} aria-pressed={on}>
        {on ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />} {on ? 'Following' : 'Follow'}
      </Button>
    </motion.div>
  );
}
