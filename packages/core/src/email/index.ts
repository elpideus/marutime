import { APP_NAME, getEnv } from '@marutime/config';

export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmail implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(`\n📧 [email → ${message.to}] ${message.subject}\n${message.text}\n`);
  }
}

class NoopEmail implements EmailProvider {
  async send(): Promise<void> {}
}

class ResendEmail implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}
  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!res.ok) throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const env = getEnv();
  if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY) provider = new ResendEmail(env.RESEND_API_KEY, env.EMAIL_FROM);
  else if (env.EMAIL_PROVIDER === 'none') provider = new NoopEmail();
  else provider = new ConsoleEmail();
  return provider;
}

export function emailEnabled(): boolean {
  const env = getEnv();
  return env.EMAIL_PROVIDER === 'resend' && Boolean(env.RESEND_API_KEY);
}

function layout(title: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#09090b;color:#fafafa;font-family:-apple-system,Segoe UI,Inter,sans-serif;padding:32px">
<div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:32px">
<div style="font-weight:700;font-size:20px;color:#ffd233;margin-bottom:16px">${APP_NAME}</div>
<h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
<div style="color:#c7c7cc;font-size:15px;line-height:1.55">${body}</div>
${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:24px;background:#ffd233;color:#1a1400;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:14px">${cta.label}</a>` : ''}
<p style="color:#71717a;font-size:12px;margin-top:28px">If you did not request this, you can ignore this email.</p>
</div></body></html>`;
}

export const emailTemplates = {
  verifyEmail(to: string, url: string): EmailMessage {
    return {
      to,
      subject: `Verify your ${APP_NAME} email`,
      text: `Welcome to ${APP_NAME}! Confirm your email by opening this link:\n${url}\n\nThe link expires in 24 hours.`,
      html: layout('Confirm your email', `Welcome aboard. Confirm your email address to secure your account. The link expires in 24 hours.`, { label: 'Verify email', url }),
    };
  },
  resetPassword(to: string, url: string): EmailMessage {
    return {
      to,
      subject: `Reset your ${APP_NAME} password`,
      text: `Reset your password by opening this link:\n${url}\n\nThe link expires in 1 hour.`,
      html: layout('Reset your password', `Someone (hopefully you) asked to reset the password for this account. The link expires in 1 hour.`, { label: 'Choose a new password', url }),
    };
  },
  exportReady(to: string, url: string): EmailMessage {
    return {
      to,
      subject: `Your ${APP_NAME} data export is ready`,
      text: `Your data export is ready. Download it here (valid for 7 days):\n${url}`,
      html: layout('Your data export is ready', `We packaged everything you have on ${APP_NAME} into a single file. The download link is valid for 7 days.`, { label: 'Download export', url }),
    };
  },
};
