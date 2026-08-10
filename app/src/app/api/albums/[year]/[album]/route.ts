import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { updateAlbumMetadata, renameAlbumUrl, changeAlbumYear } from '@/lib/commands';
import { queryAlbumByYearAndUrlName, resolveAdminTenant, resolveSessionTenant } from '@/lib/queries';
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

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAuthenticated) {
      log(TAG, 'Unauthorized', { year, album });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the session's tenant (validates the access key for visitors)
    const tenantId = resolveSessionTenant(session);
    if (!tenantId) {
      log(TAG, 'No valid tenant for session, clearing session');
      session.isAuthenticated = false;
      session.accessKey = undefined;
      await session.save();
      return new NextResponse(JSON.stringify({ error: 'Access key is no longer valid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...Object.fromEntries(response.headers) }
      });
    }

    const albumData = queryAlbumByYearAndUrlName(tenantId, year, album);

    if (!albumData) {
      log(TAG, 'Album not found', { year, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    log(TAG, 'Album fetched', { year, album, photoCount: albumData.photoCount });

    return NextResponse.json(
      {
        albumId: albumData.albumId,
        metadata: {
          name: albumData.name,
          location: albumData.location,
          description: albumData.description,
          text: albumData.text,
          created: albumData.created,
          displayOrder: albumData.displayOrder,
          photos: albumData.photos,
          videos: albumData.videos,
        },
        groupId: albumData.groupId,
        firstPhotoId: albumData.firstPhotoId,
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

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized', { currentYear, album });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, location, description, text, year: newYear, urlName } = await request.json();

    const albumData = queryAlbumByYearAndUrlName(tenantId, currentYear, album);
    if (!albumData) {
      log(TAG, 'Album not found', { currentYear, album });
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const albumId = albumData.albumId;
    let yearChanged = false;
    let urlNameChanged = false;

    // Update metadata
    updateAlbumMetadata(tenantId, albumId, {
      name: name || undefined,
      location: location !== undefined ? location : undefined,
      description: description !== undefined ? description : undefined,
    });

    // Update text if provided
    if (text !== undefined) {
      const { updateAlbumText } = await import('@/lib/commands');
      updateAlbumText(tenantId, albumId, text);
    }

    // Rename URL if changed
    if (urlName && urlName !== album) {
      try {
        renameAlbumUrl(tenantId, albumId, urlName);
        urlNameChanged = true;
      } catch (err) {
        return NextResponse.json({
          error: err instanceof Error ? err.message : 'Failed to rename album'
        }, { status: 400 });
      }
    }

    // Change year if changed
    if (newYear && newYear !== currentYear) {
      try {
        changeAlbumYear(tenantId, albumId, newYear);
        yearChanged = true;
      } catch (err) {
        return NextResponse.json({
          error: err instanceof Error ? err.message : 'Failed to change year'
        }, { status: 400 });
      }
    }

    log(TAG, 'Album updated successfully', { album, yearChanged, urlNameChanged });

    return NextResponse.json({
      success: true,
      message: yearChanged && urlNameChanged
        ? `Album updated, renamed, and moved to ${newYear} successfully!`
        : yearChanged
        ? `Album updated and moved to ${newYear} successfully!`
        : urlNameChanged
        ? `Album updated and renamed successfully!`
        : 'Album updated successfully',
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
