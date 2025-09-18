import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUnifiedYearItems } from '@/lib/groups';
import { isValidAccessKey } from '@/lib/access-keys';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate access key for non-admin sessions
    if (!session.isAdmin && session.accessKey) {
      const keyIsValid = await isValidAccessKey(session.accessKey);
      if (!keyIsValid) {
        // Clear invalid session
        session.isAuthenticated = false;
        session.accessKey = undefined;
        await session.save();
        return NextResponse.json({ error: 'Access key is no longer valid' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (!year) {
      return NextResponse.json({ error: 'Year parameter is required' }, { status: 400 });
    }

    const items = await getUnifiedYearItems(year);

    return NextResponse.json(
      { items },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  } catch (_error) {
    console.error('Error fetching unified items:', _error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}