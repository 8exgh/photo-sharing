import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';

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
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}