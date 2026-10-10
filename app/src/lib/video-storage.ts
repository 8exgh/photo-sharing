import { join } from 'path';
import { tenantVideosDir } from './tenants';
import { VIDEO_MIME_EXTENSIONS } from './video-files';

function ext(mimeType: string): string {
  return VIDEO_MIME_EXTENSIONS[mimeType] ?? 'bin';
}

// The upload as received. Streamed until processing succeeds, then removed.
export function videoSourcePath(tenantId: string, videoId: string, mimeType: string): string {
  return join(tenantVideosDir(tenantId), `${videoId}.source.${ext(mimeType)}`);
}

// The browser-ready file produced by processing.
export function videoFilePath(tenantId: string, videoId: string, mimeType: string): string {
  return join(tenantVideosDir(tenantId), `${videoId}.${ext(mimeType)}`);
}

export function videoPosterPath(tenantId: string, videoId: string): string {
  return join(tenantVideosDir(tenantId), `${videoId}.poster.jpg`);
}
