import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';
import { VideoMetadata } from '@/types';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'POST /api/albums/[year]/[album]/videos';
  try {
    const { year, album } = await params;
    logRequest(TAG, request, { msg: 'Add video request', year, album });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, title } = await request.json();

    if (!url || !title) {
      log(TAG, 'Missing required fields', { hasUrl: !!url, hasTitle: !!title });
      return NextResponse.json({ error: 'URL and title are required' }, { status: 400 });
    }

    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    const metadata = await getAlbumMetadata(albumPath);

    if (!metadata) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const videoMetadata: VideoMetadata = {
      url,
      title,
      addedDate: new Date().toISOString(),
      text: '', // Initialize text field
    };

    const updatedMetadata = {
      ...metadata,
      videos: [...metadata.videos, videoMetadata],
    };

    await saveAlbumMetadata(albumPath, updatedMetadata);

    log(TAG, 'Video added successfully', { year, album, title });

    return NextResponse.json({
      success: true,
      message: 'Video link added successfully',
      video: videoMetadata,
    });
  } catch (error) {
    logError(TAG, 'Error adding video', error);
    return NextResponse.json({ error: 'Failed to add video' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'DELETE /api/albums/[year]/[album]/videos';
  try {
    const { year, album } = await params;
    logRequest(TAG, request, { msg: 'Delete video request', year, album });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoIndex = searchParams.get('index');

    if (videoIndex === null) {
      log(TAG, 'Video index missing');
      return NextResponse.json({ error: 'Video index is required' }, { status: 400 });
    }

    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    const metadata = await getAlbumMetadata(albumPath);

    if (!metadata) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const index = parseInt(videoIndex);
    if (index < 0 || index >= metadata.videos.length) {
      log(TAG, 'Invalid video index', { index, totalVideos: metadata.videos.length });
      return NextResponse.json({ error: 'Invalid video index' }, { status: 400 });
    }

    const updatedMetadata = {
      ...metadata,
      videos: metadata.videos.filter((_, i) => i !== index),
    };

    await saveAlbumMetadata(albumPath, updatedMetadata);

    log(TAG, 'Video deleted successfully', { year, album, index });

    return NextResponse.json({
      success: true,
      message: 'Video link removed successfully',
    });
  } catch (error) {
    logError(TAG, 'Error deleting video', error);
    return NextResponse.json({ error: 'Failed to remove video' }, { status: 500 });
  }
}