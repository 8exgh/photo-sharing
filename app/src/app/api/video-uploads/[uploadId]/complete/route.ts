import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { resolveAdminTenant } from '@/lib/queries';
import { completeUpload, IncompleteUploadError, UploadBusyError, UploadNotFoundError } from '@/lib/video-uploads';
import { logRequest, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Finishes a chunked upload once every byte has arrived. The video then shows
// up in its album as "processing" and the background job converts it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  const TAG = 'POST /api/video-uploads/[uploadId]/complete';
  try {
    const { uploadId } = await params;
    const response = new NextResponse();
    const tenantId = resolveAdminTenant(await getSessionFromRequest(request, response));
    if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { videoId } = await completeUpload(tenantId, uploadId);
    logRequest(TAG, request, { msg: 'Upload completed', uploadId, videoId });
    return NextResponse.json({ success: true, message: 'Video uploaded successfully', videoId });
  } catch (error) {
    if (error instanceof UploadNotFoundError) {
      return NextResponse.json({ error: error.message || 'Upload not found' }, { status: 404 });
    }
    if (error instanceof IncompleteUploadError) {
      return NextResponse.json({ error: error.message, received: error.received, size: error.size }, { status: 409 });
    }
    if (error instanceof UploadBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    logError(TAG, 'Complete upload error', error);
    return NextResponse.json({ error: 'Could not finish upload' }, { status: 500 });
  }
}
