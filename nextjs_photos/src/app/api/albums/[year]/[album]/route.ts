import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata, getAlbumPhotos } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
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
    
    const { name, location, description, text } = await request.json();
    const { year, album } = await params;
    
    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const existingMetadata = await getAlbumMetadata(targetAlbum.path);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const updatedMetadata: AlbumMetadata = {
      ...existingMetadata,
      name: name || existingMetadata.name,
      location: location !== undefined ? location : existingMetadata.location,
      description: description !== undefined ? description : existingMetadata.description,
      text: text !== undefined ? text : existingMetadata.text,
    };
    
    await saveAlbumMetadata(targetAlbum.path, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Album updated successfully',
      metadata: updatedMetadata,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}