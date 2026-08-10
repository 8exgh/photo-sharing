import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { promises as fs } from 'fs';
import { getSessionFromRequest } from '@/lib/session';
import { resolveSessionTenant } from '@/lib/queries';
import { tenantBrandingDir } from '@/lib/tenants';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const PLACEHOLDER_FAVICON = join(process.cwd(), 'public', 'favicon.png');

async function serveFavicon(request: NextRequest, path: string) {
  const stat = await fs.stat(path);
  const etag = `"${stat.mtimeMs}-${stat.size}"`;

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const buffer = await fs.readFile(path);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache',
      ETag: etag,
    },
  });
}

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/favicon';
  try {
    // Serve the session tenant's custom favicon when there is one
    try {
      const response = new NextResponse();
      const session = await getSessionFromRequest(request, response);
      const tenantId = resolveSessionTenant(session);
      if (tenantId) {
        return await serveFavicon(request, join(tenantBrandingDir(tenantId), 'favicon.png'));
      }
    } catch {
      // No session or no custom favicon - fall through to the placeholder
    }
    return await serveFavicon(request, PLACEHOLDER_FAVICON);
  } catch (error) {
    logError(TAG, 'Error serving favicon', error);
    return NextResponse.json({ error: 'Favicon not found' }, { status: 404 });
  }
}
