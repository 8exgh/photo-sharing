import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { updatePhotoText, deletePhoto } from '@/lib/commands';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const TAG = 'PUT /api/photos/[photoId]';
  try {
    const { photoId } = await params;
    logRequest(TAG, request, { msg: 'Update photo text request', photoId });

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

    const updated = updatePhotoText(photoId, text || '');
    if (!updated) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    log(TAG, 'Photo text updated successfully', { photoId });

    return NextResponse.json({
      success: true,
      message: 'Photo text updated successfully',
      text: text || '',
    });
  } catch (error) {
    logError(TAG, 'Error updating photo text', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const TAG = 'DELETE /api/photos/[photoId]';
  try {
    const { photoId } = await params;
    logRequest(TAG, request, { msg: 'Delete photo request', photoId });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleted = deletePhoto(photoId);
    if (!deleted) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    log(TAG, 'Photo deleted successfully', { photoId });

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    logError(TAG, 'Error deleting photo', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
