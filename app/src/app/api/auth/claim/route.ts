import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { claimAdminPassword } from '@/lib/commands';
import { hashPassword } from '@/lib/password';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/claim';
  try {
    logRequest(TAG, request, { msg: 'Claim admin password attempt' });

    const { password } = await request.json();

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const claimed = claimAdminPassword(hashPassword(password));
    if (!claimed) {
      log(TAG, 'Claim rejected - password already set');
      return NextResponse.json({ error: 'Admin password has already been set' }, { status: 409 });
    }

    // Log the claimer in as admin immediately
    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    session.isAuthenticated = true;
    session.isAdmin = true;
    await session.save();

    log(TAG, 'Admin password claimed and session created');
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
    });
  } catch (error) {
    logError(TAG, 'Claim error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
