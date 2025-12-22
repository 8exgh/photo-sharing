import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getUnifiedYearItems } from '@/lib/groups';
import { isValidAccessKey } from '@/lib/access-keys';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/items';
  try {
    logRequest(TAG, request, { msg: 'Request received' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAuthenticated) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      const keyIsValid = await isValidAccessKey(session.accessKey);
      if (!keyIsValid) {
        log(TAG, 'Access key no longer valid');
        // Clear invalid session
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        // Return with session cookie headers
        return new NextResponse(JSON.stringify({ error: 'Access key is no longer valid' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
        });
      }
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (!year) {
      log(TAG, 'Year parameter missing');
      return NextResponse.json({ error: 'Year parameter is required' }, { status: 400 });
    }

    const items = await getUnifiedYearItems(year);
    log(TAG, 'Items fetched', { year, count: items.length });

    return NextResponse.json(
      { items },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (error) {
    logError(TAG, 'Error fetching unified items', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}