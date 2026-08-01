import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { getSessionFromRequest } from '@/lib/session';
import { logRequest, log, logError } from '@/lib/logger';

export const runtime = 'nodejs';

const DATA_DIR = join(process.cwd(), process.env.DATA_DIR || 'data');
const BRANDING_DIR = join(DATA_DIR, 'branding');
const CUSTOM_LOGO = join(BRANDING_DIR, 'logo.png');
const PLACEHOLDER_LOGO = join(process.cwd(), 'public', 'logo.svg');

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
    try {
      return await serveLogo(request, CUSTOM_LOGO, 'image/png');
    } catch {
      // No custom logo uploaded - fall back to the bundled placeholder
    }
    return await serveLogo(request, PLACEHOLDER_LOGO, 'image/svg+xml');
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

    if (!session.isAdmin) {
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

    await fs.mkdir(BRANDING_DIR, { recursive: true });
    await fs.writeFile(CUSTOM_LOGO, png);

    log(TAG, 'Logo uploaded successfully', { size: png.length });
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

    if (!session.isAdmin) {
      log(TAG, 'Unauthorized - not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      await fs.unlink(CUSTOM_LOGO);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    log(TAG, 'Logo reverted to default');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError(TAG, 'Error reverting logo', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
