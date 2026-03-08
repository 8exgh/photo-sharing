import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getLogEntries } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const response = new NextResponse();
  const session = await getSessionFromRequest(request, response);

  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const afterId = parseInt(request.nextUrl.searchParams.get('afterId') || '0', 10);
  const entries = getLogEntries(afterId);

  return NextResponse.json({ entries });
}
