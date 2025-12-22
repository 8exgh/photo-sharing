import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { join } from 'path';
import { promises as fs } from 'fs';
import { sanitizeYear, sanitizeAlbumName, sanitizeFilename, isValidImageExtension } from '@/lib/security';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; filename: string }> }
) {
  const TAG = 'PUT /api/albums/[year]/[album]/photos/[filename]';
  try {
    const { year, album, filename } = await params;
    logRequest(TAG, request, { msg: 'Update photo text request', year, album, filename });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text } = await request.json();
    
    // Sanitize inputs to prevent path traversal
    const cleanYear = sanitizeYear(year);
    const cleanAlbum = sanitizeAlbumName(album);
    const cleanFilename = sanitizeFilename(filename);
    
    if (!cleanYear || !cleanAlbum || !cleanFilename) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    
    if (!isValidImageExtension(cleanFilename)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    
    // Find the album using the group-aware function to get the correct path
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const existingMetadata = await getAlbumMetadata(targetAlbum.path);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album metadata not found' }, { status: 404 });
    }
    
    // Find the photo in the metadata
    const photoIndex = existingMetadata.photos.findIndex(p => p.filename === cleanFilename);
    if (photoIndex === -1) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    
    // Update the photo text
    const updatedPhotos = [...existingMetadata.photos];
    updatedPhotos[photoIndex] = {
      ...updatedPhotos[photoIndex],
      text: text || '',
    };
    
    const updatedMetadata = {
      ...existingMetadata,
      photos: updatedPhotos,
    };
    
    await saveAlbumMetadata(targetAlbum.path, updatedMetadata);

    log(TAG, 'Photo text updated successfully', { year, album, filename });

    return NextResponse.json({
      success: true,
      message: 'Photo text updated successfully',
      text: updatedPhotos[photoIndex].text,
    });
  } catch (error) {
    logError(TAG, 'Error updating photo text', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; filename: string }> }
) {
  const TAG = 'DELETE /api/albums/[year]/[album]/photos/[filename]';
  try {
    const { year, album, filename } = await params;
    logRequest(TAG, request, { msg: 'Delete photo request', year, album, filename });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Sanitize inputs to prevent path traversal
    const cleanYear = sanitizeYear(year);
    const cleanAlbum = sanitizeAlbumName(album);
    const cleanFilename = sanitizeFilename(filename);
    
    if (!cleanYear || !cleanAlbum || !cleanFilename) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    
    if (!isValidImageExtension(cleanFilename)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    
    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const albumPath = targetAlbum.path;
    const photoPath = join(albumPath, cleanFilename);
    const thumbnailPath = join(albumPath, 'thumbnails', cleanFilename);
    
    // Get existing metadata
    const existingMetadata = await getAlbumMetadata(albumPath);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    // Find the photo in the metadata
    const photoIndex = existingMetadata.photos.findIndex(p => p.filename === cleanFilename);
    if (photoIndex === -1) {
      return NextResponse.json({ error: 'Photo not found in metadata' }, { status: 404 });
    }
    
    log(TAG, 'Deleting photo files', { photoPath, thumbnailPath });

    // Delete the physical files
    try {
      await fs.unlink(photoPath);
    } catch (_err) {
      const error = _err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') {
        log(TAG, 'Error deleting photo file', { error: error.message });
      }
    }

    try {
      await fs.unlink(thumbnailPath);
    } catch (_err) {
      const error = _err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') {
        log(TAG, 'Error deleting thumbnail file', { error: error.message });
      }
    }

    // Remove the photo from metadata
    const updatedPhotos = existingMetadata.photos.filter((_, index) => index !== photoIndex);

    const updatedMetadata = {
      ...existingMetadata,
      photos: updatedPhotos,
    };

    await saveAlbumMetadata(targetAlbum.path, updatedMetadata);

    log(TAG, 'Photo deleted successfully', { year, album, filename });

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    logError(TAG, 'Error deleting photo', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}