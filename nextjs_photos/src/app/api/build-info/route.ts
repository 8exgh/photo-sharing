import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
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