import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { claimAdminPassword } from '@/lib/commands';
import { hashPassword, verifyPassword } from '@/lib/password';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const MIN_PASSWORD_LENGTH = 8;

// scrypt hash of the initial default admin password. Claiming the admin
// account requires knowing this password; the plaintext is not stored here.
const DEFAULT_ADMIN_PASSWORD_HASH =
  'scrypt:658b6c1647d4eca7be97f730e5ccbdc3:6c3a44f8d6f04d3c7281539cdb66fb2213cb988a5ba8478e7b6882a49977e146051565c267cb61b06408f0aefe42018c25f4306692dbd7dc775ac4f4f1baf1d0';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/claim';
  try {
    logRequest(TAG, request, { msg: 'Claim admin password attempt' });

    const { defaultPassword, password } = await request.json();

    if (typeof defaultPassword !== 'string' || !verifyPassword(defaultPassword, DEFAULT_ADMIN_PASSWORD_HASH)) {
      log(TAG, 'Claim rejected - default password incorrect');
      return NextResponse.json({ error: 'Default password is incorrect' }, { status: 401 });
    }

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
