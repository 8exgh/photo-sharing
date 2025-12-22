import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { createAlbumDirectory, saveAlbumMetadata, getAllYears } from '@/lib/albums';
import { getAlbumsWithGroups, moveAlbumToGroup } from '@/lib/groups';
import { AlbumMetadata } from '@/types';
import { isValidAccessKey } from '@/lib/access-keys';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  const TAG = 'OPTIONS /api/albums';
  const response = new NextResponse(null, { status: 200 });

  // Set CORS headers for preflight
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  const origin = request.headers.get('origin');
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  logRequest(TAG, request, { msg: 'Preflight request handled', origin });

  return response;
}

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/albums';
  try {
    logRequest(TAG, request, { msg: 'Request received' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session state', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin, hasKey: !!session.accessKey });

    if (!session.isAuthenticated) {
      log(TAG, 'Not authenticated, denying access');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      log(TAG, 'Validating access key for non-admin session');
      const keyIsValid = await isValidAccessKey(session.accessKey);

      if (!keyIsValid) {
        log(TAG, 'Access key invalid, clearing session');
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        // Return the response that has the session cookie cleared
        return new NextResponse(JSON.stringify({ error: 'Access key is no longer valid' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
        });
      }
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (year) {
      const albums = await getAlbumsWithGroups(year);
      log(TAG, 'Fetched albums for year', { year, count: albums.length });
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
      log(TAG, 'Fetched all years', { count: years.length });
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
  } catch (error) {
    logError(TAG, 'Error fetching albums', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/albums';
  try {
    logRequest(TAG, request, { msg: 'Create album request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session state', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin, hasKey: !!session.accessKey });

    if (!session.isAdmin) {
      log(TAG, 'Authorization failed - not admin');
      return NextResponse.json({
        error: 'Unauthorized',
        debug: process.env.NODE_ENV !== 'production' ? {
          isAuthenticated: session.isAuthenticated,
          isAdmin: session.isAdmin,
          hasAccessKey: !!session.accessKey
        } : undefined
      }, { status: 401 });
    }

    log(TAG, 'Authorization successful, parsing request body');
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

    // Determine displayOrder based on context
    let displayOrder = 0;

    if (groupId) {
      // For albums in groups, use group-specific ordering
      const existingAlbums = await getAlbumsWithGroups(year);
      const groupAlbums = existingAlbums.filter(a => a.groupId === groupId);
      const maxOrder = groupAlbums.reduce((max, album) => {
        const order = album.metadata?.displayOrder ?? -1;
        return order > max ? order : max;
      }, -1);
      displayOrder = maxOrder + 1;
    } else {
      // For ungrouped albums, use unified ordering
      const { getUnifiedYearItems } = await import('@/lib/groups');
      const existingItems = await getUnifiedYearItems(year);
      const maxOrder = existingItems.reduce((max, item) => {
        const order = item.displayOrder ?? -1;
        return order > max ? order : max;
      }, -1);
      displayOrder = maxOrder + 1;
    }

    const metadata: AlbumMetadata = {
      name,
      location: location || '',
      description: description || '',
      text: '', // Initialize text field
      created: new Date().toISOString(),
      photos: [],
      videos: [],
      displayOrder: displayOrder,
    };
    
    await saveAlbumMetadata(albumPath, metadata);

    log(TAG, 'Album created successfully', { albumName, year, groupId, albumPath: albumPath.split('public/albums/')[1] });

    const jsonResponse = NextResponse.json({
      success: true,
      message: 'Album created successfully',
      albumPath: albumPath.split('public/albums/')[1],
    });

    // Add CORS headers if needed for production
    if (process.env.NODE_ENV === 'production') {
      jsonResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      const origin = request.headers.get('origin');
      if (origin) {
        jsonResponse.headers.set('Access-Control-Allow-Origin', origin);
      }
    }

    return jsonResponse;
  } catch (error) {
    logError(TAG, 'Error creating album', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}