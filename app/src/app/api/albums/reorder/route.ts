import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { reorderAlbum } from '@/lib/commands';
import { queryAlbumsWithGroupsByYear } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/albums/reorder';
  try {
    logRequest(TAG, request, { msg: 'Reorder album request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, albumId, direction, groupId } = await request.json();

    if (!year || !albumId || !direction || !['up', 'down'].includes(direction)) {
      log(TAG, 'Invalid parameters', { year, albumId, direction, groupId });
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    log(TAG, 'Reordering album', { year, albumId, direction, groupId });

    const allAlbums = queryAlbumsWithGroupsByYear(year);

    // Filter albums based on context
    const contextAlbums = groupId
      ? allAlbums.filter(a => a.groupId === groupId)
      : allAlbums.filter(a => !a.groupId);

    contextAlbums.sort((a, b) => a.displayOrder - b.displayOrder);

    const currentIndex = contextAlbums.findIndex(a => a.albumId === albumId);

    if (currentIndex === -1) {
      log(TAG, 'Album not found', { albumId });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= contextAlbums.length) {
      log(TAG, 'Cannot move in that direction', { currentIndex, newIndex, direction });
      return NextResponse.json({ error: 'Cannot move album in that direction' }, { status: 400 });
    }

    // Swap and reassign orders
    const reordered = [...contextAlbums];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[newIndex];
    reordered[newIndex] = temp;

    for (let i = 0; i < reordered.length; i++) {
      reorderAlbum(reordered[i].albumId, i);
    }

    log(TAG, 'Album reordered successfully', { albumId, direction });

    return NextResponse.json({
      success: true,
      message: `Album moved ${direction} successfully`
    });
  } catch (error) {
    logError(TAG, 'Error reordering albums', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
