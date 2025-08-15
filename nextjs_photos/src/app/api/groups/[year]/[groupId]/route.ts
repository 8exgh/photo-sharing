import { NextRequest, NextResponse } from 'next/server';
import { getGroupMetadata, saveGroupMetadata, deleteGroup } from '@/lib/groups';
import { join } from 'path';
import { validateSession } from '@/lib/session';

const ALBUMS_DIR = join(process.cwd(), 'public', 'albums');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; groupId: string }> }
) {
  const sessionData = await validateSession(request);
  if (!sessionData.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { year, groupId } = await params;
    const groupPath = join(ALBUMS_DIR, year, groupId);
    const metadata = await getGroupMetadata(groupPath);

    if (!metadata) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ group: metadata });
  } catch (_error) {
    console.error('Error fetching group:', _error);
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; groupId: string }> }
) {
  const sessionData = await validateSession(request);
  if (!sessionData.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { year, groupId } = await params;
    const { displayName, description, nestedAlbums } = await request.json();
    
    const groupPath = join(ALBUMS_DIR, year, groupId);
    const existingMetadata = await getGroupMetadata(groupPath);

    if (!existingMetadata) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const updatedMetadata = {
      ...existingMetadata,
      displayName: displayName || existingMetadata.displayName,
      description: description !== undefined ? description : existingMetadata.description,
      nestedAlbums: nestedAlbums !== undefined ? nestedAlbums : existingMetadata.nestedAlbums,
    };

    await saveGroupMetadata(groupPath, updatedMetadata);
    return NextResponse.json({ group: updatedMetadata });
  } catch (_error) {
    console.error('Error updating group:', _error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; groupId: string }> }
) {
  const sessionData = await validateSession(request);
  if (!sessionData.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { year, groupId } = await params;
    const deleted = await deleteGroup(year, groupId);

    if (!deleted) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    console.error('Error deleting group:', _error);
    if (_error instanceof Error && _error.message.includes('Cannot delete group containing albums')) {
      return NextResponse.json({ error: _error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}