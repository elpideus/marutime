import type { Metadata } from 'next';
import { H2, LegalLayout, P, legalContext } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Cookie policy' };

const COOKIES = [
  { name: 'mt_session', purpose: 'Keeps you signed in. Random token, HttpOnly, Secure.', duration: '30 days, extended while you use the site', type: 'Strictly necessary' },
  { name: 'mt_consent', purpose: 'Remembers that you dismissed the cookie notice.', duration: '1 year', type: 'Strictly necessary' },
  { name: 'mt_theme', purpose: 'Remembers dark or light mode.', duration: '1 year', type: 'Functional (preference)' },
  { name: 'mt_lists_category', purpose: 'Remembers which lists category you picked (shows, movies, anime).', duration: '1 year', type: 'Functional (preference)' },
  { name: 'mt_oauth', purpose: 'Protects a sign-in via Google, GitHub or Discord against forgery. Only set during that sign-in.', duration: '10 minutes', type: 'Strictly necessary' },
];

export default async function CookiesPage() {
  const c = await legalContext();
  return (
    <LegalLayout title="Cookie policy" description="We use first-party cookies only, all of them to make the site work or remember a preference you chose." updated={c.updated}>
      <H2>What we set</H2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-fg-subtle uppercase">
              <th className="py-2 pr-4">Cookie</th>
              <th className="py-2 pr-4">Purpose</th>
              <th className="py-2 pr-4">Duration</th>
              <th className="py-2">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {COOKIES.map((row) => (
              <tr key={row.name}>
                <td className="py-2 pr-4 font-mono text-xs text-fg">{row.name}</td>
                <td className="py-2 pr-4 text-fg-muted">{row.purpose}</td>
                <td className="py-2 pr-4 text-fg-muted">{row.duration}</td>
                <td className="py-2 text-fg-muted">{row.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H2>What we do not set</H2>
      <P>Trailers are embedded with YouTube&apos;s privacy-enhanced mode (youtube-nocookie.com), which does not set tracking cookies until you interact with the video; it may use local storage for playback. You can turn background trailers off in your settings.</P>
      <P>No advertising cookies, no third-party analytics, no cross-site tracking. Because every cookie above is either strictly necessary or stores a preference you actively chose, the ePrivacy Directive does not require prior consent; we still inform you with a short notice on your first visit.</P>
      <H2>Local storage</H2>
      <P>Your browser’s local storage may remember that you hid the donation card for two weeks. It never leaves your device.</P>
      <H2>Managing cookies</H2>
      <P>You can delete cookies in your browser settings at any time. Deleting <span className="font-mono text-xs text-fg">mt_session</span> signs you out.</P>
    </LegalLayout>
  );
}
