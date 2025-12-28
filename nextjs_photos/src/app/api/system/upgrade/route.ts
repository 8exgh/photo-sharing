import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4000';
const INSTANCE_TYPE = process.env.INSTANCE_TYPE || 'development';

/**
 * GET - Get upgrade state
 */
export async function GET(request: NextRequest) {
  const TAG = 'GET /api/system/upgrade';
  try {
    logRequest(TAG, request, { msg: 'Get upgrade state request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Not admin, denying access');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (INSTANCE_TYPE === 'development') {
      return NextResponse.json({
        status: 'idle',
        target: null,
        targetVersion: null,
        currentStep: null,
        progress: 0,
        error: null,
      });
    }

    // Proxy to orchestrator
    const orchResponse = await fetch(`${ORCHESTRATOR_URL}/api/upgrade/state`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!orchResponse.ok) {
      throw new Error(`Orchestrator error: ${orchResponse.status}`);
    }

    const state = await orchResponse.json();
    return NextResponse.json(state);
  } catch (error) {
    logError(TAG, 'Error getting upgrade state', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST - Initiate upgrade
 */
export async function POST(request: NextRequest) {
  const TAG = 'POST /api/system/upgrade';
  try {
    logRequest(TAG, request, { msg: 'Upgrade request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    if (!session.isAdmin) {
      log(TAG, 'Not admin, denying access');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (INSTANCE_TYPE === 'development') {
      return NextResponse.json({ error: 'Cannot upgrade in development mode' }, { status: 400 });
    }

    const { action, version } = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let endpoint: string;
    let body: Record<string, unknown> = {};

    switch (action) {
      case 'prepare-staging':
        if (!version) {
          return NextResponse.json({ error: 'version is required for prepare-staging' }, { status: 400 });
        }
        endpoint = '/api/staging/prepare';
        body = { version };
        break;

      case 'upgrade-production':
        endpoint = '/api/production/upgrade';
        break;

      case 'reset':
        endpoint = '/api/upgrade/reset';
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    log(TAG, 'Proxying upgrade action to orchestrator', { action, version, endpoint });

    const orchResponse = await fetch(`${ORCHESTRATOR_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await orchResponse.json();

    if (!orchResponse.ok) {
      log(TAG, 'Orchestrator returned error', { status: orchResponse.status, result });
      return NextResponse.json(result, { status: orchResponse.status });
    }

    log(TAG, 'Upgrade action completed', { action, result });
    return NextResponse.json(result);
  } catch (error) {
    logError(TAG, 'Error processing upgrade request', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
