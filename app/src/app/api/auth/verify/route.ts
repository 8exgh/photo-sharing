import { NextRequest, NextResponse } from 'next/server';
import { verifyTenantEmail } from '@/lib/commands';
import { isValidTenantId, tenantExists } from '@/lib/tenants';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Target of the emailed verification link. Activates the account and sends
// the new user to the login page.
export async function GET(request: NextRequest) {
  const TAG = 'GET /api/auth/verify';
  try {
    logRequest(TAG, request, { msg: 'Email verification attempt' });

    const username = request.nextUrl.searchParams.get('username') || '';
    const token = request.nextUrl.searchParams.get('token') || '';

    if (!isValidTenantId(username) || !tenantExists(username) || !token) {
      log(TAG, 'Invalid verification link', { username });
      return NextResponse.redirect(new URL('/admin/login?verified=invalid', request.url));
    }

    const verified = verifyTenantEmail(username, token);
    if (!verified) {
      log(TAG, 'Verification failed - token mismatch', { username });
      return NextResponse.redirect(new URL('/admin/login?verified=invalid', request.url));
    }

    log(TAG, 'Email verified', { username });
    return NextResponse.redirect(new URL('/admin/login?verified=1', request.url));
  } catch (error) {
    logError(TAG, 'Verification error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
