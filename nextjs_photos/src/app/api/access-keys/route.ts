import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { createAccessKey, getAccessKeys, deleteAccessKey } from '@/lib/access-keys';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/access-keys';
  try {
    logRequest(TAG, request, { msg: 'Request received' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);
    log(TAG, 'Session retrieved', { isAuth: session.isAuthenticated, isAdmin: session.isAdmin, hasKey: !!session.accessKey });

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await getAccessKeys();
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

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { expires } = body;
    log(TAG, 'Creating access key', { expires });

    const key = await createAccessKey(expires);
    log(TAG, 'Access key created', { keyPrefix: key.substring(0, 8) + '...' });

    return NextResponse.json({ key });
  } catch (error) {
    logError(TAG, 'Error creating access key', error);
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

    if (!session.isAdmin) {
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
    const deleted = await deleteAccessKey(key);

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