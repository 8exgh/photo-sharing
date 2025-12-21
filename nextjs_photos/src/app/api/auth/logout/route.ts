import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/logout';
  try {
    logRequest(TAG, request, { msg: 'Logout request' });

    const session = await getSession();
    const wasAdmin = session.isAdmin;
    session.destroy();

    log(TAG, 'Session destroyed', { wasAdmin });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Logout error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}