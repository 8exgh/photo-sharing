import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { updateVideoMetadata } from '@/lib/commands';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const TAG = 'PUT /api/videos/[videoId]';
  try {
    const { videoId } = await params;
    logRequest(TAG, request, { msg: 'Update video request', videoId });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, title } = await request.json();

    const MAX_TEXT_LENGTH = 10000;
    if ((typeof text === 'string' && text.length > MAX_TEXT_LENGTH) ||
        (typeof title === 'string' && title.length > MAX_TEXT_LENGTH)) {
      return NextResponse.json({ error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` }, { status: 400 });
    }

    const updated = updateVideoMetadata(videoId, {
      text: text !== undefined ? text : undefined,
      title: title !== undefined ? title : undefined,
    });

    if (!updated) {
      log(TAG, 'Video not found', { videoId });
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    log(TAG, 'Video updated successfully', { videoId });

    return NextResponse.json({
      success: true,
      message: 'Video updated successfully',
    });
  } catch (error) {
    logError(TAG, 'Error updating video', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
