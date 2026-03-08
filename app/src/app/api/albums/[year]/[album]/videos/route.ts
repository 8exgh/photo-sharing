import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { addVideo, deleteVideo } from '@/lib/commands';
import { queryAlbumByYearAndUrlName } from '@/lib/queries';
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

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only HTTPS URLs allowed' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const MAX_TEXT_LENGTH = 10000;
    if (typeof title === 'string' && title.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` }, { status: 400 });
    }

    const albumData = queryAlbumByYearAndUrlName(year, album);
    if (!albumData) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const { videoId } = addVideo(albumData.albumId, url, title);

    log(TAG, 'Video added successfully', { year, album, videoId, title });

    return NextResponse.json({
      success: true,
      message: 'Video link added successfully',
      videoId,
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
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      log(TAG, 'Video ID missing');
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const deleted = deleteVideo(videoId);
    if (!deleted) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    log(TAG, 'Video deleted successfully', { year, album, videoId });

    return NextResponse.json({
      success: true,
      message: 'Video link removed successfully',
    });
  } catch (error) {
    logError(TAG, 'Error deleting video', error);
    return NextResponse.json({ error: 'Failed to remove video' }, { status: 500 });
  }
}
