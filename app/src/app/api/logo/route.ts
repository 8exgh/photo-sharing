import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { getSessionFromRequest } from '@/lib/session';
import { resolveAdminTenant, resolveSessionTenant } from '@/lib/queries';
import { tenantBrandingDir } from '@/lib/tenants';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const PLACEHOLDER_LOGO = join(process.cwd(), 'public', 'logo.png');

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

async function serveLogo(request: NextRequest, path: string, contentType: string) {
  const stat = await fs.stat(path);
  const etag = `"${stat.mtimeMs}-${stat.size}"`;

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const buffer = await fs.readFile(path);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      ETag: etag,
    },
  });
}

export async function GET(request: NextRequest) {
  const TAG = 'GET /api/logo';
  try {
    // Serve the session tenant's custom logo when there is one; anonymous
    // visitors and tenants without a custom logo get the placeholder.
    try {
      const response = new NextResponse();
      const session = await getSessionFromRequest(request, response);
      const tenantId = resolveSessionTenant(session);
      if (tenantId) {
        return await serveLogo(request, join(tenantBrandingDir(tenantId), 'logo.png'), 'image/png');
      }
    } catch {
      // No session or no custom logo - fall through to the placeholder
    }
    return await serveLogo(request, PLACEHOLDER_LOGO, 'image/png');
  } catch (error) {
    logError(TAG, 'Error serving logo', error);
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
  }
}

export async function POST(request: NextRequest) {
  const TAG = 'POST /api/logo';
  try {
    logRequest(TAG, request, { msg: 'Upload logo request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Logo must be a PNG, JPEG, or WebP image' }, { status: 400 });
    }

    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: 'Logo must be 2 MB or smaller' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const png = await sharp(buffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const favicon = await sharp(buffer)
      .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const brandingDir = tenantBrandingDir(tenantId);
    await fs.mkdir(brandingDir, { recursive: true });
    await fs.writeFile(join(brandingDir, 'logo.png'), png);
    await fs.writeFile(join(brandingDir, 'favicon.png'), favicon);

    log(TAG, 'Logo uploaded successfully', { tenantId, size: png.length });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Error uploading logo', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const TAG = 'DELETE /api/logo';
  try {
    logRequest(TAG, request, { msg: 'Revert logo request' });

    const response = new NextResponse();
    const session = await getSessionFromRequest(request, response);

    const tenantId = resolveAdminTenant(session);
    if (!tenantId) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandingDir = tenantBrandingDir(tenantId);
    for (const name of ['logo.png', 'favicon.png']) {
      try {
        await fs.unlink(join(brandingDir, name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }

    log(TAG, 'Logo reverted to default', { tenantId });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Error reverting logo', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
