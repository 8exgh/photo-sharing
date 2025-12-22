import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/login';
  try {
    logRequest(TAG, request, { msg: 'Login attempt' });

    const { password } = await request.json();

    // Simple admin password check (in production, use proper authentication)
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (password === adminPassword) {
      log(TAG, 'Password correct, creating admin session');

      const response = NextResponse.next();
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