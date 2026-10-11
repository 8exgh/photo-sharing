import { randomUUID } from 'crypto';
import { createWriteStream, promises as fs } from 'fs';
import { join } from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { listTenantIds, tenantExists, tenantUploadsDir } from './tenants';
import { queryAlbumById } from './queries';
import { registerVideoFile } from './commands';
import { maxVideoBytes, videoChunkBytes } from './video-files';
import { log, logError } from './logger';

// Chunked, resumable video uploads. The browser creates a session, PUTs the
// file in pieces small enough to pass Cloudflare's 100 MB request-body cap,
// then completes it. Sessions are plain files under tenants/<id>/uploads:
//   <uploadId>.json  metadata
//   <uploadId>.part  bytes received so far (its length is the resume offset)
// They are transient plumbing, not domain data, so they are not events. Only
// completing a session records anything (video_file_uploaded).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UploadSession {
  uploadId: string;
  albumId: string;
  filename: string;
  mimeType: string;
  size: number;
  created: string;
}

export class UploadNotFoundError extends Error {}
export class UploadTooLargeError extends Error {
  constructor(readonly limit: number) {
    super(`Video exceeds the ${limit} byte limit`);
  }
}
export class ChunkTooLargeError extends Error {}
export class UploadBusyError extends Error {}
export class OffsetMismatchError extends Error {
  constructor(readonly received: number) {
    super(`Expected the next chunk at offset ${received}`);
  }
}
export class IncompleteUploadError extends Error {
  constructor(readonly received: number, readonly size: number) {
    super(`Upload incomplete: ${received} of ${size} bytes received`);
  }
}

function metaPath(tenantId: string, uploadId: string) {
  return join(tenantUploadsDir(tenantId), `${uploadId}.json`);
}
function partPath(tenantId: string, uploadId: string) {
  return join(tenantUploadsDir(tenantId), `${uploadId}.part`);
}

// One chunk at a time per session, so two tabs cannot interleave writes
const busy = new Set<string>();

export async function createUploadSession(
  tenantId: string,
  input: { albumId: string; filename: string; mimeType: string; size: number }
): Promise<UploadSession> {
  const limit = maxVideoBytes();
  if (input.size > limit) throw new UploadTooLargeError(limit);

  await fs.mkdir(tenantUploadsDir(tenantId), { recursive: true });
  const session: UploadSession = {
    uploadId: randomUUID(),
    albumId: input.albumId,
    filename: input.filename,
    mimeType: input.mimeType,
    size: input.size,
    created: new Date().toISOString(),
  };
  await fs.writeFile(partPath(tenantId, session.uploadId), Buffer.alloc(0), { flag: 'wx' });
  await fs.writeFile(metaPath(tenantId, session.uploadId), JSON.stringify(session), { flag: 'wx' });
  log('video-uploads', 'Upload session created', { tenantId, uploadId: session.uploadId, size: input.size });
  return session;
}

export async function readUploadSession(
  tenantId: string,
  uploadId: string
): Promise<{ session: UploadSession; received: number }> {
  if (!UUID.test(uploadId)) throw new UploadNotFoundError();
  try {
    const session = JSON.parse(await fs.readFile(metaPath(tenantId, uploadId), 'utf8')) as UploadSession;
    const { size: received } = await fs.stat(partPath(tenantId, uploadId));
    return { session, received };
  } catch {
    throw new UploadNotFoundError();
  }
}

// Appends one chunk. The client says where it thinks the chunk starts; if
// that is not the current end of the file (a retry of a chunk that actually
// landed, or a stale tab) the caller gets the real offset back and resumes
// from there. A chunk that fails partway is truncated off again, so the part
// file only ever holds whole, acknowledged chunks.
export async function appendUploadChunk(
  tenantId: string,
  uploadId: string,
  offset: number,
  body: ReadableStream<Uint8Array>
): Promise<{ received: number; size: number }> {
  const { session, received } = await readUploadSession(tenantId, uploadId);
  const key = `${tenantId}/${uploadId}`;
  if (busy.has(key)) throw new UploadBusyError('Another chunk for this upload is in flight');
  if (offset !== received) throw new OffsetMismatchError(received);

  const maxThisChunk = Math.min(videoChunkBytes(), session.size - received);
  let written = 0;
  const guard = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      written += chunk.length;
      if (written > maxThisChunk) {
        callback(new ChunkTooLargeError(`Chunk exceeds ${maxThisChunk} bytes`));
        return;
      }
      callback(null, chunk);
    },
  });

  busy.add(key);
  try {
    await pipeline(
      Readable.fromWeb(body as import('stream/web').ReadableStream<Uint8Array>),
      guard,
      createWriteStream(partPath(tenantId, uploadId), { flags: 'r+', start: offset })
    );
    if (written === 0) throw new ChunkTooLargeError('Empty chunk');
    return { received: offset + written, size: session.size };
  } catch (error) {
    await fs.truncate(partPath(tenantId, uploadId), offset).catch(() => {});
    throw error;
  } finally {
    busy.delete(key);
  }
}

export async function completeUpload(tenantId: string, uploadId: string): Promise<{ videoId: string }> {
  const { session, received } = await readUploadSession(tenantId, uploadId);
  const key = `${tenantId}/${uploadId}`;
  if (busy.has(key)) throw new UploadBusyError('A chunk for this upload is still in flight');
  if (received !== session.size) throw new IncompleteUploadError(received, session.size);
  if (!queryAlbumById(tenantId, session.albumId)) {
    await abortUpload(tenantId, uploadId);
    throw new UploadNotFoundError('The album was deleted during the upload');
  }

  busy.add(key);
  try {
    const { videoId } = await registerVideoFile(tenantId, session.albumId, {
      filename: session.filename,
      mimeType: session.mimeType,
      fileSize: session.size,
      fromPath: partPath(tenantId, uploadId),
    });
    await fs.unlink(metaPath(tenantId, uploadId)).catch(() => {});
    log('video-uploads', 'Chunked upload completed', { tenantId, uploadId, videoId, size: session.size });
    return { videoId };
  } finally {
    busy.delete(key);
  }
}

export async function abortUpload(tenantId: string, uploadId: string): Promise<boolean> {
  if (!UUID.test(uploadId)) return false;
  const results = await Promise.allSettled([
    fs.unlink(metaPath(tenantId, uploadId)),
    fs.unlink(partPath(tenantId, uploadId)),
  ]);
  return results.some((r) => r.status === 'fulfilled');
}

// Deletes sessions nobody has touched for `maxAgeMs` (the part file's mtime
// moves with every chunk), plus any stray part/meta file without its pair.
export async function cleanupStaleUploads(maxAgeMs: number): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const tenantId of listTenantIds()) {
    if (!tenantExists(tenantId)) continue;
    let entries: string[];
    try {
      entries = await fs.readdir(tenantUploadsDir(tenantId));
    } catch {
      continue;
    }
    const ids = new Set(
      entries.map((name) => name.replace(/\.(json|part)$/, '')).filter((id) => UUID.test(id))
    );
    for (const uploadId of ids) {
      const stats = await Promise.all(
        [metaPath(tenantId, uploadId), partPath(tenantId, uploadId)].map((p) => fs.stat(p).catch(() => null))
      );
      const lastTouched = Math.max(...stats.map((s) => s?.mtimeMs ?? 0));
      const orphaned = stats.some((s) => s === null);
      if (lastTouched < cutoff || (orphaned && lastTouched < Date.now() - 60_000)) {
        try {
          await abortUpload(tenantId, uploadId);
          removed++;
          log('video-uploads', 'Removed stale upload', { tenantId, uploadId, orphaned });
        } catch (error) {
          logError('video-uploads', 'Failed to remove stale upload', error);
        }
      }
    }
  }
  return removed;
}

export function uploadSessionTtlMs(): number {
  const raw = Number(process.env.UPLOAD_SESSION_TTL_HOURS);
  return (Number.isFinite(raw) && raw > 0 ? raw : 24) * 60 * 60 * 1000;
}
