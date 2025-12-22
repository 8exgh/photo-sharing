import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getGroupsByYear, getGroupMetadata, saveGroupMetadata } from '@/lib/groups';
import { join } from 'path';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const ALBUMS_DIR = join(process.cwd(), process.env.ALBUMS_DIR || 'public/albums');

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/groups/reorder';
  try {
    logRequest(TAG, request, { msg: 'Reorder group request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, groupId, direction } = await request.json();

    if (!year || !groupId || !direction || !['up', 'down'].includes(direction)) {
      log(TAG, 'Invalid parameters', { year, groupId, direction });
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    log(TAG, 'Reordering group', { year, groupId, direction });

    // Get all groups for the year
    const groups = await getGroupsByYear(year);

    // Find current group index
    const currentIndex = groups.findIndex(g => g.id === groupId);

    if (currentIndex === -1) {
      log(TAG, 'Group not found', { groupId });
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if move is valid
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= groups.length) {
      log(TAG, 'Cannot move in that direction', { currentIndex, newIndex, direction });
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

    log(TAG, 'Group reordered successfully', { groupId, direction });

    return NextResponse.json({
      success: true,
      message: `Group moved ${direction} successfully`
    });
  } catch (error) {
    logError(TAG, 'Error reordering groups', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}