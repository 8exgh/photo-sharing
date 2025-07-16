import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { text } = await request.json();
    const { year, album } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    
    const existingMetadata = await getAlbumMetadata(albumPath);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const updatedMetadata = {
      ...existingMetadata,
      text: text || '',
    };
    
    await saveAlbumMetadata(albumPath, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Album text updated successfully',
      text: updatedMetadata.text,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}