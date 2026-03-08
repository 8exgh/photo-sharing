import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { uploadPhoto } from '@/lib/commands';
import { queryAlbumByYearAndUrlName } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'POST /api/albums/[year]/[album]/upload';
  try {
    const { year, album } = await params;
    logRequest(TAG, request, { msg: 'Upload photo request', year, album });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const albumData = queryAlbumByYearAndUrlName(year, album);
    if (!albumData) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const { photoId } = await uploadPhoto(albumData.albumId, file);

    log(TAG, 'Photo uploaded successfully', { year, album, photoId });

    return NextResponse.json({
      success: true,
      message: 'Photo uploaded successfully',
      photoId,
    });
  } catch (error) {
    logError(TAG, 'Upload error', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
