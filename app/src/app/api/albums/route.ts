import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { createAlbum } from '@/lib/commands';
import { queryAllYears, queryAlbumsWithGroupsByYear, resolveAdminTenant, resolveSessionTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  const TAG = 'OPTIONS /api/albums';
  const response = new NextResponse(null, { status: 200 });

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

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session state', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin, hasKey: !!session.accessKey });

    if (!session.isAuthenticated) {
      log(TAG, 'Not authenticated, denying access');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the session's tenant (validates the access key for visitors)
    const tenantId = resolveSessionTenant(session);
    if (!tenantId) {
      log(TAG, 'No valid tenant for session, clearing session');
      session.isAuthenticated = false;
      session.accessKey = undefined;
      await session.save();
      return new NextResponse(JSON.stringify({ error: 'Access key is no longer valid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
      });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (year) {
      const albums = queryAlbumsWithGroupsByYear(tenantId, year);
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
      const years = queryAllYears(tenantId);
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

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session state', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin, hasKey: !!session.accessKey });

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
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

    const { albumId, urlName } = createAlbum(tenantId, { name, year, location, description, groupId, datePrefix });

    log(TAG, 'Album created successfully', { albumId, urlName, year, groupId });

    const jsonResponse = NextResponse.json({
      success: true,
      message: 'Album created successfully',
      albumId,
      urlName,
    });

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
