import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { moveAlbumToGroup } from '@/lib/groups';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/albums/move';
  try {
    logRequest(TAG, request, { msg: 'Move album request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { albumPath, year, groupId } = await request.json();

    if (!albumPath || !year) {
      log(TAG, 'Missing required params', { hasAlbumPath: !!albumPath, hasYear: !!year });
      return NextResponse.json({ error: 'Album path and year are required' }, { status: 400 });
    }

    log(TAG, 'Moving album', { albumPath, year, groupId });
    const newPath = await moveAlbumToGroup(albumPath, year, groupId || undefined);

    log(TAG, 'Album moved successfully', { newPath: newPath.split('public/albums/')[1] });

    return NextResponse.json({
      success: true,
      message: 'Album moved successfully',
      newPath: newPath.split('public/albums/')[1],
    });
  } catch (error) {
    logError(TAG, 'Error moving album', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}