import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { moveAlbumToGroup } from '@/lib/commands';
import { resolveAdminTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/albums/move';
  try {
    logRequest(TAG, request, { msg: 'Move album request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { albumId, groupId } = await request.json();

    if (!albumId) {
      log(TAG, 'Missing album ID');
      return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
    }

    log(TAG, 'Moving album', { albumId, groupId });
    const moved = moveAlbumToGroup(tenantId, albumId, groupId || null);

    if (!moved) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    log(TAG, 'Album moved successfully', { albumId, groupId });

    return NextResponse.json({
      success: true,
      message: 'Album moved successfully',
    });
  } catch (error) {
    logError(TAG, 'Error moving album', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
