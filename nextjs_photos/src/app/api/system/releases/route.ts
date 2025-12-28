import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4000';
const INSTANCE_TYPE = process.env.INSTANCE_TYPE || 'development';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/system/releases';
  try {
    logRequest(TAG, request, { msg: 'Get releases request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    // Only admins can view releases
    if (!session.isAdmin) {
      log(TAG, 'Not admin, denying access');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (INSTANCE_TYPE === 'development') {
      log(TAG, 'Development mode - returning mock data');
      return NextResponse.json({
        releases: [],
        updateAvailable: false,
        currentVersion: process.env.npm_package_version || '0.1.0',
      });
    }

    // Proxy to orchestrator
    const { searchParams } = new URL(request.url);
    const currentVersion = searchParams.get('currentVersion');

    // Get releases from orchestrator
    const releasesResponse = await fetch(`${ORCHESTRATOR_URL}/api/releases`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!releasesResponse.ok) {
      throw new Error(`Orchestrator error: ${releasesResponse.status}`);
    }

    const releasesData = await releasesResponse.json();

    // If currentVersion provided, check for updates
    let updateInfo = null;
    if (currentVersion) {
      const updateResponse = await fetch(
        `${ORCHESTRATOR_URL}/api/updates?version=${encodeURIComponent(currentVersion)}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (updateResponse.ok) {
        updateInfo = await updateResponse.json();
      }
    }

    log(TAG, 'Returning releases', { count: releasesData.releases?.length || 0 });

    return NextResponse.json({
      ...releasesData,
      ...updateInfo,
    });
  } catch (error) {
    logError(TAG, 'Error getting releases', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
