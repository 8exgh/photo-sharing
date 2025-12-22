import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/logout';
  try {
    logRequest(TAG, request, { msg: 'Logout request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);
    const wasAdmin = session.isAdmin;
    session.destroy();

    log(TAG, 'Session destroyed', { wasAdmin });

    // Return with session cookie headers (to clear the cookie)
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
    });
  } catch (error) {
    logError(TAG, 'Logout error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}