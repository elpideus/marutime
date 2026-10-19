import * as arctic from 'arctic';
import { getEnv } from '@marutime/config';

export type OAuthProviderId = 'google' | 'github' | 'discord';

export type OAuthProfile = {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type OAuthStart = { url: URL; state: string; codeVerifier: string | null };

function redirectUri(provider: OAuthProviderId): string {
  return `${getEnv().APP_URL}/auth/${provider}/callback`;
}

function clients(): Partial<Record<OAuthProviderId, arctic.Google | arctic.GitHub | arctic.Discord>> {
  const env = getEnv();
  const out: Partial<Record<OAuthProviderId, arctic.Google | arctic.GitHub | arctic.Discord>> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    out.google = new arctic.Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri('google'));
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    out.github = new arctic.GitHub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, redirectUri('github'));
  }
  if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
    out.discord = new arctic.Discord(env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET, redirectUri('discord'));
  }
  return out;
}

export function isOAuthProvider(value: string): value is OAuthProviderId {
  return value === 'google' || value === 'github' || value === 'discord';
}

export function startOAuth(provider: OAuthProviderId): OAuthStart {
  const client = clients()[provider];
  if (!client) throw new Error(`OAuth provider "${provider}" is not configured`);
  const state = arctic.generateState();
  if (provider === 'google') {
    const codeVerifier = arctic.generateCodeVerifier();
    const url = (client as arctic.Google).createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
    return { url, state, codeVerifier };
  }
  if (provider === 'github') {
    const url = (client as arctic.GitHub).createAuthorizationURL(state, ['read:user', 'user:email']);
    return { url, state, codeVerifier: null };
  }
  const url = (client as arctic.Discord).createAuthorizationURL(state, null, ['identify', 'email']);
  return { url, state, codeVerifier: null };
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'MaruTime', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`OAuth profile request failed (${res.status}) for ${url}`);
  return (await res.json()) as T;
}

export async function completeOAuth(provider: OAuthProviderId, code: string, codeVerifier: string | null): Promise<OAuthProfile> {
  const client = clients()[provider];
  if (!client) throw new Error(`OAuth provider "${provider}" is not configured`);

  if (provider === 'google') {
    const tokens = await (client as arctic.Google).validateAuthorizationCode(code, codeVerifier ?? '');
    const claims = arctic.decodeIdToken(tokens.idToken()) as Record<string, unknown>;
    return {
      provider,
      providerUserId: String(claims.sub),
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
      name: typeof claims.name === 'string' ? claims.name : null,
      username: null,
      avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
    };
  }

  if (provider === 'github') {
    const tokens = await (client as arctic.GitHub).validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();
    const user = await getJson<{ id: number; login: string; name: string | null; avatar_url: string | null; email: string | null }>(
      'https://api.github.com/user',
      accessToken,
    );
    let email = user.email;
    let emailVerified = false;
    try {
      const emails = await getJson<Array<{ email: string; primary: boolean; verified: boolean }>>(
        'https://api.github.com/user/emails',
        accessToken,
      );
      const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      if (primary) {
        email = primary.email;
        emailVerified = true;
      }
    } catch {
      // email scope may be missing; fall back to public email
    }
    return {
      provider,
      providerUserId: String(user.id),
      email,
      emailVerified,
      name: user.name,
      username: user.login,
      avatarUrl: user.avatar_url,
    };
  }

  const tokens = await (client as arctic.Discord).validateAuthorizationCode(code, null);
  const user = await getJson<{ id: string; username: string; global_name: string | null; avatar: string | null; email: string | null; verified: boolean }>(
    'https://discord.com/api/users/@me',
    tokens.accessToken(),
  );
  return {
    provider,
    providerUserId: user.id,
    email: user.email,
    emailVerified: Boolean(user.verified),
    name: user.global_name ?? user.username,
    username: user.username,
    avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256` : null,
  };
}

export { OAuth2RequestError, ArcticFetchError } from 'arctic';
