import { NextRequest, NextResponse } from 'next/server';
import { getGroupsByYear, createGroup } from '@/lib/groups';
import { validateSession } from '@/lib/session';
import { isValidAccessKey } from '@/lib/access-keys';
import { logRequest, log, logError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/groups';
  logRequest(TAG, request, { msg: 'Request received' });

  const sessionData = await validateSession(request);

  // Allow both admin users and users with valid access keys to view groups
  if (!sessionData.isAuthenticated) {
    log(TAG, 'Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // For non-admin users, validate their access key
  if (!sessionData.isAdmin && sessionData.accessKey) {
    const keyIsValid = await isValidAccessKey(sessionData.accessKey);
    if (!keyIsValid) {
      log(TAG, 'Access key no longer valid');
      return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');

  if (!year) {
    log(TAG, 'Year parameter missing');
    return NextResponse.json({ error: 'Year parameter required' }, { status: 400 });
  }

  try {
    const groups = await getGroupsByYear(year);
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
  if (!sessionData.isAdmin) {
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

    const group = await createGroup(year, groupName, displayName, description || '');
    log(TAG, 'Group created', { year, groupName, displayName });
    return NextResponse.json({ group });
  } catch (error) {
    logError(TAG, 'Error creating group', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}