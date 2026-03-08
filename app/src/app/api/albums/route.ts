import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { createAlbum } from '@/lib/commands';
import { queryAllYears, queryAlbumsWithGroupsByYear, queryIsValidAccessKey } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

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

    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      log(TAG, 'Validating access key for non-admin session');
      const keyIsValid = queryIsValidAccessKey(session.accessKey);

      if (!keyIsValid) {
        log(TAG, 'Access key invalid, clearing session');
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        return new NextResponse(JSON.stringify({ error: 'Access key is no longer valid' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
        });
      }
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (year) {
      const albums = queryAlbumsWithGroupsByYear(year);
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
      const years = queryAllYears();
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

    const MAX_TEXT_LENGTH = 10000;
    if ((typeof name === 'string' && name.length > MAX_TEXT_LENGTH) ||
        (typeof description === 'string' && description.length > MAX_TEXT_LENGTH) ||
        (typeof location === 'string' && location.length > MAX_TEXT_LENGTH)) {
      return NextResponse.json({ error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` }, { status: 400 });
    }

    const { albumId, urlName } = createAlbum({ name, year, location, description, groupId, datePrefix });

    log(TAG, 'Album created successfully', { albumId, urlName, year, groupId });

    const jsonResponse = NextResponse.json({
      success: true,
      message: 'Album created successfully',
      albumId,
      urlName,
    });

    return jsonResponse;
  } catch (error) {
    logError(TAG, 'Error creating album', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
