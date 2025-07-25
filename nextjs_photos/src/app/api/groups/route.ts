import { NextRequest, NextResponse } from 'next/server';
import { getGroupsByYear, createGroup } from '@/lib/groups';
import { validateSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const sessionData = await validateSession(request);
  if (!sessionData.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');

  if (!year) {
    return NextResponse.json({ error: 'Year parameter required' }, { status: 400 });
  }

  try {
    const groups = await getGroupsByYear(year);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
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
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}