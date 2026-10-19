import type { Metadata } from 'next';
import { H2, LegalLayout, P, legalContext } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Imprint' };

export default async function ImprintPage() {
  const c = await legalContext();
  return (
    <LegalLayout title="Imprint" description="Provider identification as required in several EU member states." updated={c.updated}>
      <H2>Service provider</H2>
      <P>
        {c.controller}
        {c.address ? (
          <>
            <br />
            {c.address}
          </>
        ) : null}
        {c.country ? (
          <>
            <br />
            {c.country}
          </>
        ) : null}
      </P>
      <H2>Contact</H2>
      <P>Email: {c.email}</P>
      <H2>Responsible for content</H2>
      <P>{c.controller}</P>
      <H2>Attribution</H2>
      <P>This product uses the TMDB API but is not endorsed or certified by TMDB. Anime data courtesy of AniList. Icons by Lucide. Built with Next.js.</P>
      <H2>Dispute resolution</H2>
      <P>The European Commission provides a platform for online dispute resolution at https://ec.europa.eu/consumers/odr. We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board.</P>
    </LegalLayout>
  );
}
