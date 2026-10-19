'use client';

import type { FeedItem } from '@marutime/core';
import { Button, Island, fadeUp, stagger } from '@marutime/ui';
import { Clapperboard, Heart, ListVideo, Lock, MessageCircle, Sparkles, Tv } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ActivityItem } from '@/components/feed/activity-item';
import { MediaRow } from '@/components/media/media-row';
import type { MediaCardData } from '@/lib/media-card';

const FEATURES = [
  { icon: <Tv />, title: 'Never lose your place', text: 'Follow shows, tick off episodes, and always know what to watch next and when the next one airs.' },
  { icon: <Heart />, title: 'Six feelings, one tap', text: 'Good, Fun, Wow, Sad, So-so or Bad. React to every episode and movie and pick the character who stole it.' },
  { icon: <MessageCircle />, title: 'Talk without spoiling', text: 'Comment under every episode with images. Mark spoilers so nobody gets ruined.' },
  { icon: <ListVideo />, title: 'Lists people love', text: 'Curate public, private, unlisted or followers-only lists and browse the most popular ones by shows, movies or anime.' },
  { icon: <Lock />, title: 'Private by design', text: 'Where and how you watch feeds anonymous stats only. Export or delete everything you have, anytime.' },
  { icon: <Clapperboard />, title: 'Anime, properly', text: 'AniList-enriched anime pages with character art, studios and scores next to TMDB data.' },
];

export function Landing({ trending, activity }: { trending: MediaCardData[]; activity: FeedItem[] }) {
  return (
    <div className="flex flex-col gap-12">
      <section className="relative overflow-hidden rounded-island border border-border bg-surface px-6 py-14 sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-accent/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-20 size-96 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="relative max-w-2xl">
          <motion.p variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-pill border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="size-3.5" /> A home for everything you watch
          </motion.p>
          <motion.h1 variants={fadeUp} className="text-4xl font-semibold tracking-tight text-fg text-balance sm:text-6xl">
            Track what you watch. <span className="text-accent">Share what you love.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 max-w-xl text-base text-fg-muted sm:text-lg">
            MaruTime is a modern, clean tracker for shows, movies and anime. Episode-level progress, real feelings, spoiler-safe discussion and lists worth sharing. Free, open and respectful of your data.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg" tabIndex={-1}>
                Create your free account
              </Button>
            </Link>
            <Link href="/discover">
              <Button size="lg" variant="secondary" tabIndex={-1}>
                Explore first
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <MediaRow title="Trending this week" description="What people are watching right now" items={trending} href="/discover" />

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-fg">Built like a good remote: everything within reach</h2>
        <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={fadeUp}>
              <Island className="h-full">
                <span className="mb-4 flex size-10 items-center justify-center rounded-[14px] bg-accent-soft text-accent [&>svg]:size-5">{f.icon}</span>
                <h3 className="font-semibold text-fg">{f.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{f.text}</p>
              </Island>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {activity.length > 0 ? (
        <Island>
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-fg">Happening now</h2>
          <ul className="flex flex-col divide-y divide-border">
            {activity.map((item) => (
              <ActivityItem key={item.activity.id} item={item} />
            ))}
          </ul>
        </Island>
      ) : null}
    </div>
  );
}
