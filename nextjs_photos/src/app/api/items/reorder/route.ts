import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUnifiedYearItems, getGroupMetadata, saveGroupMetadata } from '@/lib/groups';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';

export const runtime = 'nodejs';

const ALBUMS_DIR = join(process.cwd(), process.env.ALBUMS_DIR || 'public/albums');

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, itemId, itemType, direction } = await request.json();

    if (!year || !itemId || !itemType || !direction || !['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get all unified items for the year
    const items = await getUnifiedYearItems(year);

    // Find current item index
    const currentIndex = items.findIndex(item => item.id === itemId && item.type === itemType);

    if (currentIndex === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Check if move is valid
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= items.length) {
      return NextResponse.json({ error: 'Cannot move item in that direction' }, { status: 400 });
    }

    // Create a copy and swap the items
    const reorderedItems = [...items];
    const temp = reorderedItems[currentIndex];
    reorderedItems[currentIndex] = reorderedItems[newIndex];
    reorderedItems[newIndex] = temp;

    // Update displayOrder for all items
    for (let i = 0; i < reorderedItems.length; i++) {
      const item = reorderedItems[i];

      if (item.type === 'group' && item.group) {
        // Update group metadata
        const groupPath = join(ALBUMS_DIR, year, item.group.id);
        const metadata = await getGroupMetadata(groupPath);
        if (metadata) {
          metadata.displayOrder = i;
          await saveGroupMetadata(groupPath, metadata);
        }
      } else if (item.type === 'album' && item.album) {
        // Update album metadata
        const metadata = await getAlbumMetadata(item.album.path);
        if (metadata) {
          metadata.displayOrder = i;
          await saveAlbumMetadata(item.album.path, metadata);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${itemType === 'group' ? 'Group' : 'Album'} moved ${direction} successfully`
    });
  } catch (_error) {
    console.error('Error reordering items:', _error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}