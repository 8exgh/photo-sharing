import { appendFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { log } from './logger';

// Same Gmail app-password SMTP setup the daycare deploy uses:
// GMAIL_USER / GMAIL_APP_PASSWORD env vars, sending from GMAIL_USER.
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set');
    }
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return transporter;
}

function getFromAddress(): string {
  return `"Photo Albums" <${process.env.GMAIL_USER}>`;
}

// Public base URL for links and redirects. APP_BASE_URL is authoritative in
// production (behind the reverse proxy the request's own URL reconstructs as
// localhost); callers with a request in hand pass its origin as fallback.
export function getAppBaseUrl(fallbackOrigin?: string): string {
  return (process.env.APP_BASE_URL || fallbackOrigin || 'http://localhost:3000').replace(/\/$/, '');
}

export async function sendVerificationEmail(to: string, username: string, verifyUrl: string): Promise<void> {
  const subject = 'Verify your email to activate your photo album site';
  const text = [
    `Hi ${username},`,
    '',
    'Someone (hopefully you) registered a photo album site with this email address.',
    '',
    'Click the link below to verify your email and activate your account:',
    '',
    verifyUrl,
    '',
    "If you didn't register, you can ignore this email.",
  ].join('\n');

  if (process.env.EMAIL_DRY_RUN) {
    // Dev/test mode: record the email in an outbox file instead of sending.
    // Tests read this file as their mocked inbox.
    const dataDir = resolve(process.cwd(), process.env.DATA_DIR || 'data');
    await mkdir(dataDir, { recursive: true });
    await appendFile(
      join(dataDir, 'outbox.jsonl'),
      JSON.stringify({ to, username, subject, verifyUrl, sent: new Date().toISOString() }) + '\n'
    );
    log('Mailer', 'DRY RUN - verification email written to outbox', { to, verifyUrl });
    return;
  }

  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
  });
  log('Mailer', 'Verification email sent', { to, username });
}
