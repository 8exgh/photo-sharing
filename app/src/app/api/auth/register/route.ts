import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { registerTenant } from '@/lib/commands';
import { hashPassword } from '@/lib/password';
import { isValidTenantId } from '@/lib/tenants';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/register';
  try {
    logRequest(TAG, request, { msg: 'Registration attempt' });

    const { username, email, password } = await request.json();

    if (!isValidTenantId(username)) {
      return NextResponse.json(
        {
          error:
            'Username must be 3-32 characters of lowercase letters, digits, and hyphens (no leading or trailing hyphen)',
        },
        { status: 400 }
      );
    }

    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const verificationToken = randomBytes(32).toString('hex');
    const result = registerTenant(username, email, hashPassword(password), verificationToken);

    if (result === 'taken') {
      log(TAG, 'Username taken', { username });
      return NextResponse.json({ error: 'That username is already taken' }, { status: 409 });
    }

    // The background processor picks this registration up from
    // queryPendingVerificationEmails and sends the verification email.
    log(TAG, 'Registration recorded, verification email queued', { username });
    return NextResponse.json({
      success: true,
      message: 'Check your email for a verification link to activate your account.',
    });
  } catch (error) {
    logError(TAG, 'Registration error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
