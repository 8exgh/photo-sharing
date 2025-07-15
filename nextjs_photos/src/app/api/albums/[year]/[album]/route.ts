import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata, getAlbumPhotos } from '@/lib/albums';
import { join } from 'path';
import { AlbumMetadata } from '@/types';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { year, album } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    const metadata = await getAlbumMetadata(albumPath);
    const photos = await getAlbumPhotos(albumPath);
    
    if (!metadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      metadata,
      photos,
      albumPath: `${year}/${album}`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { name, location, description } = await request.json();
    const { year, album } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    
    const existingMetadata = await getAlbumMetadata(albumPath);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const updatedMetadata: AlbumMetadata = {
      ...existingMetadata,
      name: name || existingMetadata.name,
      location: location !== undefined ? location : existingMetadata.location,
      description: description !== undefined ? description : existingMetadata.description,
    };
    
    await saveAlbumMetadata(albumPath, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Album updated successfully',
      metadata: updatedMetadata,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}