import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { queryTenantAuth } from '@/lib/queries';
import { verifyPassword } from '@/lib/password';
import { isValidTenantId, tenantExists } from '@/lib/tenants';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/login';
  try {
    logRequest(TAG, request, { msg: 'Login attempt' });

    const { username, password } = await request.json();

    if (!isValidTenantId(username) || !tenantExists(username)) {
      logRequest(TAG, request, { msg: 'Unknown username', username: String(username).slice(0, 40) });
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const auth = queryTenantAuth(username);
    const storedHash = auth.adminPasswordHash;

    if (storedHash && typeof password === 'string' && verifyPassword(password, storedHash)) {
      if (!auth.emailVerified) {
        log(TAG, 'Login rejected - email not verified', { username });
        return NextResponse.json(
          { error: 'Please verify your email first — check your inbox for the verification link' },
          { status: 403 }
        );
      }

      log(TAG, 'Password correct, creating admin session', { username });

      const response = new NextResponse();
      const session = await getSessionFromRequest(request, response);
      session.isAuthenticated = true;
      session.isAdmin = true;
      session.tenantId = username;
      await session.save();

      log(TAG, 'Admin session created successfully', { username });

      // Return with session cookie headers
      return new NextResponse(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
      });
    }

    logRequest(TAG, request, { msg: 'Invalid password attempt', username });
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  } catch (error) {
    logError(TAG, 'Login error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
