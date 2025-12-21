import { NextRequest, NextResponse } from 'next/server';
import { getGroupMetadata, saveGroupMetadata, deleteGroup } from '@/lib/groups';
import { join } from 'path';
import { validateSession } from '@/lib/session';
import { isValidAccessKey } from '@/lib/access-keys';
import { logRequest, log, logError } from '@/lib/logger';

const ALBUMS_DIR = join(process.cwd(), 'public', 'albums');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; groupId: string }> }
) {
  const TAG = 'GET /api/groups/[year]/[groupId]';
  try {
    const { year, groupId } = await params;
    logRequest(TAG, request, { msg: 'Request received', year, groupId });

    const sessionData = await validateSession(request);

    // Allow both admin users and users with valid access keys to view groups
    if (!sessionData.isAuthenticated) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For non-admin users, validate their access key
    if (!sessionData.isAdmin && sessionData.accessKey) {
      const keyIsValid = await isValidAccessKey(sessionData.accessKey);
      if (!keyIsValid) {
        log(TAG, 'Access key no longer valid');
        return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
      }
    }

    const groupPath = join(ALBUMS_DIR, year, groupId);
    const metadata = await getGroupMetadata(groupPath);

    if (!metadata) {
      log(TAG, 'Group not found', { year, groupId });
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    log(TAG, 'Group fetched', { year, groupId });
    return NextResponse.json({ group: metadata });
  } catch (error) {
    logError(TAG, 'Error fetching group', error);
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; groupId: string }> }
) {
  const TAG = 'PUT /api/groups/[year]/[groupId]';
  try {
    const { year, groupId } = await params;
    logRequest(TAG, request, { msg: 'Update group request', year, groupId });

    const sessionData = await validateSession(request);
    if (!sessionData.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { displayName, description, nestedAlbums } = await request.json();

    const groupPath = join(ALBUMS_DIR, year, groupId);
    const existingMetadata = await getGroupMetadata(groupPath);

    if (!existingMetadata) {
      log(TAG, 'Group not found', { year, groupId });
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const updatedMetadata = {
      ...existingMetadata,
      displayName: displayName || existingMetadata.displayName,
      description: description !== undefined ? description : existingMetadata.description,
      nestedAlbums: nestedAlbums !== undefined ? nestedAlbums : existingMetadata.nestedAlbums,
    };

    await saveGroupMetadata(groupPath, updatedMetadata);
    log(TAG, 'Group updated', { year, groupId });
    return NextResponse.json({ group: updatedMetadata });
  } catch (error) {
    logError(TAG, 'Error updating group', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; groupId: string }> }
) {
  const TAG = 'DELETE /api/groups/[year]/[groupId]';
  try {
    const { year, groupId } = await params;
    logRequest(TAG, request, { msg: 'Delete group request', year, groupId });

    const sessionData = await validateSession(request);
    if (!sessionData.isAdmin) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log(TAG, 'Deleting group', { year, groupId });
    const deleted = await deleteGroup(year, groupId);

    if (!deleted) {
      log(TAG, 'Group not found', { year, groupId });
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    log(TAG, 'Group deleted', { year, groupId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Error deleting group', error);
    if (error instanceof Error && error.message.includes('Cannot delete group containing albums')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}