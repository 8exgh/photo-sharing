import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, album } = await request.json();
    
    if (!year || !album) {
      return NextResponse.json({ error: 'Year and album are required' }, { status: 400 });
    }

    // Get the album path
    const publicDir = join(process.cwd(), 'public', 'albums');
    const albumPath = join(publicDir, year, album);
    
    // Get album metadata
    const metadata = await getAlbumMetadata(albumPath);
    if (!metadata) {
      return NextResponse.json({ error: 'Album metadata not found' }, { status: 404 });
    }

    let updatedCount = 0;
    const updatedPhotos = await Promise.all(
      metadata.photos.map(async (photo) => {
        // Skip if metadata already exists
        if (photo.width && photo.height && photo.fileSize) {
          return photo;
        }

        try {
          const photoPath = join(albumPath, photo.filename);
          
          // Get file stats for size
          const stats = await fs.stat(photoPath);
          const fileSize = stats.size;
          
          // Get image dimensions using sharp
          const imageMetadata = await sharp(photoPath).metadata();
          
          updatedCount++;
          
          return {
            ...photo,
            width: imageMetadata.width,
            height: imageMetadata.height,
            fileSize: fileSize,
          };
        } catch (error) {
          console.error(`Failed to get metadata for ${photo.filename}:`, error);
          // Return original photo data if we can't get metadata
          return photo;
        }
      })
    );

    // Save updated metadata
    const updatedMetadata = {
      ...metadata,
      photos: updatedPhotos,
    };

    await saveAlbumMetadata(albumPath, updatedMetadata);

    return NextResponse.json({ 
      success: true, 
      message: `Updated metadata for ${updatedCount} photos`,
      updatedCount 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}

// GET endpoint to migrate all albums
export async function GET(request: NextRequest) {

  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicDir = join(process.cwd(), 'public', 'albums');
    let totalUpdated = 0;
    const results = [];

    // Get all years
    const years = await fs.readdir(publicDir);
    
    for (const year of years) {
      const yearPath = join(publicDir, year);
      const stat = await fs.stat(yearPath);
      
      if (!stat.isDirectory()) continue;
      
      // Get all albums in year
      const albums = await fs.readdir(yearPath);
      
      for (const album of albums) {
        const albumPath = join(yearPath, album);
        const albumStat = await fs.stat(albumPath);
        
        if (!albumStat.isDirectory()) continue;
        
        // Get album metadata
        const metadata = await getAlbumMetadata(albumPath);
        if (!metadata) continue;
        
        let albumUpdatedCount = 0;
        const updatedPhotos = await Promise.all(
          metadata.photos.map(async (photo) => {
            // Skip if metadata already exists
            if (photo.width && photo.height && photo.fileSize) {
              return photo;
            }

            try {
              const photoPath = join(albumPath, photo.filename);
              
              // Get file stats for size
              const stats = await fs.stat(photoPath);
              const fileSize = stats.size;
              
              // Get image dimensions using sharp
              const imageMetadata = await sharp(photoPath).metadata();
              
              albumUpdatedCount++;
              totalUpdated++;
              
              return {
                ...photo,
                width: imageMetadata.width,
                height: imageMetadata.height,
                fileSize: fileSize,
              };
            } catch (error) {
              console.error(`Failed to get metadata for ${photo.filename}:`, error);
              return photo;
            }
          })
        );

        if (albumUpdatedCount > 0) {
          // Save updated metadata
          const updatedMetadata = {
            ...metadata,
            photos: updatedPhotos,
          };
          await saveAlbumMetadata(albumPath, updatedMetadata);
          
          results.push({
            year,
            album,
            updatedCount: albumUpdatedCount
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Migration complete. Updated ${totalUpdated} photos across ${results.length} albums`,
      totalUpdated,
      albums: results
    });
  } catch (error) {
    console.error('Migration error:', error, request);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}