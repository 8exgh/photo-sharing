import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { promises as fs } from 'fs';
import { join } from 'path';
import { isValidAccessKey } from '@/lib/access-keys';
import { sanitizePath, sanitizeFilename, isValidImageExtension } from '@/lib/security';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const TAG = 'GET /api/thumbnails';
  try {
    const { path } = await params;
    logRequest(TAG, request, { msg: 'Thumbnail request', pathLength: path?.length });

    // Use request-based session getter for more reliable cookie reading
    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAuthenticated) {
      log(TAG, 'Unauthorized - not authenticated', { path: path?.join('/') });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      const keyIsValid = await isValidAccessKey(session.accessKey);
      if (!keyIsValid) {
        log(TAG, 'Access key no longer valid, invalidating session', { keyPrefix: session.accessKey.substring(0, 8) + '...' });
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
      }
    }

    if (!path || path.length < 3) {
      log(TAG, 'Invalid path', { path: path?.join('/') });
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Sanitize all path components to prevent traversal
    const sanitizedPath = sanitizePath(path);
    if (!sanitizedPath) {
      log(TAG, 'Path sanitization failed', { path: path.join('/') });
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // The path now includes all folder levels: [year, groupOrAlbum, album, filename]
    // Or for ungrouped albums: [year, album, filename]
    // We need to reconstruct the path dynamically
    const filename = sanitizedPath[sanitizedPath.length - 1]; // Last element is always the filename
    const pathWithoutFilename = sanitizedPath.slice(0, -1); // All elements except filename

    // Additional validation for filename
    const cleanFilename = sanitizeFilename(filename);
    if (!cleanFilename || !isValidImageExtension(cleanFilename)) {
      log(TAG, 'Invalid filename', { filename });
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Construct the full path to the thumbnail using configurable albums directory
    const thumbnailPath = join(
      process.cwd(),
      process.env.ALBUMS_DIR || 'public/albums',
      ...pathWithoutFilename,
      'thumbnails',
      cleanFilename
    );

    try {
      // Check if file exists and read it
      const imageBuffer = await fs.readFile(thumbnailPath);

      // Determine content type based on file extension
      const extension = filename.toLowerCase().split('.').pop();
      let contentType = 'image/jpeg'; // Default fallback

      switch (extension) {
        case 'png':
          contentType = 'image/png';
          break;
        case 'webp':
          contentType = 'image/webp';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'jpg':
        case 'jpeg':
        default:
          contentType = 'image/jpeg';
          break;
      }

      log(TAG, 'Serving thumbnail', { filename: cleanFilename, size: imageBuffer.length, contentType });

      // Return the image with appropriate headers
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': imageBuffer.length.toString(),
        },
      });
    } catch (_fileError) {
      log(TAG, 'Thumbnail not found', { path: sanitizedPath.join('/') });
      // File not found or read error
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
  } catch (error) {
    logError(TAG, 'Thumbnail serving error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
