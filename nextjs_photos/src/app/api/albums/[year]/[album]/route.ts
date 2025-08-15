import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata, getAlbumPhotos, moveAlbumToYear } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
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
    
    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const metadata = await getAlbumMetadata(targetAlbum.path);
    const photos = await getAlbumPhotos(targetAlbum.path);
    
    if (!metadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      metadata,
      photos,
      albumPath: targetAlbum.path.split('public/albums/')[1],
      groupId: targetAlbum.groupId,
      isNested: targetAlbum.isNested,
    });
  } catch (_error) {
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
    
    const { name, location, description, text, year: newYear } = await request.json();
    const { year: currentYear, album } = await params;
    
    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(currentYear);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const existingMetadata = await getAlbumMetadata(targetAlbum.path);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    let finalPath = targetAlbum.path;
    let yearChanged = false;
    
    // Check if year needs to be changed
    if (newYear && newYear !== currentYear) {
      try {
        finalPath = await moveAlbumToYear(
          targetAlbum.path, 
          newYear, 
          album,
          targetAlbum.groupId
        );
        yearChanged = true;
      } catch (_error) {
        return NextResponse.json({ 
          error: _error instanceof Error ? _error.message : 'Failed to move album to new year' 
        }, { status: 400 });
      }
    }
    
    const updatedMetadata: AlbumMetadata = {
      ...existingMetadata,
      name: name || existingMetadata.name,
      location: location !== undefined ? location : existingMetadata.location,
      description: description !== undefined ? description : existingMetadata.description,
      text: text !== undefined ? text : existingMetadata.text,
    };
    
    await saveAlbumMetadata(finalPath, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: yearChanged 
        ? `Album updated and moved to ${newYear} successfully!` 
        : 'Album updated successfully',
      metadata: updatedMetadata,
      yearChanged,
      newYear: yearChanged ? newYear : currentYear,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}