import { randomBytes } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import { expect, loginAsAdmin, seed, test } from '../fixtures';

const SEEDED_DATA_DIR = join(__dirname, '..', '..', '..', '.e2e-data', 'seeded', 'data');
const album = seed.ungroupedAlbum;

test.describe('Video upload and streaming', () => {
  test('uploads a video file and streams it with HTTP range support', async ({
    page,
    adminAlbumPage,
    browser,
  }) => {
    await loginAsAdmin(page);
    await adminAlbumPage.goto(seed.year, album.urlName);
    await expect(adminAlbumPage.uploadVideoButton).toBeVisible();
    const before = await adminAlbumPage.videoPlayers.count();

    // The server never inspects the container, so any bytes stand in for a clip
    const bytes = randomBytes(64 * 1024);
    await adminAlbumPage.uploadVideo({ name: 'playwright-clip.mp4', mimeType: 'video/mp4', buffer: bytes });

    await expect(adminAlbumPage.videoPlayers).toHaveCount(before + 1, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'playwright-clip' })).toBeVisible();

    const src = await adminAlbumPage.videoPlayers.last().getAttribute('src');
    const videoId = src?.match(/\/api\/videos\/([^/]+)\/stream/)?.[1];
    expect(videoId).toBeTruthy();
    const streamUrl = `/api/videos/${videoId}/stream`;

    // Whole file, advertised as range-capable
    const full = await page.request.get(streamUrl);
    expect(full.status()).toBe(200);
    expect(full.headers()['accept-ranges']).toBe('bytes');
    expect(full.headers()['content-type']).toBe('video/mp4');
    expect(full.headers()['content-length']).toBe(String(bytes.length));
    expect(Buffer.from(await full.body()).equals(bytes)).toBe(true);

    // Bounded range: exactly the requested slice comes back as 206
    const part = await page.request.get(streamUrl, { headers: { Range: 'bytes=100-199' } });
    expect(part.status()).toBe(206);
    expect(part.headers()['content-range']).toBe(`bytes 100-199/${bytes.length}`);
    expect(part.headers()['content-length']).toBe('100');
    expect(Buffer.from(await part.body()).equals(bytes.subarray(100, 200))).toBe(true);

    // Open-ended range (what a browser sends when seeking)
    const tail = await page.request.get(streamUrl, { headers: { Range: `bytes=${bytes.length - 16}-` } });
    expect(tail.status()).toBe(206);
    expect(tail.headers()['content-range']).toBe(`bytes ${bytes.length - 16}-${bytes.length - 1}/${bytes.length}`);
    expect((await tail.body()).length).toBe(16);

    // Suffix range (MP4 players read the trailing index first)
    const suffix = await page.request.get(streamUrl, { headers: { Range: 'bytes=-10' } });
    expect(suffix.status()).toBe(206);
    expect(suffix.headers()['content-range']).toBe(`bytes ${bytes.length - 10}-${bytes.length - 1}/${bytes.length}`);
    expect(Buffer.from(await suffix.body()).equals(bytes.subarray(bytes.length - 10))).toBe(true);

    // Beyond the end
    const bad = await page.request.get(streamUrl, { headers: { Range: `bytes=${bytes.length}-` } });
    expect(bad.status()).toBe(416);
    expect(bad.headers()['content-range']).toBe(`bytes */${bytes.length}`);

    // Stored in this tenant's own folder
    const filePath = join(SEEDED_DATA_DIR, 'tenants', seed.mainTenant.username, 'videos', `${videoId}.mp4`);
    expect(existsSync(filePath)).toBe(true);

    // A visitor holding this tenant's key sees the player and can stream
    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/albums?key=${seed.mainTenant.accessKey}`);
    await visitorPage.goto(`/albums/${seed.year}/${album.urlName}`);
    await expect(visitorPage.locator(`video[src="${streamUrl}"]`)).toBeVisible();
    const visitorRange = await visitorPage.request.get(streamUrl, { headers: { Range: 'bytes=0-0' } });
    expect(visitorRange.status()).toBe(206);
    await visitor.close();

    // Another tenant's visitor cannot reach it, nor can an anonymous client
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();
    await strangerPage.goto(`/albums?key=${seed.otherTenant.accessKey}`);
    expect((await strangerPage.request.get(streamUrl)).status()).toBe(404);
    await stranger.close();

    const anonymous = await browser.newContext();
    expect((await anonymous.request.get(streamUrl)).status()).toBe(401);
    await anonymous.close();

    // Deleting the video removes the file
    const deleted = await page.request.delete(
      `/api/albums/${seed.year}/${album.urlName}/videos?videoId=${videoId}`
    );
    expect(deleted.ok()).toBeTruthy();
    await expect.poll(() => existsSync(filePath)).toBe(false);
    expect((await page.request.get(streamUrl)).status()).toBe(404);
  });

  test('rejects files that are not videos', async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.request.post(
      `/api/albums/${seed.year}/${album.urlName}/videos/upload?filename=notes.txt`,
      { headers: { 'Content-Type': 'text/plain' }, data: 'not a video' }
    );
    expect(response.status()).toBe(415);
  });

  test('requires an admin session to upload', async ({ browser }) => {
    const visitor = await browser.newContext();
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`/albums?key=${seed.mainTenant.accessKey}`);
    const response = await visitorPage.request.post(
      `/api/albums/${seed.year}/${album.urlName}/videos/upload?filename=clip.mp4`,
      { headers: { 'Content-Type': 'video/mp4' }, data: Buffer.from('x') }
    );
    expect(response.status()).toBe(401);
    await visitor.close();
  });
});
