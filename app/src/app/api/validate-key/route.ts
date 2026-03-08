import { NextRequest, NextResponse } from 'next/server';
import { queryIsValidAccessKey } from '@/lib/queries';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/validate-key';
  try {
    logRequest(TAG, request, { msg: 'Key validation request' });

    const { key } = await request.json();

    if (!key) {
      log(TAG, 'No key provided');
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    const isValid = queryIsValidAccessKey(key);
    log(TAG, 'Key validation result', { valid: isValid, keyPrefix: key.substring(0, 8) + '...' });

    if (isValid) {
      return NextResponse.json(
        { valid: true },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
    } else {
      return NextResponse.json(
        { valid: false },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        }
      );
    }
  } catch (error) {
    logError(TAG, 'Key validation error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
