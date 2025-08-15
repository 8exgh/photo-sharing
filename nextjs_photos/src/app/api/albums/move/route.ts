import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { moveAlbumToGroup } from '@/lib/groups';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { albumPath, year, groupId } = await request.json();
    
    if (!albumPath || !year) {
      return NextResponse.json({ error: 'Album path and year are required' }, { status: 400 });
    }
    
    const newPath = await moveAlbumToGroup(albumPath, year, groupId || undefined);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Album moved successfully',
      newPath: newPath.split('public/albums/')[1],
    });
  } catch (_error) {
    console.error('Error moving album:', _error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}