import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string; index: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { text, title } = await request.json();
    const { year, album, index } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    
    const existingMetadata = await getAlbumMetadata(albumPath);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const videoIndex = parseInt(index);
    if (isNaN(videoIndex) || videoIndex < 0 || videoIndex >= existingMetadata.videos.length) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    
    // Update the video fields
    const updatedVideos = [...existingMetadata.videos];
    updatedVideos[videoIndex] = {
      ...updatedVideos[videoIndex],
      text: text !== undefined ? text : updatedVideos[videoIndex].text,
      title: title !== undefined ? title : updatedVideos[videoIndex].title,
    };
    
    const updatedMetadata = {
      ...existingMetadata,
      videos: updatedVideos,
    };
    
    await saveAlbumMetadata(albumPath, updatedMetadata);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Video text updated successfully',
      text: updatedVideos[videoIndex].text,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}