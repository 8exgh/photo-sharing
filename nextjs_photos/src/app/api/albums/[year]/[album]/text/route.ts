import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { join } from 'path';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { text } = await request.json();
    const { year, album } = await params;
    
    // First, try to find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const existingMetadata = await getAlbumMetadata(targetAlbum.path);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const updatedMetadata = {
      ...existingMetadata,
      text: text || '',
    };
    
    await saveAlbumMetadata(targetAlbum.path, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Album text updated successfully',
      text: updatedMetadata.text,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}