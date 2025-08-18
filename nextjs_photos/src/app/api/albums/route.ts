import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAlbumDirectory, saveAlbumMetadata, getAllYears } from '@/lib/albums';
import { getAlbumsWithGroups, moveAlbumToGroup } from '@/lib/groups';
import { AlbumMetadata } from '@/types';
import { isValidAccessKey } from '@/lib/access-keys';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      const keyIsValid = await isValidAccessKey(session.accessKey);
      if (!keyIsValid) {
        // Clear invalid session
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
      }
    }
    
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    
    if (year) {
      const albums = await getAlbumsWithGroups(year);
      return NextResponse.json(
        { albums },
        { 
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
    } else {
      const years = await getAllYears();
      return NextResponse.json(
        { years },
        { 
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
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