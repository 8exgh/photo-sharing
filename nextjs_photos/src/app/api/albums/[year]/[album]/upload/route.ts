import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { join } from 'path';
import { promises as fs } from 'fs';
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
    
    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const albumPath = targetAlbum.path;
    const thumbnailsPath = join(albumPath, 'thumbnails');
    
    // Check if album exists
    const metadata = await getAlbumMetadata(albumPath);
    if (!metadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Parse form data
    // const form = formidable({
    //   uploadDir: albumPath,
    //   keepExtensions: true,
    //   maxFileSize: 100 * 1024 * 1024, // 100MB
    //   filter: (part) => {
    //     return part.mimetype?.includes('image/') || false;
    //   },
    // });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Generate unique filename with .jpg extension
    const timestamp = Date.now();
    const originalName = file.name;
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
    const filename = `${timestamp}-${nameWithoutExt}.jpg`;
    
    // Ensure thumbnails directory exists
    try {
      await fs.access(thumbnailsPath);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(thumbnailsPath, { recursive: true });
    }

    // Get original image buffer
    const buffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(buffer);

    // Optimize the image to JPEG with max 1920px dimension
    const optimizedBuffer = await sharp(originalBuffer)
      .resize(1920, 1920, {
        fit: 'inside',          // Maintains aspect ratio
        withoutEnlargement: true // Don't upscale smaller images
      })
      .jpeg({
        quality: 85,            // Sweet spot for quality/size
        progressive: true,      // Progressive loading (better UX)
        mozjpeg: true          // Better compression algorithm (20-30% smaller)
      })
      .toBuffer();

    // Get metadata from the optimized image
    const imageMetadata = await sharp(optimizedBuffer).metadata();
    const fileSize = optimizedBuffer.length;

    // Save optimized file
    const filePath = join(albumPath, filename);
    await fs.writeFile(filePath, optimizedBuffer);

    // Generate thumbnail with smart cropping
    const thumbnailPath = join(thumbnailsPath, filename);
    await sharp(originalBuffer)
      .resize(300, 300, {
        fit: 'cover',          // Crop to fill exact dimensions
        position: 'entropy'    // Smart cropping to interesting parts
      })
      .jpeg({
        quality: 75,           // Lower quality OK for thumbnails
        progressive: true,
        mozjpeg: true
      })
      .toFile(thumbnailPath);

    // Update album metadata
    const photoMetadata: PhotoMetadata = {
      filename,
      title: nameWithoutExt, // Use the name without extension
      uploadDate: new Date().toISOString(),
      description: '',
      text: '', // Initialize text field
      width: imageMetadata.width,
      height: imageMetadata.height,
      fileSize: fileSize,
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
  } catch (_error) {
    console.error('Upload error:', _error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}