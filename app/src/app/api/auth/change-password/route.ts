import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { changeAdminPassword } from '@/lib/commands';
import { queryAdminPasswordHash, resolveAdminTenant } from '@/lib/queries';
import { hashPassword, verifyPassword } from '@/lib/password';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/auth/change-password';
  try {
    logRequest(TAG, request, { msg: 'Change password request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const storedHash = queryAdminPasswordHash(tenantId);
    if (!storedHash || typeof currentPassword !== 'string' || !verifyPassword(currentPassword, storedHash)) {
      log(TAG, 'Current password incorrect');
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const changed = changeAdminPassword(tenantId, hashPassword(newPassword));
    if (!changed) {
      return NextResponse.json({ error: 'No admin password set' }, { status: 409 });
    }

    log(TAG, 'Admin password changed successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Change password error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
