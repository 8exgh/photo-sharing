import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getGroupsByYear, getGroupMetadata, saveGroupMetadata } from '@/lib/groups';
import { join } from 'path';

export const runtime = 'nodejs';

const ALBUMS_DIR = join(process.cwd(), process.env.ALBUMS_DIR || 'public/albums');

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, groupId, direction } = await request.json();

    if (!year || !groupId || !direction || !['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get all groups for the year
    const groups = await getGroupsByYear(year);

    // Find current group index
    const currentIndex = groups.findIndex(g => g.id === groupId);

    if (currentIndex === -1) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if move is valid
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= groups.length) {
      return NextResponse.json({ error: 'Cannot move group in that direction' }, { status: 400 });
    }

    // Create a copy and swap the groups
    const reorderedGroups = [...groups];
    const temp = reorderedGroups[currentIndex];
    reorderedGroups[currentIndex] = reorderedGroups[newIndex];
    reorderedGroups[newIndex] = temp;

    // Update displayOrder for all groups
    for (let i = 0; i < reorderedGroups.length; i++) {
      const group = reorderedGroups[i];
      const groupPath = join(ALBUMS_DIR, year, group.id);
      const metadata = await getGroupMetadata(groupPath);

      if (metadata) {
        metadata.displayOrder = i;
        await saveGroupMetadata(groupPath, metadata);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Group moved ${direction} successfully`
    });
  } catch (_error) {
    console.error('Error reordering groups:', _error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}