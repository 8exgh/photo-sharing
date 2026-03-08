import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { updateAlbumText } from '@/lib/commands';
import { queryAlbumByYearAndUrlName } from '@/lib/queries';
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

    const MAX_TEXT_LENGTH = 10000;
    if (typeof text === 'string' && text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` }, { status: 400 });
    }

    const albumData = queryAlbumByYearAndUrlName(year, album);
    if (!albumData) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    updateAlbumText(albumData.albumId, text || '');

    log(TAG, 'Album text updated successfully', { year, album });

    return NextResponse.json({
      success: true,
      message: 'Album text updated successfully',
      text: text || '',
    });
  } catch (error) {
    logError(TAG, 'Error updating album text', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
