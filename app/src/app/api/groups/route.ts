import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';
import { createGroup } from '@/lib/commands';
import { queryGroupsByYear, resolveAdminTenant, resolveSessionTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/groups';
  logRequest(TAG, request, { msg: 'Request received' });

  const sessionData = await validateSession(request);

  if (!sessionData.isAuthenticated) {
    log(TAG, 'Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve the session's tenant (validates the access key for visitors)
  const tenantId = resolveSessionTenant(sessionData);
  if (!tenantId) {
    log(TAG, 'No valid tenant for session');
    return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');

  if (!year) {
    log(TAG, 'Year parameter missing');
    return NextResponse.json({ error: 'Year parameter required' }, { status: 400 });
  }

  try {
    const groups = queryGroupsByYear(tenantId, year);
    log(TAG, 'Groups fetched', { year, count: groups.length });
    return NextResponse.json(
      { groups },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (error) {
    logError(TAG, 'Error fetching groups', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/groups';
  logRequest(TAG, request, { msg: 'Create group request' });

  const sessionData = await validateSession(request);
  const tenantId = resolveAdminTenant(sessionData);
  if (!tenantId) {
    log(TAG, 'Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { year, groupName, displayName, description } = await request.json();

    if (!year || !groupName || !displayName) {
      log(TAG, 'Missing required fields', { year, groupName, displayName });
      return NextResponse.json(
        { error: 'Year, group name, and display name are required' },
        { status: 400 }
      );
    }

    const { groupId } = createGroup(tenantId, { year, groupName, displayName, description: description || '' });
    const groups = queryGroupsByYear(tenantId, year);
    const group = groups.find(g => g.id === groupId);

    log(TAG, 'Group created', { year, groupName, displayName });
    return NextResponse.json({ group });
  } catch (error) {
    logError(TAG, 'Error creating group', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
