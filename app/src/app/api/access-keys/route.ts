import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { createAccessKey, labelAccessKey, revokeAccessKey } from '@/lib/commands';
import { queryAllAccessKeys, resolveAdminTenant } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/access-keys';
  try {
    logRequest(TAG, request, { msg: 'Request received' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session retrieved', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin, hasKey: !!session.accessKey });

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = queryAllAccessKeys(tenantId);
    log(TAG, 'Access keys fetched', { count: keys.length });

    return NextResponse.json({ keys });
  } catch (error) {
    logError(TAG, 'Error fetching access keys', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/access-keys';
  try {
    logRequest(TAG, request, { msg: 'Create access key request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session retrieved', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin });

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { expires, label } = body;

    if (label !== undefined && (typeof label !== 'string' || label.length > 200)) {
      log(TAG, 'Invalid label');
      return NextResponse.json({ error: 'Label must be a string of at most 200 characters' }, { status: 400 });
    }

    log(TAG, 'Creating access key', { expires, hasLabel: !!label });

    const key = createAccessKey(tenantId, expires, label);
    log(TAG, 'Access key created', { keyPrefix: key.substring(0, 8) + '...' });

    return NextResponse.json({ key });
  } catch (error) {
    logError(TAG, 'Error creating access key', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const TAG = 'PATCH /api/access-keys';
  try {
    logRequest(TAG, request, { msg: 'Label access key request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session retrieved', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin });

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { key, label } = body;

    if (!key) {
      log(TAG, 'No key provided');
      return NextResponse.json({ error: 'Access key is required' }, { status: 400 });
    }

    if (typeof label !== 'string' || label.length > 200) {
      log(TAG, 'Invalid label');
      return NextResponse.json({ error: 'Label must be a string of at most 200 characters' }, { status: 400 });
    }

    log(TAG, 'Labeling access key', { keyPrefix: key.substring(0, 8) + '...' });
    const labeled = labelAccessKey(tenantId, key, label);

    if (!labeled) {
      log(TAG, 'Key not found');
      return NextResponse.json({ error: 'Access key not found' }, { status: 404 });
    }

    log(TAG, 'Access key labeled successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Error labeling access key', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const TAG = 'DELETE /api/access-keys';
  try {
    logRequest(TAG, request, { msg: 'Delete access key request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session retrieved', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin });

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { key } = body;

    if (!key) {
      log(TAG, 'No key provided');
      return NextResponse.json({ error: 'Access key is required' }, { status: 400 });
    }

    log(TAG, 'Deleting access key', { keyPrefix: key.substring(0, 8) + '...' });
    const deleted = revokeAccessKey(tenantId, key);

    if (!deleted) {
      log(TAG, 'Key not found');
      return NextResponse.json({ error: 'Access key not found' }, { status: 404 });
    }

    log(TAG, 'Access key deleted successfully');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Error deleting access key', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
