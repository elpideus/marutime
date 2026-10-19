# Legal and privacy notes (EU)

This is engineering documentation, not legal advice. It records the design choices that keep MaruTime aligned with the GDPR and the ePrivacy Directive, and what the operator still has to do.

## Built in

- **Lawful bases** are stated per data category on `/legal/privacy` (contract for account and tracking data, legitimate interest for security logs).
- **Data minimisation**: IP addresses are stored only as keyed hashes (`hashIp`), user agents are truncated, EXIF and GPS data are stripped from uploads, and there are no analytics or advertising cookies.
- **Cookies**: only strictly necessary and preference cookies (`/legal/cookies`), so no consent gate is required; an information banner is shown once.
- **Age**: sign-up requires confirming age 16 or over (GDPR Art. 8 default). Lower `LIMITS.minimumAge` per member state only if you add parental-consent tooling.
- **Rights**: access and portability (`/settings/data` JSON and CSV, `GET /api/me/export`), rectification (settings), erasure (`/settings/data`, cascades through foreign keys and deletes uploaded files), restriction and objection (private profile, activity sharing off).
- **Private check-in data**: device, service, emotions, favourite character and notes are shown only to their owner; aggregates require at least 3 distinct viewers so nobody can be singled out.
- **Security**: scrypt password hashing, hashed random session tokens in Secure, HttpOnly, SameSite cookies, login rate limiting, origin checks on uploads, server-side image re-encoding, AES-256-GCM encrypted backups when `BACKUP_ENCRYPTION_KEY` is set, and an audit log of admin actions.
- **Retention**: sessions 30 days, login attempts 24 hours, backups pruned after `backup.retentionDays` (default 30).
- **Attribution**: the TMDB non-endorsement notice and the AniList credit appear on legal and media pages, as the TMDB API terms require.

## Operator to-do

1. Fill **Admin → Settings → Legal identity** (controller name or pseudonym, contact email, address where your member state's imprint rules require it, country). The legal pages render these values.
2. Keep a short internal **record of processing activities** (Art. 30). Sections 2 and 3 of `/legal/privacy` are a good starting point.
3. Accept the **data processing terms** of your providers (Vercel, Neon, Cloudflare and Resend all offer standard DPAs in their dashboards).
4. If you add analytics, ads or any third-party script later, add a consent toggle to `CookieBanner` first.
5. Moderation: respond to reports (Admin → Reports). The report flow plus the audit trail covers the notice-and-action duties the Digital Services Act places on small hosting services.
