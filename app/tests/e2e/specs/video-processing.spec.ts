import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Page } from '@playwright/test';
import { expect, loginAsAdmin, seed, test } from '../fixtures';

// The background processor converts uploads into browser-ready files with
// ffmpeg (see src/lib/video-processing.ts). Fixtures are one-second test
// patterns: clip-mpeg4.mov (MPEG-4 part 2 + PCM audio, which browsers cannot
// play) and clip-h264.mp4 (already H.264/AAC).
const FIXTURES = join(__dirname, '..', 'fixtures');
const SEEDED_DATA_DIR = join(__dirname, '..', '..', '..', '.e2e-data', 'seeded', 'data');
const album = seed.groupedAlbum;

interface FileInfo {
  status: string;
  mimeType: string;
  sourceMimeType: string;
  transcoded?: boolean;
  videoCodec?: string;
  audioCodec?: string | null;
  width?: number;
  height?: number;
  durationSeconds?: number;
  poster: boolean;
  error?: string;
}

async function upload(page: Page, fixture: string, mimeType: string): Promise<string> {
  const response = await page.request.post(
    `/api/albums/${seed.year}/${album.urlName}/videos/upload?filename=${fixture}`,
    { headers: { 'Content-Type': mimeType }, data: readFileSync(join(FIXTURES, fixture)) }
  );
  expect(response.ok()).toBeTruthy();
  return (await response.json()).videoId as string;
}

async function fileInfo(page: Page, videoId: string): Promise<FileInfo | undefined> {
  const data = await (await page.request.get(`/api/albums/${seed.year}/${album.urlName}`)).json();
  return data.metadata.videos.find((v: { id: string }) => v.id === videoId)?.file;
}

async function waitUntilProcessed(page: Page, videoId: string): Promise<FileInfo> {
  await expect
    .poll(async () => (await fileInfo(page, videoId))?.status, { timeout: 90_000, intervals: [500, 1000] })
    .not.toBe('pending');
  return (await fileInfo(page, videoId))!;
}

function assertStreamableMp4(bytes: Buffer) {
  // ISO BMFF signature, and the index (moov) ahead of the media data (mdat)
  // thanks to +faststart, so playback can begin before the download ends
  expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
  const moov = bytes.indexOf('moov');
  const mdat = bytes.indexOf('mdat');
  expect(moov).toBeGreaterThan(-1);
  expect(mdat).toBeGreaterThan(-1);
  expect(moov).toBeLessThan(mdat);
}

test.describe('Video processing', () => {
  test('transcodes an unplayable upload to H.264 MP4 with a poster frame', async ({
    page,
    adminAlbumPage,
  }) => {
    await loginAsAdmin(page);
    const videoId = await upload(page, 'clip-mpeg4.mov', 'video/quicktime');

    // Freshly uploaded: pending, streaming the original in the meantime
    const initial = await fileInfo(page, videoId);
    expect(initial?.sourceMimeType).toBe('video/quicktime');
    expect(['pending', 'ready']).toContain(initial?.status);

    const info = await waitUntilProcessed(page, videoId);
    expect(info.status).toBe('ready');
    expect(info.error).toBeUndefined();
    expect(info.transcoded).toBe(true);
    expect(info.mimeType).toBe('video/mp4');
    expect(info.videoCodec).toBe('h264');
    expect(info.audioCodec).toBe('aac');
    expect(info.width).toBe(320);
    expect(info.height).toBe(240);
    expect(info.durationSeconds).toBeGreaterThan(0.5);
    expect(info.poster).toBe(true);

    // The stream now serves the converted file
    const stream = await page.request.get(`/api/videos/${videoId}/stream`);
    expect(stream.status()).toBe(200);
    expect(stream.headers()['content-type']).toBe('video/mp4');
    assertStreamableMp4(Buffer.from(await stream.body()));

    // Poster is a JPEG
    const poster = await page.request.get(`/api/videos/${videoId}/poster`);
    expect(poster.status()).toBe(200);
    expect(poster.headers()['content-type']).toBe('image/jpeg');
    const posterBytes = Buffer.from(await poster.body());
    expect(posterBytes[0]).toBe(0xff);
    expect(posterBytes[1]).toBe(0xd8);

    // Source gone, processed file and poster in the tenant's folder
    const videosDir = join(SEEDED_DATA_DIR, 'tenants', seed.mainTenant.username, 'videos');
    expect(existsSync(join(videosDir, `${videoId}.source.mov`))).toBe(false);
    expect(existsSync(join(videosDir, `${videoId}.mp4`))).toBe(true);
    expect(existsSync(join(videosDir, `${videoId}.poster.jpg`))).toBe(true);

    // The admin page renders the player with its poster
    await adminAlbumPage.goto(seed.year, album.urlName);
    const player = page.locator(`video[src="/api/videos/${videoId}/stream"]`);
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute('poster', `/api/videos/${videoId}/poster`);

    // Deleting removes every artifact
    const deleted = await page.request.delete(`/api/albums/${seed.year}/${album.urlName}/videos?videoId=${videoId}`);
    expect(deleted.ok()).toBeTruthy();
    await expect.poll(() => existsSync(join(videosDir, `${videoId}.mp4`))).toBe(false);
    await expect.poll(() => existsSync(join(videosDir, `${videoId}.poster.jpg`))).toBe(false);
    expect((await page.request.get(`/api/videos/${videoId}/poster`)).status()).toBe(404);
  });

  test('remuxes an already-compatible MP4 without re-encoding', async ({ page }) => {
    await loginAsAdmin(page);
    const videoId = await upload(page, 'clip-h264.mp4', 'video/mp4');

    const info = await waitUntilProcessed(page, videoId);
    expect(info.status).toBe('ready');
    expect(info.transcoded).toBe(false);
    expect(info.mimeType).toBe('video/mp4');
    expect(info.videoCodec).toBe('h264');
    expect(info.poster).toBe(true);

    const stream = await page.request.get(`/api/videos/${videoId}/stream`);
    expect(stream.headers()['content-type']).toBe('video/mp4');
    assertStreamableMp4(Buffer.from(await stream.body()));

    await page.request.delete(`/api/albums/${seed.year}/${album.urlName}/videos?videoId=${videoId}`);
  });

  test('shows a processing placeholder on the public page until conversion finishes', async ({
    page,
    browser,
  }) => {
    await loginAsAdmin(page);
    const videoId = await upload(page, 'clip-mpeg4.mov', 'video/quicktime');

    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/albums?key=${seed.mainTenant.accessKey}`);
    await visitorPage.goto(`/albums/${seed.year}/${album.urlName}`);

    // Either we catch the placeholder, or the (fast) conversion already
    // finished; in both cases the page settles on a player with a poster
    // without a reload, via its polling
    const player = visitorPage.locator(`video[src="/api/videos/${videoId}/stream"]`);
    await expect(player).toBeVisible({ timeout: 90_000 });
    await expect(player).toHaveAttribute('poster', `/api/videos/${videoId}/poster`);
    expect((await visitorPage.request.get(`/api/videos/${videoId}/poster`)).status()).toBe(200);
    await visitor.close();

    await page.request.delete(`/api/albums/${seed.year}/${album.urlName}/videos?videoId=${videoId}`);
  });
});
