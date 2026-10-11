import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { resolveAdminTenant } from '@/lib/queries';
import {
  abortUpload,
  appendUploadChunk,
  ChunkTooLargeError,
  OffsetMismatchError,
  readUploadSession,
  UploadBusyError,
  UploadNotFoundError,
} from '@/lib/video-uploads';
import { videoChunkBytes } from '@/lib/video-files';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

async function adminTenant(request: NextRequest): Promise<string | null> {
  const response = new NextResponse();
  return resolveAdminTenant(await getSessionFromRequest(request, response));
}

// Status of an upload session: how much has arrived, for resuming
export async function GET(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const TAG = 'GET /api/video-uploads/[uploadId]';
  try {
    const { uploadId } = await params;
    const tenantId = await adminTenant(request);
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { session, received } = await readUploadSession(tenantId, uploadId);
    return NextResponse.json({
      uploadId,
      filename: session.filename,
      albumId: session.albumId,
      size: session.size,
      received,
      chunkSize: videoChunkBytes(),
    });
  } catch (error) {
    if (error instanceof UploadNotFoundError) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    logError(TAG, 'Upload status error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// One chunk, as the raw request body, starting at ?offset=
export async function PUT(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const TAG = 'PUT /api/video-uploads/[uploadId]';
  try {
    const { uploadId } = await params;
    const tenantId = await adminTenant(request);
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const offset = Number(request.nextUrl.searchParams.get('offset'));
    if (!Number.isSafeInteger(offset) || offset < 0) {
      return NextResponse.json({ error: 'offset must be a non-negative integer' }, { status: 400 });
    }
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > videoChunkBytes()) {
      return NextResponse.json({ error: 'Chunk is too large' }, { status: 413 });
    }
    if (!request.body) return NextResponse.json({ error: 'Empty chunk' }, { status: 400 });

    const result = await appendUploadChunk(tenantId, uploadId, offset, request.body);
    logRequest(TAG, request, { msg: 'Chunk stored', uploadId, offset, received: result.received, size: result.size });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UploadNotFoundError) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }
    if (error instanceof OffsetMismatchError) {
      return NextResponse.json({ error: error.message, received: error.received }, { status: 409 });
    }
    if (error instanceof UploadBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ChunkTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    logError(TAG, 'Chunk upload error', error);
    return NextResponse.json({ error: 'Chunk upload failed' }, { status: 500 });
  }
}

// Cancel: drop the session and its bytes
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const TAG = 'DELETE /api/video-uploads/[uploadId]';
  try {
    const { uploadId } = await params;
    const tenantId = await adminTenant(request);
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const removed = await abortUpload(tenantId, uploadId);
    log(TAG, 'Upload cancelled', { uploadId, removed });
    return removed
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  } catch (error) {
    logError(TAG, 'Cancel upload error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
