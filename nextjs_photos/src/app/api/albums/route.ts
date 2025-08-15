import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAlbumDirectory, saveAlbumMetadata, getAllYears } from '@/lib/albums';
import { getAlbumsWithGroups, moveAlbumToGroup } from '@/lib/groups';
import { AlbumMetadata } from '@/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    
    if (year) {
      const albums = await getAlbumsWithGroups(year);
      return NextResponse.json({ albums });
    } else {
      const years = await getAllYears();
      return NextResponse.json({ years });
    }
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { name, year, location, description, groupId, datePrefix } = await request.json();
    
    if (!name || !year) {
      return NextResponse.json({ error: 'Name and year are required' }, { status: 400 });
    }
    
    // Create album name with optional date prefix
    const albumName = datePrefix ? `${datePrefix}-${name}` : name;
    
    let albumPath = await createAlbumDirectory(year, albumName);
    
    // Move to group if specified
    if (groupId) {
      albumPath = await moveAlbumToGroup(albumPath, year, groupId);
    }
    
    const metadata: AlbumMetadata = {
      name,
      location: location || '',
      description: description || '',
      text: '', // Initialize text field
      created: new Date().toISOString(),
      photos: [],
      videos: [],
    };
    
    await saveAlbumMetadata(albumPath, metadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Album created successfully',
      albumPath: albumPath.split('public/albums/')[1],
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}