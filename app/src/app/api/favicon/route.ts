import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { promises as fs } from 'fs';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const DATA_DIR = join(process.cwd(), process.env.DATA_DIR || 'data');
const CUSTOM_FAVICON = join(DATA_DIR, 'branding', 'favicon.png');
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
    try {
      return await serveFavicon(request, CUSTOM_FAVICON);
    } catch {
      // No custom logo uploaded - fall back to the bundled placeholder
    }
    return await serveFavicon(request, PLACEHOLDER_FAVICON);
  } catch (error) {
    logError(TAG, 'Error serving favicon', error);
    return NextResponse.json({ error: 'Favicon not found' }, { status: 404 });
  }
}
