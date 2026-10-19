import type { Metadata } from 'next';
import { H2, LegalLayout, P, UL, legalContext } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Privacy policy' };

export default async function PrivacyPage() {
  const c = await legalContext();
  return (
    <LegalLayout title="Privacy policy" description="Plain language, no dark patterns. This explains what we store, why, and how to take it with you or delete it." updated={c.updated}>
      <H2>1. Who is responsible</H2>
      <P>
        The data controller for {c.siteName} is {c.controller}
        {c.address ? `, ${c.address}` : ''}
        {c.country ? ` (${c.country})` : ''}. Contact: {c.email}. {c.siteName} is a non-commercial, community-run service.
      </P>
      <H2>2. What we collect and why</H2>
      <UL
        items={[
          <><strong className="text-fg">Account data</strong> (email, username, password hash, display name, optional bio, avatar, cover, social links, favourite character). Legal basis: performance of a contract (Art. 6(1)(b) GDPR). Needed to run your account.</>,
          <><strong className="text-fg">Tracking data</strong> (the shows and movies you follow, episodes and movies you mark watched, when you watched them, your watchlist, lists, likes, follows, comments and uploaded images). Legal basis: contract. This is the product.</>,
          <><strong className="text-fg">Private check-in details</strong> (device type, streaming service, your six-emotion reaction, favourite character and private notes). Legal basis: contract. These are shown to you only. Everyone else sees them exclusively as anonymous totals, and totals are hidden until at least three different people have checked in to the same episode or movie.</>,
          <><strong className="text-fg">Technical data</strong> (a pseudonymised hash of your IP address and your browser’s user agent on sessions and failed sign-ins, kept to protect accounts; server logs kept briefly by our hosting provider). Legal basis: legitimate interest in security (Art. 6(1)(f)).</>,
          <><strong className="text-fg">Preferences</strong> (theme, chosen lists category, spoiler settings) in cookies and in your account.</>,
        ]}
      />
      <P>We do not run advertising, do not sell data, do not build advertising profiles and do not use third-party analytics or tracking cookies.</P>
      <H2>3. Where the data lives (processors)</H2>
      <UL
        items={[
          'Hosting and compute: Vercel Inc. (serverless functions and static assets) or, for self-hosted instances, the operator named above.',
          'Database: a managed PostgreSQL provider configured by the operator (for example Neon). Backups are stored encrypted in object storage configured by the operator (for example Cloudflare R2).',
          'Images you upload: object storage configured by the operator (for example Cloudflare R2). EXIF metadata, including GPS location, is removed on upload.',
          'Title metadata and artwork: The Movie Database (TMDB) and AniList. Your browser loads poster images directly from their image servers, which see your IP address like any website asset. We never send them your account data.',
          'Email (only if enabled by the operator): a transactional email provider such as Resend, used for verification, password resets and export notices.',
        ]}
      />
      <P>Some providers may process data outside the EU/EEA. Where that happens, transfers rely on the European Commission’s Standard Contractual Clauses or adequacy decisions (for example the EU-US Data Privacy Framework).</P>
      <H2>4. How long we keep it</H2>
      <UL
        items={[
          'Account and tracking data: until you delete your account. Deletion is immediate and cascades to everything you created.',
          'Encrypted backups: automatically removed after the retention window (30 days by default). Data you deleted therefore disappears from backups within that window.',
          'Session records: 30 days of inactivity, or until you sign out. Failed sign-in records: 24 hours.',
          'Audit log entries about moderation actions: 12 months.',
        ]}
      />
      <H2>5. Your rights</H2>
      <P>You can exercise all GDPR rights directly in the app, no email required:</P>
      <UL
        items={[
          <><strong className="text-fg">Access and portability</strong> (Art. 15, 20): Settings → Your data → Download JSON or CSV.</>,
          <><strong className="text-fg">Rectification</strong> (Art. 16): edit anything in Settings.</>,
          <><strong className="text-fg">Erasure</strong> (Art. 17): Settings → Your data → Delete account.</>,
          <><strong className="text-fg">Restriction and objection</strong> (Art. 18, 21): set your profile to private, disable activity sharing, or contact us.</>,
          <><strong className="text-fg">Complaint</strong>: you may lodge a complaint with your local supervisory authority.</>,
        ]}
      />
      <P>For anything else, write to {c.email}. We answer within 30 days.</P>
      <H2>6. Children</H2>
      <P>{c.siteName} is for people aged 16 and over. We do not knowingly collect data from younger children; if you believe a child has an account, contact us and we will delete it.</P>
      <H2>7. Security</H2>
      <P>Passwords are hashed with scrypt. Sessions use random, hashed tokens in secure, HttpOnly cookies. Backups are encrypted with AES-256-GCM when an encryption key is configured. Access to production data is limited to the operator.</P>
      <H2>8. Changes</H2>
      <P>If this policy changes materially we will show a notice in the app before the change takes effect.</P>
    </LegalLayout>
  );
}
