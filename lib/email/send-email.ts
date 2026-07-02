import nodemailer from 'nodemailer';

/**
 * Escapes user-controlled text before interpolating it into an HTML email
 * body (titles, comments, etc. are free text and must not be trusted as
 * markup — otherwise a crafted title/comment could inject links/images into
 * a recipient's email client).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * SMTP transport, lazily created and cached across calls.
 * Defaults to the local Supabase Inbucket/Mailpit container for dev
 * (see supabase/config.toml [inbucket]) when no SMTP_* env vars are set.
 */
function getTransport() {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST ?? '127.0.0.1';
  const port = Number(process.env.SMTP_PORT ?? 54325);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: user && pass ? { user, pass } : undefined,
    // Local dev SMTP servers (Inbucket/Mailpit) don't do TLS.
    ignoreTLS: !user,
  });
  return cachedTransport;
}

/** Sends an email. Throws on failure — callers that want fire-and-forget should catch. */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'notifications@handoff.local';
  await getTransport().sendMail({ from, to, subject, html });
}
