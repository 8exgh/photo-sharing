import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAlbumDirectory, saveAlbumMetadata, getAllYears } from '@/lib/albums';
import { getAlbumsWithGroups, moveAlbumToGroup } from '@/lib/groups';
import { AlbumMetadata } from '@/types';
import { isValidAccessKey } from '@/lib/access-keys';

export const runtime = 'nodejs';

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  
  // Set CORS headers for preflight
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  
  const origin = request.headers.get('origin');
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  console.log('[OPTIONS /api/albums] Preflight request handled for origin:', origin);
  
  return response;
}

export async function GET(request: NextRequest) {
  try {
    console.log('[GET /api/albums] Request received:', {
      timestamp: new Date().toISOString(),
      url: request.url,
      headers: {
        cookie: request.headers.get('cookie')?.substring(0, 50) + '...',
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
      }
    });
    
    const session = await getSession();
    
    console.log('[GET /api/albums] Session state:', {
      isAuthenticated: session.isAuthenticated,
      isAdmin: session.isAdmin,
      accessKey: session.accessKey ? 'present' : 'none',
    });
    
    if (!session.isAuthenticated) {
      console.log('[GET /api/albums] Not authenticated, denying access');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      console.log('[GET /api/albums] Validating access key for non-admin session');
      const keyIsValid = await isValidAccessKey(session.accessKey);
      console.log('[GET /api/albums] Access key validation result:', keyIsValid);
      
      if (!keyIsValid) {
        console.log('[GET /api/albums] Access key invalid, clearing session');
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
    // Enhanced logging for debugging
    console.log('[POST /api/albums] Request received:', {
      timestamp: new Date().toISOString(),
      headers: {
        cookie: request.headers.get('cookie')?.substring(0, 50) + '...', // Truncate for security
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        contentType: request.headers.get('content-type'),
      },
      url: request.url,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasSessionSecret: !!process.env.SESSION_SECRET,
        sessionSecretLength: process.env.SESSION_SECRET?.length,
      }
    });

    const session = await getSession();
    
    console.log('[POST /api/albums] Session state:', {
      isAuthenticated: session.isAuthenticated,
      isAdmin: session.isAdmin,
      accessKey: session.accessKey ? 'present' : 'none',
      sessionKeys: Object.keys(session),
    });
    
    if (!session.isAdmin) {
      console.log('[POST /api/albums] Authorization failed - not admin:', {
        sessionData: JSON.stringify(session),
        reason: !session.isAuthenticated ? 'not authenticated' : 'not admin'
      });
      return NextResponse.json({ 
        error: 'Unauthorized',
        debug: process.env.NODE_ENV !== 'production' ? {
          isAuthenticated: session.isAuthenticated,
          isAdmin: session.isAdmin,
          hasAccessKey: !!session.accessKey
        } : undefined
      }, { status: 401 });
    }
    
    console.log('[POST /api/albums] Authorization successful, parsing request body...');
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

    // Get existing albums to determine displayOrder
    const existingAlbums = await getAlbumsWithGroups(year);
    const contextAlbums = groupId
      ? existingAlbums.filter(a => a.groupId === groupId)
      : existingAlbums.filter(a => !a.groupId);

    // Assign the next displayOrder (add to the end)
    const maxOrder = contextAlbums.reduce((max, album) => {
      const order = album.metadata?.displayOrder ?? -1;
      return order > max ? order : max;
    }, -1);

    const metadata: AlbumMetadata = {
      name,
      location: location || '',
      description: description || '',
      text: '', // Initialize text field
      created: new Date().toISOString(),
      photos: [],
      videos: [],
      displayOrder: maxOrder + 1,
    };
    
    await saveAlbumMetadata(albumPath, metadata);
    
    console.log('[POST /api/albums] Album created successfully:', {
      albumName,
      year,
      groupId,
      albumPath: albumPath.split('public/albums/')[1]
    });
    
    const response = NextResponse.json({ 
      success: true, 
      message: 'Album created successfully',
      albumPath: albumPath.split('public/albums/')[1],
    });
    
    // Add CORS headers if needed for production
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      const origin = request.headers.get('origin');
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      }
    }
    
    return response;
  } catch (error) {
    console.error('[POST /api/albums] Error creating album:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}