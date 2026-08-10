import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { resolveSessionTenant } from '@/lib/queries';
import { tenantThumbnailsDir } from '@/lib/tenants';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const TAG = 'GET /api/thumbnails/[photoId]';
  try {
    const { photoId } = await params;
    logRequest(TAG, request, { msg: 'Thumbnail request', photoId });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAuthenticated) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the session's tenant (validates the access key for visitors) —
    // thumbnails are only served from that tenant's own folder
    const tenantId = resolveSessionTenant(session);
    if (!tenantId) {
      log(TAG, 'No valid tenant for session');
      session.isAuthenticated = false;
      session.accessKey = undefined;
      await session.save();
      return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
    }

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(photoId)) {
      log(TAG, 'Invalid photoId format', { photoId });
      return NextResponse.json({ error: 'Invalid photo ID' }, { status: 400 });
    }

    const thumbnailPath = join(tenantThumbnailsDir(tenantId), `${photoId}.jpg`);

    try {
      const imageBuffer = await fs.readFile(thumbnailPath);

      log(TAG, 'Serving thumbnail', { photoId, size: imageBuffer.length });

      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': imageBuffer.length.toString(),
        },
      });
    } catch {
      log(TAG, 'Thumbnail not found', { photoId });
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }
  } catch (error) {
    logError(TAG, 'Thumbnail serving error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
