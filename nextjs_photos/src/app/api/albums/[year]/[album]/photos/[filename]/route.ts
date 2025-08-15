import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { join } from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; filename: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { text } = await request.json();
    const { year, album, filename } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    
    const existingMetadata = await getAlbumMetadata(albumPath);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    // Find the photo in the metadata
    const photoIndex = existingMetadata.photos.findIndex(p => p.filename === filename);
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
    
    await saveAlbumMetadata(albumPath, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Photo text updated successfully',
      text: updatedPhotos[photoIndex].text,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; filename: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { year, album, filename } = await params;
    
    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const albumPath = targetAlbum.path;
    const photoPath = join(albumPath, filename);
    const thumbnailPath = join(albumPath, 'thumbnails', filename);
    
    // Get existing metadata
    const existingMetadata = await getAlbumMetadata(albumPath);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    // Find the photo in the metadata
    const photoIndex = existingMetadata.photos.findIndex(p => p.filename === filename);
    if (photoIndex === -1) {
      return NextResponse.json({ error: 'Photo not found in metadata' }, { status: 404 });
    }
    
    // Delete the physical files
    try {
      await fs.unlink(photoPath);
    } catch (_err) {
      const error = _err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') {
        console.error('Error deleting photo file:', _err);
      }
    }
    
    try {
      await fs.unlink(thumbnailPath);
    } catch (_err) {
      const error = _err as NodeJS.ErrnoException;
      if (error.code !== 'ENOENT') {
        console.error('Error deleting thumbnail file:', _err);
      }
    }
    
    // Remove the photo from metadata
    const updatedPhotos = existingMetadata.photos.filter((_, index) => index !== photoIndex);
    
    const updatedMetadata = {
      ...existingMetadata,
      photos: updatedPhotos,
    };
    
    await saveAlbumMetadata(albumPath, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Photo deleted successfully',
    });
  } catch (_error) {
    console.error('Error deleting photo:', _error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}