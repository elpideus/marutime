import { getDonationConfig } from '@marutime/core';
import { getDb } from '@marutime/db';
import { Button, Island } from '@marutime/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'About' };

export default async function AboutPage() {
  const donation = await getDonationConfig(getDb());
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="About MaruTime" description="A modern, clean successor to the tracker many of us grew up with." />
      <Island padding="lg" className="flex flex-col gap-4 text-sm leading-relaxed text-fg-muted">
        <p>TV Time shut down and took a lot of memories with it. MaruTime is a fresh take on the same idea: follow shows, tick off episodes, react with six feelings, pick the character who stole the scene, and talk about it without spoiling anyone.</p>
        <p>It is built by one person, runs on free tiers, and is designed to be modular: the web app you are using, and later mobile apps and player plugins, all talk to the same open API.</p>
        <p>Metadata comes from <a href="https://www.themoviedb.org" className="text-accent hover:underline">TMDB</a> and <a href="https://anilist.co" className="text-accent hover:underline">AniList</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {donation.enabled ? (
            <a href={donation.url} target="_blank" rel="noopener noreferrer">
              <Button tabIndex={-1}>{donation.title}</Button>
            </a>
          ) : null}
          <Link href="/api/v1/openapi.json">
            <Button variant="secondary" tabIndex={-1}>API reference</Button>
          </Link>
          <Link href="/legal/privacy">
            <Button variant="ghost" tabIndex={-1}>Privacy</Button>
          </Link>
        </div>
      </Island>
    </div>
  );
}
