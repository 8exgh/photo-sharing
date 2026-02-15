import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { join } from 'path';
import { promises as fs } from 'fs';
import { sanitizeYear, sanitizeAlbumName, sanitizeFilename, isValidImageExtension } from '@/lib/security';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; filename: string }> }
) {
  const TAG = 'POST /api/albums/[year]/[album]/photos/[filename]/move';
  try {
    const { year: sourceYear, album: sourceAlbum, filename } = await params;
    logRequest(TAG, request, { msg: 'Move photo request', sourceYear, sourceAlbum, filename });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetYear, targetAlbum } = await request.json();
    
    // Sanitize all inputs to prevent path traversal
    const cleanSourceYear = sanitizeYear(sourceYear);
    const cleanSourceAlbum = sanitizeAlbumName(sourceAlbum);
    const cleanFilename = sanitizeFilename(filename);
    const cleanTargetYear = sanitizeYear(targetYear);
    const cleanTargetAlbum = sanitizeAlbumName(targetAlbum);
    
    if (!cleanSourceYear || !cleanSourceAlbum || !cleanFilename || 
        !cleanTargetYear || !cleanTargetAlbum) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    
    if (!isValidImageExtension(cleanFilename)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    
    // Don't move to the same album
    if (sourceYear === targetYear && sourceAlbum === targetAlbum) {
      return NextResponse.json({ error: 'Cannot move to the same album' }, { status: 400 });
    }
    
    // Find source album
    const sourceAlbums = await getAlbumsWithGroups(sourceYear);
    const sourceAlbumData = sourceAlbums.find(a => a.name === sourceAlbum);
    
    if (!sourceAlbumData) {
      return NextResponse.json({ error: 'Source album not found' }, { status: 404 });
    }
    
    // Find target album
    const targetAlbums = await getAlbumsWithGroups(targetYear);
    const targetAlbumData = targetAlbums.find(a => a.name === targetAlbum);
    
    if (!targetAlbumData) {
      return NextResponse.json({ error: 'Target album not found' }, { status: 404 });
    }
    
    const sourceAlbumPath = sourceAlbumData.path;
    const targetAlbumPath = targetAlbumData.path;
    
    // Get source album metadata
    const sourceMetadata = await getAlbumMetadata(sourceAlbumPath);
    if (!sourceMetadata) {
      return NextResponse.json({ error: 'Source album metadata not found' }, { status: 404 });
    }
    
    // Find the photo in source metadata
    const photoIndex = sourceMetadata.photos.findIndex(p => p.filename === cleanFilename);
    if (photoIndex === -1) {
      return NextResponse.json({ error: 'Photo not found in source album' }, { status: 404 });
    }
    
    const photoMetadata = sourceMetadata.photos[photoIndex];
    
    // Get target album metadata
    const targetMetadata = await getAlbumMetadata(targetAlbumPath);
    if (!targetMetadata) {
      return NextResponse.json({ error: 'Target album metadata not found' }, { status: 404 });
    }
    
    // Check if file already exists in target
    const targetPhotoPath = join(targetAlbumPath, cleanFilename);
    try {
      await fs.access(targetPhotoPath);
      // File exists, generate new filename
      const timestamp = Date.now();
      const newFilename = `${timestamp}-${cleanFilename}`;
      photoMetadata.filename = newFilename;
    } catch {
      // File doesn't exist, keep original filename
    }
    
    log(TAG, 'Moving photo', { from: `${sourceYear}/${sourceAlbum}`, to: `${targetYear}/${targetAlbum}`, filename });

    // Move the photo file
    const sourcePhotoPath = join(sourceAlbumPath, cleanFilename);
    const finalTargetPhotoPath = join(targetAlbumPath, photoMetadata.filename);

    try {
      const photoBuffer = await fs.readFile(sourcePhotoPath);
      await fs.writeFile(finalTargetPhotoPath, photoBuffer);
      await fs.unlink(sourcePhotoPath);
    } catch (fileError) {
      log(TAG, 'Error moving photo file', { error: fileError instanceof Error ? fileError.message : String(fileError) });
      return NextResponse.json({ error: 'Failed to move photo file' }, { status: 500 });
    }

    // Move the thumbnail if it exists
    const sourceThumbnailPath = join(sourceAlbumPath, 'thumbnails', cleanFilename);
    const targetThumbnailDir = join(targetAlbumPath, 'thumbnails');
    const finalTargetThumbnailPath = join(targetThumbnailDir, photoMetadata.filename);

    try {
      // Ensure target thumbnail directory exists
      await fs.mkdir(targetThumbnailDir, { recursive: true });

      const thumbnailBuffer = await fs.readFile(sourceThumbnailPath);
      await fs.writeFile(finalTargetThumbnailPath, thumbnailBuffer);
      await fs.unlink(sourceThumbnailPath);
    } catch (thumbError) {
      // Thumbnail might not exist or couldn't be moved - not critical
      log(TAG, 'Thumbnail move skipped', { error: thumbError instanceof Error ? thumbError.message : String(thumbError) });
    }

    // Update source album metadata (remove photo)
    const updatedSourcePhotos = sourceMetadata.photos.filter((_, index) => index !== photoIndex);
    const updatedSourceMetadata = {
      ...sourceMetadata,
      photos: updatedSourcePhotos,
    };
    await saveAlbumMetadata(sourceAlbumPath, updatedSourceMetadata);

    // Update target album metadata (add photo)
    const updatedTargetPhotos = [...targetMetadata.photos, photoMetadata];
    const updatedTargetMetadata = {
      ...targetMetadata,
      photos: updatedTargetPhotos,
    };
    await saveAlbumMetadata(targetAlbumPath, updatedTargetMetadata);

    log(TAG, 'Photo moved successfully', { from: `${sourceYear}/${sourceAlbum}`, to: `${targetYear}/${targetAlbum}`, newFilename: photoMetadata.filename });

    return NextResponse.json({
      success: true,
      message: 'Photo moved successfully',
      newFilename: photoMetadata.filename,
    });
  } catch (error) {
    logError(TAG, 'Error moving photo', error);
    return NextResponse.json({ error: 'Failed to move photo' }, { status: 500 });
  }
}