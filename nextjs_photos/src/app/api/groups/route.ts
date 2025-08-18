import { NextRequest, NextResponse } from 'next/server';
import { getGroupsByYear, createGroup } from '@/lib/groups';
import { validateSession } from '@/lib/session';
import { isValidAccessKey } from '@/lib/access-keys';

export async function GET(request: NextRequest) {
  const sessionData = await validateSession(request);
  
  // Allow both admin users and users with valid access keys to view groups
  if (!sessionData.isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // For non-admin users, validate their access key
  if (!sessionData.isAdmin && sessionData.accessKey) {
    const keyIsValid = await isValidAccessKey(sessionData.accessKey);
    if (!keyIsValid) {
      return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
    }
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');

  if (!year) {
    return NextResponse.json({ error: 'Year parameter required' }, { status: 400 });
  }

  try {
    const groups = await getGroupsByYear(year);
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
  } catch (_error) {
    console.error('Error fetching groups:', _error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sessionData = await validateSession(request);
  if (!sessionData.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { year, groupName, displayName, description } = await request.json();

    if (!year || !groupName || !displayName) {
      return NextResponse.json(
        { error: 'Year, group name, and display name are required' },
        { status: 400 }
      );
    }

    const group = await createGroup(year, groupName, displayName, description || '');
    return NextResponse.json({ group });
  } catch (_error) {
    console.error('Error creating group:', _error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}