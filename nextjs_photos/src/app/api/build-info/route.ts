import { NextRequest, NextResponse } from 'next/server';
import { logRequest } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/build-info';
  logRequest(TAG, request, { msg: 'Build info request' });

  // Return build information
  const buildInfo = {
    gitHash: process.env.NEXT_PUBLIC_GIT_HASH || 'unknown',
    gitHashShort: (process.env.NEXT_PUBLIC_GIT_HASH || 'unknown').substring(0, 7),
    gitBranch: process.env.NEXT_PUBLIC_GIT_BRANCH || 'unknown',
    buildNumber: process.env.NEXT_PUBLIC_BUILD_NUMBER || 'local',
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown',
    nodeEnv: process.env.NODE_ENV || 'development',
  };

  return NextResponse.json(buildInfo);
}