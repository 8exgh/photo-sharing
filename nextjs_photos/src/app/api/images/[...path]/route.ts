import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { promises as fs } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path } = await params;
    
    if (!path || path.length < 3) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Extract year, album, and filename from path
    const [year, album, ...filenameParts] = path;
    const filename = filenameParts.join('/');
    
    // Construct the full path to the image
    const imagePath = join(
      process.cwd(),
      'public',
      'albums',
      year,
      album,
      filename
    );

    try {
      // Check if file exists and read it
      const imageBuffer = await fs.readFile(imagePath);
      
      // Determine content type based on file extension
      const extension = filename.toLowerCase().split('.').pop();
      let contentType = 'image/jpeg'; // Default fallback
      
      switch (extension) {
        case 'png':
          contentType = 'image/png';
          break;
        case 'webp':
          contentType = 'image/webp';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'jpg':
        case 'jpeg':
        default:
          contentType = 'image/jpeg';
          break;
      }

      // Return the image with appropriate headers
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': imageBuffer.length.toString(),
        },
      });
    } catch (fileError) {
      // File not found or read error
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Image serving error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}