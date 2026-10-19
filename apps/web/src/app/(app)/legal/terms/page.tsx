import type { Metadata } from 'next';
import { H2, LegalLayout, P, UL, legalContext } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Terms of service' };

export default async function TermsPage() {
  const c = await legalContext();
  return (
    <LegalLayout title="Terms of service" description="Short, fair and readable." updated={c.updated}>
      <H2>1. The service</H2>
      <P>
        {c.siteName} lets you track shows, movies and anime, react to them, discuss them and share lists. It is provided by {c.controller} ({c.email}) free of charge, as is, without warranty. We will do our best to keep it running but cannot promise uptime, and we may change or discontinue features.
      </P>
      <H2>2. Your account</H2>
      <UL items={['You must be at least 16 years old.', 'Keep your password secret and tell us if you suspect misuse.', 'One person, one account. Do not impersonate others.', 'You can delete your account at any time in Settings.']} />
      <H2>3. Your content</H2>
      <P>Comments, images and lists you post stay yours. You grant us a non-exclusive, worldwide, royalty-free licence to host and display them within the service, so the service can work. You can delete them whenever you like.</P>
      <P>Do not post content that is illegal, hateful, harassing, sexually explicit, infringes someone else’s rights, or spoils stories without marking it as a spoiler. We may hide or remove content and suspend accounts that break these rules.</P>
      <H2>4. Third-party data</H2>
      <P>Show and movie metadata comes from The Movie Database (TMDB) and AniList. {c.siteName} uses the TMDB API but is not endorsed or certified by TMDB. Artwork remains the property of its respective owners.</P>
      <H2>5. Donations</H2>
      <P>Donations are voluntary gifts to help cover running costs. They do not buy features, priority or any obligation on our side, and are not refundable except where the law requires.</P>
      <H2>6. Liability</H2>
      <P>To the extent permitted by law, we are not liable for indirect damages, lost data or lost enjoyment of a plot twist. Nothing in these terms limits rights you have as a consumer under mandatory law.</P>
      <H2>7. Governing law</H2>
      <P>These terms are governed by the law of {c.country || 'the operator’s country of residence in the European Union'}, without affecting mandatory consumer protections of your country of residence.</P>
      <H2>8. Changes</H2>
      <P>We may update these terms. Material changes will be announced in the app at least 14 days before they apply.</P>
    </LegalLayout>
  );
}
