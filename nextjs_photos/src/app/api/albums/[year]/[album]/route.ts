import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAlbumMetadata, saveAlbumMetadata, getAlbumPhotos, moveAlbumToYear, renameAlbumFolder } from '@/lib/albums';
import { getAlbumsWithGroups } from '@/lib/groups';
import { AlbumMetadata } from '@/types';
import { isValidAccessKey } from '@/lib/access-keys';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'GET /api/albums/[year]/[album]';
  try {
    const { year, album } = await params;
    logRequest(TAG, request, { msg: 'Request received', year, album });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAuthenticated) {
      log(TAG, 'Unauthorized', { year, album });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      const keyIsValid = await isValidAccessKey(session.accessKey);
      if (!keyIsValid) {
        log(TAG, 'Access key invalid, clearing session');
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        return new NextResponse(JSON.stringify({ error: 'Access key is no longer valid' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
        });
      }
    }

    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(year);
    const targetAlbum = albums.find(a => a.name === album);

    if (!targetAlbum) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const metadata = await getAlbumMetadata(targetAlbum.path);
    const photos = await getAlbumPhotos(targetAlbum.path);

    if (!metadata) {
      log(TAG, 'Album metadata not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    log(TAG, 'Album fetched', { year, album, photoCount: photos.length });

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
  } catch (error) {
    logError(TAG, 'Error fetching album', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; album: string }> }
) {
  const TAG = 'PUT /api/albums/[year]/[album]';
  try {
    const { year: currentYear, album } = await params;
    logRequest(TAG, request, { msg: 'Update album request', currentYear, album });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized', { currentYear, album });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, location, description, text, year: newYear, urlName } = await request.json();

    // Find the album using the group-aware function
    const albums = await getAlbumsWithGroups(currentYear);
    const targetAlbum = albums.find(a => a.name === album);

    if (!targetAlbum) {
      log(TAG, 'Album not found', { currentYear, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const existingMetadata = await getAlbumMetadata(targetAlbum.path);
    if (!existingMetadata) {
      log(TAG, 'Album metadata not found', { currentYear, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    let finalPath = targetAlbum.path;
    let yearChanged = false;
    let urlNameChanged = false;

    // Check if URL name needs to be changed (do this BEFORE year change)
    if (urlName && urlName !== album) {
      try {
        log(TAG, 'Renaming album folder', { from: album, to: urlName });
        finalPath = await renameAlbumFolder(finalPath, album, urlName);
        urlNameChanged = true;
      } catch (_error) {
        log(TAG, 'Failed to rename album folder', { error: _error instanceof Error ? _error.message : String(_error) });
        return NextResponse.json({
          error: _error instanceof Error ? _error.message : 'Failed to rename album folder'
        }, { status: 400 });
      }
    }

    // Check if year needs to be changed (do this AFTER renaming)
    if (newYear && newYear !== currentYear) {
      try {
        log(TAG, 'Moving album to new year', { from: currentYear, to: newYear });
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
        log(TAG, 'Failed to move album to new year', { error: _error instanceof Error ? _error.message : String(_error) });
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

    log(TAG, 'Album updated successfully', { album, yearChanged, urlNameChanged, newYear, newUrlName: urlName });

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
  } catch (error) {
    logError(TAG, 'Error updating album', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}