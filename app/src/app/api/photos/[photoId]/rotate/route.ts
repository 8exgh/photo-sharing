import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { rotatePhoto } from '@/lib/commands';
import { resolveAdminTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const TAG = 'POST /api/photos/[photoId]/rotate';
  try {
    const { photoId } = await params;
    logRequest(TAG, request, { msg: 'Rotate photo request', photoId });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rotated = await rotatePhoto(tenantId, photoId);
    if (!rotated) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    log(TAG, 'Photo rotated successfully', { photoId });

    return NextResponse.json({
      success: true,
      message: 'Photo rotated successfully',
    });
  } catch (error) {
    logError(TAG, 'Error rotating photo', error);
    return NextResponse.json({ error: 'Failed to rotate photo' }, { status: 500 });
  }
}
