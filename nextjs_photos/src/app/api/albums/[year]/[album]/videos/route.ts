import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';
import { VideoMetadata } from '@/types';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, title } = await request.json();
    
    if (!url || !title) {
      return NextResponse.json({ error: 'URL and title are required' }, { status: 400 });
    }

    const { year, album } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    const metadata = await getAlbumMetadata(albumPath);
    
    if (!metadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const videoMetadata: VideoMetadata = {
      url,
      title,
      addedDate: new Date().toISOString(),
    };

    const updatedMetadata = {
      ...metadata,
      videos: [...metadata.videos, videoMetadata],
    };

    await saveAlbumMetadata(albumPath, updatedMetadata);

    return NextResponse.json({ 
      success: true, 
      message: 'Video link added successfully',
      video: videoMetadata,
    });
  } catch (error) {
    console.error('Video add error:', error);
    return NextResponse.json({ error: 'Failed to add video' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoIndex = searchParams.get('index');
    
    if (videoIndex === null) {
      return NextResponse.json({ error: 'Video index is required' }, { status: 400 });
    }

    const { year, album } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    const metadata = await getAlbumMetadata(albumPath);
    
    if (!metadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const index = parseInt(videoIndex);
    if (index < 0 || index >= metadata.videos.length) {
      return NextResponse.json({ error: 'Invalid video index' }, { status: 400 });
    }

    const updatedMetadata = {
      ...metadata,
      videos: metadata.videos.filter((_, i) => i !== index),
    };

    await saveAlbumMetadata(albumPath, updatedMetadata);

    return NextResponse.json({ 
      success: true, 
      message: 'Video link removed successfully',
    });
  } catch (error) {
    console.error('Video delete error:', error);
    return NextResponse.json({ error: 'Failed to remove video' }, { status: 500 });
  }
}