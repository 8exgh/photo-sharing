import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { reorderGroup } from '@/lib/commands';
import { queryGroupsByYear } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/groups/reorder';
  try {
    logRequest(TAG, request, { msg: 'Reorder group request' });

    const response = new NextResponse();
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

    const groups = queryGroupsByYear(year);
    const currentIndex = groups.findIndex(g => g.id === groupId);

    if (currentIndex === -1) {
      log(TAG, 'Group not found', { groupId });
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= groups.length) {
      log(TAG, 'Cannot move in that direction', { currentIndex, newIndex, direction });
      return NextResponse.json({ error: 'Cannot move group in that direction' }, { status: 400 });
    }

    // Swap and reassign orders
    const reordered = [...groups];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[newIndex];
    reordered[newIndex] = temp;

    for (let i = 0; i < reordered.length; i++) {
      reorderGroup(reordered[i].id, i);
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
