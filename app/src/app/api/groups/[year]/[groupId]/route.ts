import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/session';
import { updateGroup, deleteGroup } from '@/lib/commands';
import { queryGroupByYearAndId, resolveAdminTenant, resolveSessionTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string; groupId: string }> }
) {
  const TAG = 'GET /api/groups/[year]/[groupId]';
  try {
    const { year, groupId } = await params;
    logRequest(TAG, request, { msg: 'Request received', year, groupId });

    const sessionData = await validateSession(request);

    if (!sessionData.isAuthenticated) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the session's tenant (validates the access key for visitors)
    const tenantId = resolveSessionTenant(sessionData);
    if (!tenantId) {
      log(TAG, 'No valid tenant for session');
      return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
    }

    const group = queryGroupByYearAndId(tenantId, year, groupId);

    if (!group) {
      log(TAG, 'Group not found', { year, groupId });
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    log(TAG, 'Group fetched', { year, groupId });
    return NextResponse.json({ group });
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
    const tenantId = resolveAdminTenant(sessionData);
    if (!tenantId) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { displayName, description } = await request.json();

    const updated = updateGroup(tenantId, groupId, { displayName, description });

    if (!updated) {
      log(TAG, 'Group not found', { year, groupId });
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const group = queryGroupByYearAndId(tenantId, year, groupId);
    log(TAG, 'Group updated', { year, groupId });
    return NextResponse.json({ group });
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
    const tenantId = resolveAdminTenant(sessionData);
    if (!tenantId) {
      log(TAG, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log(TAG, 'Deleting group', { year, groupId });
    const deleted = deleteGroup(tenantId, groupId);

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
