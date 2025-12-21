import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/admin/migrate-photo-metadata';
  try {
    logRequest(TAG, request, { msg: 'Migrate photo metadata request' });

    const session = await getSession();

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { year, album } = await request.json();

    if (!year || !album) {
      log(TAG, 'Missing parameters', { year, album });
      return NextResponse.json({ error: 'Year and album are required' }, { status: 400 });
    }

    log(TAG, 'Migrating album', { year, album });

    // Find the album using the group-aware function to get the correct path
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);

    if (!targetAlbum) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const albumPath = targetAlbum.path;
    
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
          logError(TAG, `Failed to get metadata for ${photo.filename}`, error);
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

    log(TAG, 'Migration complete for album', { year, album, updatedCount });

    return NextResponse.json({
      success: true,
      message: `Updated metadata for ${updatedCount} photos`,
      updatedCount
    });
  } catch (error) {
    logError(TAG, 'Migration error', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}

// GET endpoint to migrate all albums
export async function GET(request: NextRequest) {
  const TAG = 'GET /api/admin/migrate-photo-metadata';
  try {
    logRequest(TAG, request, { msg: 'Migrate all albums request' });

    const session = await getSession();

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized');
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
              logError(TAG, `Failed to get metadata for ${photo.filename}`, error);
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

    log(TAG, 'Full migration complete', { totalUpdated, albumsUpdated: results.length });

    return NextResponse.json({
      success: true,
      message: `Migration complete. Updated ${totalUpdated} photos across ${results.length} albums`,
      totalUpdated,
      albums: results
    });
  } catch (error) {
    logError(TAG, 'Migration error', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}