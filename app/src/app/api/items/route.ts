import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { queryUnifiedYearItems, resolveSessionTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/items';
  try {
    logRequest(TAG, request, { msg: 'Request received' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAuthenticated) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the session's tenant (validates the access key for visitors)
    const tenantId = resolveSessionTenant(session);
    if (!tenantId) {
      log(TAG, 'No valid tenant for session');
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

    if (!year) {
      log(TAG, 'Year parameter missing');
      return NextResponse.json({ error: 'Year parameter is required' }, { status: 400 });
    }

    const items = queryUnifiedYearItems(tenantId, year);
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
