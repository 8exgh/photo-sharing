import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; index: string }> }
) {
  const TAG = 'PUT /api/albums/[year]/[album]/videos/[index]';
  try {
    const { year, album, index } = await params;
    logRequest(TAG, request, { msg: 'Update video request', year, album, index });

    const session = await getSession();

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, title } = await request.json();
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);

    const existingMetadata = await getAlbumMetadata(albumPath);
    if (!existingMetadata) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const videoIndex = parseInt(index);
    if (isNaN(videoIndex) || videoIndex < 0 || videoIndex >= existingMetadata.videos.length) {
      log(TAG, 'Video not found', { index, totalVideos: existingMetadata.videos.length });
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Update the video fields
    const updatedVideos = [...existingMetadata.videos];
    updatedVideos[videoIndex] = {
      ...updatedVideos[videoIndex],
      text: text !== undefined ? text : updatedVideos[videoIndex].text,
      title: title !== undefined ? title : updatedVideos[videoIndex].title,
    };

    const updatedMetadata = {
      ...existingMetadata,
      videos: updatedVideos,
    };

    await saveAlbumMetadata(albumPath, updatedMetadata);

    log(TAG, 'Video updated successfully', { year, album, index });

    return NextResponse.json({
      success: true,
      message: 'Video text updated successfully',
      text: updatedVideos[videoIndex].text,
    });
  } catch (error) {
    logError(TAG, 'Error updating video', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}