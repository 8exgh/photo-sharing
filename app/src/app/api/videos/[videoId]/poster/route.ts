import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { getSessionFromRequest } from '@/lib/session';
import { queryVideoById, resolveSessionTenant } from '@/lib/queries';
import { videoPosterPath } from '@/lib/video-storage';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Poster frame extracted by the background processor; same access rules as
// the stream itself.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const TAG = 'GET /api/videos/[videoId]/poster';
  try {
    const { videoId } = await params;
    logRequest(TAG, request, { msg: 'Video poster request', videoId });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = resolveSessionTenant(session);
    if (!tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!UUID.test(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const video = queryVideoById(tenantId, videoId);
    if (!video?.file?.poster) {
      log(TAG, 'No poster for video', { videoId });
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }

    try {
      const image = await fs.readFile(videoPosterPath(tenantId, videoId));
      return new NextResponse(image, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(image.length),
          'Cache-Control': 'private, max-age=86400',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Poster not found' }, { status: 404 });
    }
  } catch (error) {
    logError(TAG, 'Poster serving error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
