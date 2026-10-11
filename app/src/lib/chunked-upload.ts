// Browser side of chunked, resumable video uploads (see video-uploads.ts).
// Sends the file in server-sized pieces with XMLHttpRequest so progress is
// reported within each piece, retries a failed piece with backoff, and
// remembers the session in localStorage so picking the same file again after
// a closed tab or lost connection continues where it stopped.

export interface UploadProgress {
  filename: string;
  sent: number;
  total: number;
  resumedFrom: number | null;
  phase: 'starting' | 'uploading' | 'retrying' | 'finishing';
}

export class UploadError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export class UploadCancelled extends Error {}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];

function storageKey(scope: string, file: File): string {
  return `chunked-video-upload:v1:${scope}:${file.name}:${file.size}:${file.lastModified}`;
}

function remember(key: string, uploadId: string | null) {
  try {
    if (uploadId) localStorage.setItem(key, uploadId);
    else localStorage.removeItem(key);
  } catch {
    // Private mode etc.: uploads still work, they just cannot resume
  }
}

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new UploadCancelled());
    }, { once: true });
  });

async function json<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

interface ChunkResult {
  status: number;
  body: { received?: number; error?: string };
}

function putChunk(url: string, blob: Blob, onProgress: (loaded: number) => void, signal: AbortSignal): Promise<ChunkResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Proxies answer errors with HTML
      }
      resolve({ status: xhr.status, body });
    };
    // Network failure: report as status 0 so the caller retries
    xhr.onerror = () => resolve({ status: 0, body: {} });
    xhr.ontimeout = () => resolve({ status: 0, body: {} });
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    xhr.onabort = () => reject(new UploadCancelled());
    xhr.send(blob);
  });
}

export interface ChunkedUploadOptions {
  year: string;
  album: string;
  file: File;
  onProgress: (progress: UploadProgress) => void;
  signal: AbortSignal;
  // Called with the upload id as soon as it is known, so the caller can
  // cancel the server-side session
  onSession?: (uploadId: string) => void;
}

export async function uploadVideoInChunks(options: ChunkedUploadOptions): Promise<{ videoId: string }> {
  const { year, album, file, onProgress, signal } = options;
  const key = storageKey(`${year}/${album}`, file);
  const report = (sent: number, phase: UploadProgress['phase'], resumedFrom: number | null) =>
    onProgress({ filename: file.name, sent, total: file.size, resumedFrom, phase });

  report(0, 'starting', null);

  // Resume a session for this exact file if one is still on the server
  let uploadId = recall(key);
  let received = 0;
  let chunkSize = 0;
  let resumedFrom: number | null = null;
  if (uploadId) {
    const status = await fetch(`/api/video-uploads/${uploadId}`, { cache: 'no-store', signal });
    if (status.ok) {
      const data = await json<{ received: number; size: number; chunkSize: number }>(status);
      if (data.size === file.size) {
        received = data.received;
        chunkSize = data.chunkSize;
        resumedFrom = received > 0 ? received : null;
      } else {
        uploadId = null;
      }
    } else {
      uploadId = null;
    }
    if (!uploadId) remember(key, null);
  }

  if (!uploadId) {
    const created = await fetch(`/api/albums/${year}/${album}/videos/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      signal,
    });
    const data = await json<{ uploadId?: string; chunkSize?: number; error?: string; maxBytes?: number }>(created);
    if (created.status === 413) {
      const limit = data.maxBytes ? ` The limit is ${formatBytes(data.maxBytes)}.` : '';
      throw new UploadError(`That video is ${formatBytes(file.size)}, which is too large to upload.${limit}`, 413);
    }
    if (!created.ok || !data.uploadId || !data.chunkSize) {
      throw new UploadError(data.error || 'Could not start the upload', created.status);
    }
    uploadId = data.uploadId;
    chunkSize = data.chunkSize;
    remember(key, uploadId);
  }
  options.onSession?.(uploadId);

  report(received, 'uploading', resumedFrom);

  let attempt = 0;
  while (received < file.size) {
    if (signal.aborted) throw new UploadCancelled();
    const end = Math.min(received + chunkSize, file.size);
    const start = received;
    const result = await putChunk(
      `/api/video-uploads/${uploadId}?offset=${start}`,
      file.slice(start, end),
      (loaded) => report(start + loaded, attempt > 0 ? 'retrying' : 'uploading', resumedFrom),
      signal
    );

    if (result.status === 200 && typeof result.body.received === 'number') {
      received = result.body.received;
      attempt = 0;
      report(received, 'uploading', resumedFrom);
      continue;
    }
    if (result.status === 409 && typeof result.body.received === 'number') {
      // The server already has more (or less) than we thought: continue from its offset
      received = result.body.received;
      continue;
    }
    if (result.status === 404) {
      remember(key, null);
      throw new UploadError('The upload expired on the server. Please choose the file again.', 404);
    }
    if (result.status === 401) {
      throw new UploadError('Your session has expired. Sign in again and pick the same file to resume.', 401);
    }
    if (result.status === 413 || (result.status >= 400 && result.status < 500 && result.status !== 409 && result.status !== 429)) {
      throw new UploadError(result.body.error || `Upload failed (${result.status})`, result.status);
    }

    // Network error, 5xx, 429 or a busy 409: back off and retry this chunk
    if (attempt >= RETRY_DELAYS_MS.length) {
      throw new UploadError(
        'The connection keeps dropping. Pick the same file again later to resume from where it stopped.',
        result.status
      );
    }
    report(start, 'retrying', resumedFrom);
    await sleep(RETRY_DELAYS_MS[attempt++], signal);
  }

  report(file.size, 'finishing', resumedFrom);
  const done = await fetch(`/api/video-uploads/${uploadId}/complete`, { method: 'POST', signal });
  const data = await json<{ videoId?: string; error?: string }>(done);
  if (!done.ok || !data.videoId) {
    throw new UploadError(data.error || 'Could not finish the upload', done.status);
  }
  remember(key, null);
  return { videoId: data.videoId };
}

export async function cancelChunkedUpload(year: string, album: string, file: File, uploadId: string | null) {
  remember(storageKey(`${year}/${album}`, file), null);
  if (uploadId) {
    await fetch(`/api/video-uploads/${uploadId}`, { method: 'DELETE' }).catch(() => {});
  }
}
