import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { reorderAlbum, reorderGroup } from '@/lib/commands';
import { queryUnifiedYearItems, resolveAdminTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/items/reorder';
  try {
    logRequest(TAG, request, { msg: 'Reorder item request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, itemId, itemType, direction } = await request.json();

    if (!year || !itemId || !itemType || !direction || !['up', 'down'].includes(direction)) {
      log(TAG, 'Invalid parameters', { year, itemId, itemType, direction });
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const items = queryUnifiedYearItems(tenantId, year);

    log(TAG, 'Reordering item', { year, itemId, itemType, direction });

    const currentIndex = items.findIndex(item => item.id === itemId && item.type === itemType);

    if (currentIndex === -1) {
      log(TAG, 'Item not found', { itemId, itemType });
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= items.length) {
      log(TAG, 'Cannot move in that direction', { currentIndex, newIndex, direction });
      return NextResponse.json({ error: 'Cannot move item in that direction' }, { status: 400 });
    }

    // Swap
    const reordered = [...items];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[newIndex];
    reordered[newIndex] = temp;

    // Update display orders
    for (let i = 0; i < reordered.length; i++) {
      const item = reordered[i];

      if (item.type === 'group' && item.group) {
        reorderGroup(tenantId, item.group.id, i);
      } else if (item.type === 'album' && item.album) {
        reorderAlbum(tenantId, item.album.albumId, i);
      }
    }

    log(TAG, 'Item reordered successfully', { itemId, itemType, direction });

    return NextResponse.json({
      success: true,
      message: `${itemType === 'group' ? 'Group' : 'Album'} moved ${direction} successfully`
    });
  } catch (error) {
    logError(TAG, 'Error reordering items', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
