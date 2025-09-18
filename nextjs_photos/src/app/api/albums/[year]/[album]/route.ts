import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata, getAlbumPhotos, moveAlbumToYear, renameAlbumFolder } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { AlbumMetadata } from '@/types';
import { isValidAccessKey } from '@/lib/access-keys';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      const keyIsValid = await isValidAccessKey(session.accessKey);
      if (!keyIsValid) {
        // Clear invalid session
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
      }
    }
    
    const { year, album } = await params;
    
    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);
    
    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    const metadata = await getAlbumMetadata(targetAlbum.path);
    const photos = await getAlbumPhotos(targetAlbum.path);
    
    if (!metadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        metadata,
        photos,
        albumPath: targetAlbum.path.split('public/albums/')[1],
        groupId: targetAlbum.groupId,
        isNested: targetAlbum.isNested,
      },
      { 
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  try {
    const session = await getSession();
    
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { name, location, description, text, year: newYear, urlName } = await request.json();
    const { year: currentYear, album } = await params;

    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(currentYear);
    const targetAlbum = albums.find(a => a.name === album);

    if (!targetAlbum) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const existingMetadata = await getAlbumMetadata(targetAlbum.path);
    if (!existingMetadata) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    let finalPath = targetAlbum.path;
    let yearChanged = false;
    let urlNameChanged = false;

    // Check if URL name needs to be changed (do this BEFORE year change)
    if (urlName && urlName !== album) {
      try {
        finalPath = await renameAlbumFolder(finalPath, album, urlName);
        urlNameChanged = true;
      } catch (_error) {
        return NextResponse.json({
          error: _error instanceof Error ? _error.message : 'Failed to rename album folder'
        }, { status: 400 });
      }
    }

    // Check if year needs to be changed (do this AFTER renaming)
    if (newYear && newYear !== currentYear) {
      try {
        // Use the new name if it was changed, otherwise use the original
        const albumNameForMove = urlNameChanged ? urlName : album;
        finalPath = await moveAlbumToYear(
          finalPath,
          newYear,
          albumNameForMove,
          targetAlbum.groupId
        );
        yearChanged = true;
      } catch (_error) {
        return NextResponse.json({
          error: _error instanceof Error ? _error.message : 'Failed to move album to new year'
        }, { status: 400 });
      }
    }
    
    const updatedMetadata: AlbumMetadata = {
      ...existingMetadata,
      name: name || existingMetadata.name,
      location: location !== undefined ? location : existingMetadata.location,
      description: description !== undefined ? description : existingMetadata.description,
      text: text !== undefined ? text : existingMetadata.text,
    };
    
    await saveAlbumMetadata(finalPath, updatedMetadata);
    
    return NextResponse.json({
      success: true,
      message: yearChanged && urlNameChanged
        ? `Album updated, renamed, and moved to ${newYear} successfully!`
        : yearChanged
        ? `Album updated and moved to ${newYear} successfully!`
        : urlNameChanged
        ? `Album updated and renamed successfully!`
        : 'Album updated successfully',
      metadata: updatedMetadata,
      yearChanged,
      urlNameChanged,
      newYear: yearChanged ? newYear : currentYear,
      newUrlName: urlNameChanged ? urlName : album,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}