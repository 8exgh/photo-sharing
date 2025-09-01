import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumsWithGroups } from '@/lib/groups';
import { join } from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { sanitizeYear, sanitizeAlbumName, sanitizeFilename, isValidImageExtension } from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; filename: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { year, album, filename } = await params;
    
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
    
    const albumPath = targetAlbum.path;
    const photoPath = join(albumPath, cleanFilename);
    const thumbnailPath = join(albumPath, 'thumbnails', cleanFilename);
    
    // Check if files exist
    try {
      await fs.access(photoPath);
    } catch {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    
    // Rotate the original photo
    const photoBuffer = await fs.readFile(photoPath);
    const rotatedPhotoBuffer = await sharp(photoBuffer)
      .rotate(90) // Rotate 90 degrees clockwise
      .toBuffer();
    
    await fs.writeFile(photoPath, rotatedPhotoBuffer);
    
    // Rotate the thumbnail if it exists
    try {
      await fs.access(thumbnailPath);
      const thumbnailBuffer = await fs.readFile(thumbnailPath);
      const rotatedThumbnailBuffer = await sharp(thumbnailBuffer)
        .rotate(90) // Rotate 90 degrees clockwise
        .toBuffer();
      
      await fs.writeFile(thumbnailPath, rotatedThumbnailBuffer);
    } catch {
      // Thumbnail doesn't exist or couldn't be rotated - not critical
      console.log('Thumbnail rotation skipped:', cleanFilename);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Photo rotated successfully',
    });
  } catch (error) {
    console.error('Error rotating photo:', error);
    return NextResponse.json({ error: 'Failed to rotate photo' }, { status: 500 });
  }
}