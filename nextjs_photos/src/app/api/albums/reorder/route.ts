import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumsWithGroups } from '@/lib/groups';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/albums/reorder';
  try {
    logRequest(TAG, request, { msg: 'Reorder album request' });

    const session = await getSession();

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, albumPath, direction, groupId } = await request.json();

    if (!year || !albumPath || !direction || !['up', 'down'].includes(direction)) {
      log(TAG, 'Invalid parameters', { year, albumPath, direction, groupId });
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    log(TAG, 'Reordering album', { year, albumPath, direction, groupId });

    // Get all albums for the year
    const albums = await getAlbumsWithGroups(year);

    // Filter albums based on context (grouped or ungrouped)
    const contextAlbums = groupId
      ? albums.filter(a => a.groupId === groupId)
      : albums.filter(a => !a.groupId);

    // Find current album index
    const currentIndex = contextAlbums.findIndex(a => a.path === albumPath);

    if (currentIndex === -1) {
      log(TAG, 'Album not found', { albumPath });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Check if move is valid
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= contextAlbums.length) {
      log(TAG, 'Cannot move in that direction', { currentIndex, newIndex, direction });
      return NextResponse.json({ error: 'Cannot move album in that direction' }, { status: 400 });
    }

    // Create a copy of the array and swap the albums
    const reorderedAlbums = [...contextAlbums];
    const temp = reorderedAlbums[currentIndex];
    reorderedAlbums[currentIndex] = reorderedAlbums[newIndex];
    reorderedAlbums[newIndex] = temp;

    // Update displayOrder for all albums in this context
    for (let i = 0; i < reorderedAlbums.length; i++) {
      const album = reorderedAlbums[i];
      const metadata = await getAlbumMetadata(album.path);

      if (metadata) {
        metadata.displayOrder = i;
        await saveAlbumMetadata(album.path, metadata);
      }
    }

    log(TAG, 'Album reordered successfully', { albumPath, direction });

    return NextResponse.json({
      success: true,
      message: `Album moved ${direction} successfully`
    });
  } catch (error) {
    logError(TAG, 'Error reordering albums', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}