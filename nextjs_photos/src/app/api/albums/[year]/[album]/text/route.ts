import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'PUT /api/albums/[year]/[album]/text';
  try {
    const { year, album } = await params;
    logRequest(TAG, request, { msg: 'Update album text request', year, album });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await request.json();

    // First, try to find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);

    if (!targetAlbum) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const existingMetadata = await getAlbumMetadata(targetAlbum.path);
    if (!existingMetadata) {
      log(TAG, 'Album metadata not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const updatedMetadata = {
      ...existingMetadata,
      text: text || '',
    };

    await saveAlbumMetadata(targetAlbum.path, updatedMetadata);

    log(TAG, 'Album text updated successfully', { year, album });

    return NextResponse.json({
      success: true,
      message: 'Album text updated successfully',
      text: updatedMetadata.text,
    });
  } catch (error) {
    logError(TAG, 'Error updating album text', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}