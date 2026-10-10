import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, promises as fs } from 'fs';
import { Readable } from 'stream';
import { getSessionFromRequest } from '@/lib/session';
import { queryVideoById, resolveSessionTenant } from '@/lib/queries';
import { videoFilePath } from '@/lib/commands';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Parses a single-range "bytes=start-end" header against a file of `size`
// bytes. Returns null when there is no usable range (serve the whole file)
// and 'unsatisfiable' when the range lies outside the file.
function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'unsatisfiable' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;

  let start: number;
  let end: number;
  if (match[1] === '') {
    // Suffix range: the last N bytes
    const suffix = Number(match[2]);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

// Serves an uploaded video with HTTP range support so browsers can start
// playback immediately and seek without downloading the whole file. The body
// is a file stream — nothing is buffered in memory.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const TAG = 'GET /api/videos/[videoId]/stream';
  try {
    const { videoId } = await params;
    logRequest(TAG, request, { msg: 'Video stream request', videoId, range: request.headers.get('range') });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAuthenticated) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only this session's own tenant's videos are reachable
    const tenantId = resolveSessionTenant(session);
    if (!tenantId) {
      log(TAG, 'No valid tenant for session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!UUID.test(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const video = queryVideoById(tenantId, videoId);
    if (!video?.file) {
      log(TAG, 'Video not found', { videoId });
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const path = videoFilePath(tenantId, videoId, video.file.mimeType);
    let size: number;
    try {
      size = (await fs.stat(path)).size;
    } catch {
      log(TAG, 'Video file missing on disk', { videoId });
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const headers: Record<string, string> = {
      'Content-Type': video.file.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    };

    const range = parseRange(request.headers.get('range'), size);
    if (range === 'unsatisfiable') {
      log(TAG, 'Unsatisfiable range', { videoId, size });
      return new NextResponse(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${size}` },
      });
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : size - 1;
    headers['Content-Length'] = String(end - start + 1);
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;

    if (request.method === 'HEAD') {
      return new NextResponse(null, { status: range ? 206 : 200, headers });
    }

    log(TAG, 'Streaming video', { videoId, start, end, size });
    const fileStream = createReadStream(path, { start, end });
    const body = Readable.toWeb(fileStream) as ReadableStream<Uint8Array>;
    return new NextResponse(body, { status: range ? 206 : 200, headers });
  } catch (error) {
    logError(TAG, 'Video streaming error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const HEAD = GET;
