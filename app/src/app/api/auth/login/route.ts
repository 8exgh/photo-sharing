import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { queryAdminPasswordHash } from '@/lib/queries';
import { verifyPassword } from '@/lib/password';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/login';
  try {
    logRequest(TAG, request, { msg: 'Login attempt' });

    const { password } = await request.json();

    const storedHash = queryAdminPasswordHash();
    if (!storedHash) {
      log(TAG, 'No admin password set - setup required');
      return NextResponse.json({ error: 'Admin password has not been set yet', needsSetup: true }, { status: 409 });
    }

    if (typeof password === 'string' && verifyPassword(password, storedHash)) {
      log(TAG, 'Password correct, creating admin session');

      const response = new NextResponse();
      const session = await getSessionFromRequest(request, response);
      session.isAuthenticated = true;
      session.isAdmin = true;
      await session.save();

      log(TAG, 'Admin session created successfully', { isAuthenticated: true, isAdmin: true });

      // Return with session cookie headers
      return new NextResponse(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
      });
    }

    logRequest(TAG, request, { msg: 'Invalid password attempt' });
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    logError(TAG, 'Login error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
