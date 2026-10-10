// Uploaded video files: what we accept, where they stream from, how big they
// may be. Kept free of Node imports so the album pages can use it too.

export const VIDEO_MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogv',
  'video/x-m4v': 'm4v',
};

const EXTENSION_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(VIDEO_MIME_EXTENSIONS).map(([mime, ext]) => [ext, mime])
);

// Browsers sometimes send an empty or generic type for .mov/.m4v files, so
// fall back to the filename's extension before rejecting.
export function resolveVideoMimeType(contentType: string | null, filename: string): string | null {
  const declared = (contentType || '').split(';')[0].trim().toLowerCase();
  if (VIDEO_MIME_EXTENSIONS[declared]) return declared;
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  return EXTENSION_MIME[ext] ?? null;
}

// Upper bound on one uploaded video; override with MAX_VIDEO_BYTES.
export const DEFAULT_MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB

export function maxVideoBytes(): number {
  const raw = Number(process.env.MAX_VIDEO_BYTES);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_VIDEO_BYTES;
}

export function videoStreamUrl(videoId: string): string {
  return `/api/videos/${videoId}/stream`;
}

// Uploaded videos are stored under the same "video" concept as YouTube links;
// their url points at our own streaming endpoint.
export function isUploadedVideoUrl(url: string): boolean {
  return /^\/api\/videos\/[0-9a-f-]{36}\/stream$/i.test(url);
}
