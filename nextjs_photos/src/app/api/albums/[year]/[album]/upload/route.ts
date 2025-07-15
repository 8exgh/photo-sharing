import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { join } from 'path';
import { promises as fs } from 'fs';
import formidable from 'formidable';
import sharp from 'sharp';
import { PhotoMetadata } from '@/types';

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

    const { year, album } = await params;
    const albumPath = join(process.cwd(), 'public', 'albums', year, album);
    const thumbnailsPath = join(albumPath, 'thumbnails');
    
    // Check if album exists
    const metadata = await getAlbumMetadata(albumPath);
    if (!metadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Parse form data
    const form = formidable({
      uploadDir: albumPath,
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      filter: (part) => {
        return part.mimetype?.includes('image/') || false;
      },
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const extension = originalName.split('.').pop();
    const filename = `${timestamp}-${originalName}`;
    
    // Save original file
    const buffer = await file.arrayBuffer();
    const filePath = join(albumPath, filename);
    await fs.writeFile(filePath, Buffer.from(buffer));

    // Generate thumbnail
    const thumbnailPath = join(thumbnailsPath, filename);
    await sharp(Buffer.from(buffer))
      .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    // Update album metadata
    const photoMetadata: PhotoMetadata = {
      filename,
      title: originalName.replace(/\.[^/.]+$/, ''), // Remove extension
      uploadDate: new Date().toISOString(),
      description: '',
    };

    const updatedMetadata = {
      ...metadata,
      photos: [...metadata.photos, photoMetadata],
    };

    await saveAlbumMetadata(albumPath, updatedMetadata);

    return NextResponse.json({ 
      success: true, 
      message: 'Photo uploaded successfully',
      filename,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}