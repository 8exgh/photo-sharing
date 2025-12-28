import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getSchemaStatus } from '@/lib/schema';
import { SystemInfo } from '@/types';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

// Get instance type from environment
const INSTANCE_TYPE = (process.env.INSTANCE_TYPE || 'development') as 'production' | 'staging' | 'development';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/system/status';
  try {
    logRequest(TAG, request, { msg: 'System status request' });

    const response = NextResponse.next();
    const session = await getSessionFromRequest(request, response);

    // Only admins can view system status
    if (!session.isAdmin) {
      log(TAG, 'Not admin, denying access');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get schema status
    const schemaStatus = await getSchemaStatus();

    const systemInfo: SystemInfo = {
      instanceType: INSTANCE_TYPE,
      version: process.env.npm_package_version || '0.1.0',
      gitHash: process.env.NEXT_PUBLIC_GIT_HASH || 'unknown',
      gitBranch: process.env.NEXT_PUBLIC_GIT_BRANCH || 'unknown',
      buildNumber: process.env.NEXT_PUBLIC_BUILD_NUMBER || 'local',
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
      schemaVersion: schemaStatus.currentVersion,
      appSchemaVersion: schemaStatus.appVersion,
      needsMigration: schemaStatus.needsMigration,
    };

    // If we have an orchestrator, also fetch its status
    let orchestratorStatus = null;
    if (INSTANCE_TYPE !== 'development') {
      try {
        const orchResponse = await fetch(`${ORCHESTRATOR_URL}/api/status`, {
          headers: { 'Accept': 'application/json' },
        });
        if (orchResponse.ok) {
          orchestratorStatus = await orchResponse.json();
        }
      } catch (err) {
        log(TAG, 'Could not reach orchestrator', { error: String(err) });
      }
    }

    log(TAG, 'Returning system status', { instanceType: INSTANCE_TYPE });

    return NextResponse.json({
      system: systemInfo,
      orchestrator: orchestratorStatus,
    });
  } catch (error) {
    logError(TAG, 'Error getting system status', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
