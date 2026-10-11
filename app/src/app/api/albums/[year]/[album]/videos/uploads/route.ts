import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { queryAlbumByYearAndUrlName, resolveAdminTenant } from '@/lib/queries';
import { createUploadSession, UploadTooLargeError } from '@/lib/video-uploads';
import { resolveVideoMimeType, videoChunkBytes, maxVideoBytes } from '@/lib/video-files';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Starts a chunked upload. Body: { filename, mimeType, size }. The size cap
// is checked here, before any bytes are sent, so an oversized file is
// refused immediately.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'POST /api/albums/[year]/[album]/videos/uploads';
  try {
    const { year, album } = await params;
    logRequest(TAG, request, { msg: 'Start chunked video upload', year, album });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    const tenantId = resolveAdminTenant(session);
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const albumData = queryAlbumByYearAndUrlName(tenantId, year, album);
    if (!albumData) return NextResponse.json({ error: 'Album not found' }, { status: 404 });

    const { filename, mimeType, size } = (await request.json().catch(() => ({}))) as {
      filename?: unknown;
      mimeType?: unknown;
      size?: unknown;
    };
    const name = typeof filename === 'string' ? filename.trim().slice(0, 255) : '';
    if (!name) return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0) {
      return NextResponse.json({ error: 'size must be a positive integer' }, { status: 400 });
    }

    const resolved = resolveVideoMimeType(typeof mimeType === 'string' ? mimeType : null, name);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Unsupported video type. Upload an MP4, WebM, MOV, M4V, or OGV file.' },
        { status: 415 }
      );
    }

    const upload = await createUploadSession(tenantId, {
      albumId: albumData.albumId,
      filename: name,
      mimeType: resolved,
      size,
    });

    return NextResponse.json({
      uploadId: upload.uploadId,
      chunkSize: videoChunkBytes(),
      received: 0,
      size,
      maxBytes: maxVideoBytes(),
    });
  } catch (error) {
    if (error instanceof UploadTooLargeError) {
      log(TAG, 'Upload refused - too large', { limit: error.limit });
      return NextResponse.json({ error: 'Video is too large', maxBytes: error.limit }, { status: 413 });
    }
    logError(TAG, 'Failed to start upload', error);
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 });
  }
}
