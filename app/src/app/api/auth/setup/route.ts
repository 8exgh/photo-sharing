import { NextResponse } from 'next/server';
import { queryAdminPasswordHash } from '@/lib/queries';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET() {
  const TAG = 'GET /api/auth/setup';
  try {
    return NextResponse.json(
      { needsSetup: !queryAdminPasswordHash() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    logError(TAG, 'Error checking setup status', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
