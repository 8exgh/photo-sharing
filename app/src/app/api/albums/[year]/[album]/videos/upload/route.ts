import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { uploadVideoFile, VideoTooLargeError } from '@/lib/commands';
import { queryAlbumByYearAndUrlName, resolveAdminTenant } from '@/lib/queries';
import { maxVideoBytes, resolveVideoMimeType } from '@/lib/video-files';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Raw-body upload: the client sends the file bytes as the request body with
// its MIME type in Content-Type and the name in ?filename=. Unlike multipart
// form parsing this lets the server stream the body to disk without
// buffering the whole video in memory.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'POST /api/albums/[year]/[album]/videos/upload';
  try {
    const { year, album } = await params;
    logRequest(TAG, request, { msg: 'Upload video request', year, album });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const albumData = queryAlbumByYearAndUrlName(tenantId, year, album);
    if (!albumData) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const filename = (request.nextUrl.searchParams.get('filename') || '').trim().slice(0, 255);
    if (!filename) {
      return NextResponse.json({ error: 'filename query parameter is required' }, { status: 400 });
    }

    const mimeType = resolveVideoMimeType(request.headers.get('content-type'), filename);
    if (!mimeType) {
      return NextResponse.json(
        { error: 'Unsupported video type. Upload an MP4, WebM, MOV, M4V, or OGV file.' },
        { status: 415 }
      );
    }

    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxVideoBytes()) {
      return NextResponse.json({ error: 'Video is too large' }, { status: 413 });
    }

    if (!request.body) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const { videoId, fileSize } = await uploadVideoFile(tenantId, albumData.albumId, {
      filename,
      mimeType,
      body: request.body,
    });

    log(TAG, 'Video uploaded successfully', { year, album, videoId, fileSize });

    return NextResponse.json({
      success: true,
      message: 'Video uploaded successfully',
      videoId,
    });
  } catch (error) {
    if (error instanceof VideoTooLargeError) {
      log(TAG, 'Video too large', { limit: error.limit });
      return NextResponse.json({ error: 'Video is too large' }, { status: 413 });
    }
    logError(TAG, 'Video upload error', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
