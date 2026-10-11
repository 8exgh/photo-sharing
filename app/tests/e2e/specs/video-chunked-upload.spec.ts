import { existsSync, readFileSync, statSync, utimesSync } from 'fs';
import { join } from 'path';
import type { Page, Request } from '@playwright/test';
import { expect, loginAsAdmin, seed, test } from '../fixtures';

// Chunked, resumable uploads (src/lib/video-uploads.ts, src/lib/chunked-upload.ts).
// The e2e servers run with VIDEO_CHUNK_BYTES=32768, so the ~100 KB MOV fixture
// goes up in four pieces.
const FIXTURE = join(__dirname, '..', 'fixtures', 'clip-mpeg4.mov');
const FIXTURE_BYTES = readFileSync(FIXTURE);
const CHUNK = 32768;
const SEEDED_DATA_DIR = join(__dirname, '..', '..', '..', '.e2e-data', 'seeded', 'data');
const UPLOADS_DIR = join(SEEDED_DATA_DIR, 'tenants', seed.mainTenant.username, 'uploads');
const album = seed.ungroupedAlbum;
const chunkUrl = /\/api\/video-uploads\/[0-9a-f-]{36}\?offset=\d+$/;

function offsetOf(request: Request): number {
  return Number(new URL(request.url()).searchParams.get('offset'));
}

async function startSession(page: Page, size = FIXTURE_BYTES.length) {
  const response = await page.request.post(`/api/albums/${seed.year}/${album.urlName}/videos/uploads`, {
    data: { filename: 'api-clip.mov', mimeType: 'video/quicktime', size },
  });
  return { response, body: await response.json() };
}

async function deleteVideo(page: Page, videoId: string) {
  await page.request.delete(`/api/albums/${seed.year}/${album.urlName}/videos?videoId=${videoId}`);
}

test.describe('Chunked video upload', () => {
  test('uploads through the page in chunks and the video is processed', async ({ page, adminAlbumPage }) => {
    await loginAsAdmin(page);
    await adminAlbumPage.goto(seed.year, album.urlName);

    const chunkOffsets: number[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT' && chunkUrl.test(request.url())) chunkOffsets.push(offsetOf(request));
    });

    const chooser = page.waitForEvent('filechooser');
    const completed = page.waitForResponse((r) => /\/api\/video-uploads\/[^/]+\/complete$/.test(r.url()));
    await adminAlbumPage.uploadVideoButton.click();
    await (await chooser).setFiles(FIXTURE);
    const { videoId } = await (await completed).json();

    await expect(page.getByText('Video uploaded successfully')).toBeVisible({ timeout: 30_000 });
    const expected = Array.from({ length: Math.ceil(FIXTURE_BYTES.length / CHUNK) }, (_, i) => i * CHUNK);
    expect(chunkOffsets).toEqual(expected);

    // The finished upload flows into processing like any other: it becomes a
    // poster-bearing player once converted, without a reload
    const player = page.locator(`video[src="/api/videos/${videoId}/stream"]`);
    await expect(player).toHaveAttribute('poster', `/api/videos/${videoId}/poster`, { timeout: 90_000 });
    const data = await (await page.request.get(`/api/albums/${seed.year}/${album.urlName}`)).json();
    const info = data.metadata.videos.find((v: { id: string }) => v.id === videoId).file;
    expect(info.status).toBe('ready');
    expect(info.videoCodec).toBe('h264');
    expect(info.sourceMimeType).toBe('video/quicktime');

    // The session is gone once completed
    await expect(page.getByTestId('video-upload-progress')).toBeHidden();
    await deleteVideo(page, videoId);
  });

  test('shows progress and resumes from where an interrupted upload stopped', async ({ page, adminAlbumPage }) => {
    await loginAsAdmin(page);
    await adminAlbumPage.goto(seed.year, album.urlName);

    // Let the first chunk through, then hold the second one open forever
    let seen = 0;
    let releaseHeld!: () => void;
    const held = new Promise<void>((resolve) => (releaseHeld = resolve));
    await page.route(chunkUrl, async (route) => {
      seen += 1;
      if (seen === 1) return route.continue();
      releaseHeld();
      // Never answered: the page reload below abandons it
    });

    const chooser = page.waitForEvent('filechooser');
    await adminAlbumPage.uploadVideoButton.click();
    await (await chooser).setFiles(FIXTURE);
    await held;

    const progress = page.getByTestId('video-upload-progress');
    await expect(progress).toContainText(/Uploading clip-mpeg4\.mov: \d+ KB of \d+ KB \(\d+%\)/);
    await expect(progress.getByRole('button', { name: 'Cancel upload' })).toBeVisible();

    // Interrupt: leave the page while the second chunk is still in flight (the
    // beforeunload prompt is auto-accepted). Only drop the route afterwards, so
    // the held request dies with the page instead of being let through.
    page.on('dialog', (dialog) => dialog.accept());
    await page.reload();
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    // Pick the same file again: it continues from the first chunk's end
    const resumedOffsets: number[] = [];
    let releaseResumed!: () => void;
    const resumedGate = new Promise<void>((resolve) => (releaseResumed = resolve));
    let gateOpen = false;
    await page.route(chunkUrl, async (route) => {
      resumedOffsets.push(offsetOf(route.request()));
      if (!gateOpen) await resumedGate;
      await route.continue();
    });

    const chooser2 = page.waitForEvent('filechooser');
    const completed = page.waitForResponse((r) => /\/api\/video-uploads\/[^/]+\/complete$/.test(r.url()));
    await adminAlbumPage.uploadVideoButton.click();
    await (await chooser2).setFiles(FIXTURE);

    await expect(progress).toContainText(`Resumed clip-mpeg4.mov from ${Math.floor((CHUNK / FIXTURE_BYTES.length) * 100)}%`);
    gateOpen = true;
    releaseResumed();

    const { videoId } = await (await completed).json();
    await expect(page.getByText('Video uploaded successfully')).toBeVisible({ timeout: 30_000 });
    expect(resumedOffsets[0]).toBe(CHUNK);
    expect(resumedOffsets).not.toContain(0);
    await page.unroute(chunkUrl);

    // Nothing was duplicated or lost across the interruption
    const data = await (await page.request.get(`/api/albums/${seed.year}/${album.urlName}`)).json();
    const info = data.metadata.videos.find((v: { id: string }) => v.id === videoId);
    expect(info.file.fileSize).toBe(FIXTURE_BYTES.length);
    await deleteVideo(page, videoId);
  });

  test('cancelling removes the partial upload', async ({ page, adminAlbumPage }) => {
    await loginAsAdmin(page);
    await adminAlbumPage.goto(seed.year, album.urlName);

    let uploadId = '';
    let releaseHeld!: () => void;
    const held = new Promise<void>((resolve) => (releaseHeld = resolve));
    let seen = 0;
    await page.route(chunkUrl, async (route) => {
      uploadId = route.request().url().match(/video-uploads\/([0-9a-f-]{36})/)![1];
      seen += 1;
      if (seen === 1) return route.continue();
      releaseHeld();
    });

    const chooser = page.waitForEvent('filechooser');
    await adminAlbumPage.uploadVideoButton.click();
    await (await chooser).setFiles(FIXTURE);
    await held;

    await page.getByTestId('video-upload-progress').getByRole('button', { name: 'Cancel upload' }).click();
    await expect(page.getByText('Video upload cancelled')).toBeVisible();
    await expect(page.getByTestId('video-upload-progress')).toBeHidden();
    await page.unroute(chunkUrl);

    await expect.poll(async () => (await page.request.get(`/api/video-uploads/${uploadId}`)).status()).toBe(404);
    expect(existsSync(join(UPLOADS_DIR, `${uploadId}.part`))).toBe(false);
  });

  test('the API enforces offsets, sizes, completion, and tenant isolation', async ({ page, browser }) => {
    await loginAsAdmin(page);

    // Too large is refused before any bytes are sent
    const tooBig = await startSession(page, 3 * 1024 * 1024 * 1024);
    expect(tooBig.response.status()).toBe(413);
    expect(tooBig.body.maxBytes).toBe(2 * 1024 * 1024 * 1024);

    const notVideo = await page.request.post(`/api/albums/${seed.year}/${album.urlName}/videos/uploads`, {
      data: { filename: 'notes.txt', mimeType: 'text/plain', size: 10 },
    });
    expect(notVideo.status()).toBe(415);

    const { response, body } = await startSession(page);
    expect(response.ok()).toBeTruthy();
    expect(body.chunkSize).toBe(CHUNK);
    const id = body.uploadId as string;
    const put = (offset: number, bytes: Buffer) =>
      page.request.put(`/api/video-uploads/${id}?offset=${offset}`, {
        headers: { 'Content-Type': 'application/octet-stream' },
        data: bytes,
      });

    // Wrong starting offset: told where to continue
    const wrong = await put(CHUNK, FIXTURE_BYTES.subarray(CHUNK, 2 * CHUNK));
    expect(wrong.status()).toBe(409);
    expect((await wrong.json()).received).toBe(0);

    // A chunk bigger than the session's chunk size is refused
    const oversized = await put(0, FIXTURE_BYTES.subarray(0, CHUNK + 1));
    expect(oversized.status()).toBe(413);
    expect((await (await page.request.get(`/api/video-uploads/${id}`)).json()).received).toBe(0);

    const first = await put(0, FIXTURE_BYTES.subarray(0, CHUNK));
    expect(first.status()).toBe(200);
    expect((await first.json()).received).toBe(CHUNK);

    // Retrying a chunk that already landed is answered with the real offset
    const replay = await put(0, FIXTURE_BYTES.subarray(0, CHUNK));
    expect(replay.status()).toBe(409);
    expect((await replay.json()).received).toBe(CHUNK);

    // Completing early is refused
    const early = await page.request.post(`/api/video-uploads/${id}/complete`);
    expect(early.status()).toBe(409);

    // Another tenant's admin cannot see or touch this session
    const neighbor = await browser.newContext();
    const neighborPage = await neighbor.newPage();
    await loginAsAdmin(neighborPage, seed.otherTenant.username, seed.otherTenant.password);
    expect((await neighborPage.request.get(`/api/video-uploads/${id}`)).status()).toBe(404);
    expect((await neighborPage.request.delete(`/api/video-uploads/${id}`)).status()).toBe(404);
    await neighbor.close();

    // Visitors cannot upload at all
    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/albums?key=${seed.mainTenant.accessKey}`);
    expect((await visitorPage.request.get(`/api/video-uploads/${id}`)).status()).toBe(401);
    await visitor.close();

    // Finish and complete: the bytes on disk are exactly the file
    for (let offset = CHUNK; offset < FIXTURE_BYTES.length; offset += CHUNK) {
      expect((await put(offset, FIXTURE_BYTES.subarray(offset, offset + CHUNK))).status()).toBe(200);
    }
    const done = await page.request.post(`/api/video-uploads/${id}/complete`);
    expect(done.status()).toBe(200);
    const { videoId } = await done.json();
    const stream = await page.request.get(`/api/videos/${videoId}/stream`);
    expect(stream.ok()).toBeTruthy();
    expect((await page.request.get(`/api/video-uploads/${id}`)).status()).toBe(404);
    await deleteVideo(page, videoId);
  });

  test('abandoned uploads are swept by the background job', async ({ page }) => {
    await loginAsAdmin(page);
    const { body } = await startSession(page);
    const id = body.uploadId as string;
    await page.request.put(`/api/video-uploads/${id}?offset=0`, {
      headers: { 'Content-Type': 'application/octet-stream' },
      data: FIXTURE_BYTES.subarray(0, CHUNK),
    });
    const part = join(UPLOADS_DIR, `${id}.part`);
    const meta = join(UPLOADS_DIR, `${id}.json`);
    expect(statSync(part).size).toBe(CHUNK);

    // Pretend nobody has touched it for two days
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(part, twoDaysAgo, twoDaysAgo);
    utimesSync(meta, twoDaysAgo, twoDaysAgo);

    await expect.poll(() => existsSync(part), { timeout: 15_000 }).toBe(false);
    expect(existsSync(meta)).toBe(false);
    expect((await page.request.get(`/api/video-uploads/${id}`)).status()).toBe(404);
  });
});
