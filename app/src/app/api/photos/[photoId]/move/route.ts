import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { movePhoto } from '@/lib/commands';
import { queryAlbumByYearAndUrlName } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const TAG = 'POST /api/photos/[photoId]/move';
  try {
    const { photoId } = await params;
    logRequest(TAG, request, { msg: 'Move photo request', photoId });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetYear, targetAlbum, targetAlbumId } = await request.json();

    // Support both albumId directly or year+urlName lookup
    let toAlbumId = targetAlbumId;
    if (!toAlbumId && targetYear && targetAlbum) {
      const album = queryAlbumByYearAndUrlName(targetYear, targetAlbum);
      if (!album) {
        return NextResponse.json({ error: 'Target album not found' }, { status: 404 });
      }
      toAlbumId = album.albumId;
    }

    if (!toAlbumId) {
      return NextResponse.json({ error: 'Target album is required' }, { status: 400 });
    }

    const moved = movePhoto(photoId, toAlbumId);
    if (!moved) {
      return NextResponse.json({ error: 'Photo not found or already in target album' }, { status: 404 });
    }

    log(TAG, 'Photo moved successfully', { photoId, toAlbumId });

    return NextResponse.json({
      success: true,
      message: 'Photo moved successfully',
    });
  } catch (error) {
    logError(TAG, 'Error moving photo', error);
    return NextResponse.json({ error: 'Failed to move photo' }, { status: 500 });
  }
}
