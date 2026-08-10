import sharp from 'sharp';
import { expect, loginAsAdmin, seed, test } from '../fixtures';

test.describe('Photo upload', () => {
  test('uploads a photo and resizes it to display resolution', async ({
    page,
    adminAlbumPage,
  }) => {
    await loginAsAdmin(page);
    await adminAlbumPage.goto(seed.year, seed.groupedAlbum.urlName);
    await expect(adminAlbumPage.uploadPhotosButton).toBeVisible();

    const before = await adminAlbumPage.photoThumbnails.count();

    // Larger than the 1920px display limit so the resize path is exercised
    const buffer = await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: { r: 180, g: 90, b: 40 } },
    })
      .jpeg()
      .toBuffer();
    await adminAlbumPage.uploadPhoto({
      name: 'playwright-upload.jpg',
      mimeType: 'image/jpeg',
      buffer,
    });

    await expect(adminAlbumPage.photoThumbnails).toHaveCount(before + 1, { timeout: 20_000 });

    // Fetch the stored image and verify it was resized down to <=1920px
    const src = await adminAlbumPage.photoThumbnails.last().getAttribute('src');
    const photoId = src?.match(/thumbnails\/([^/?]+)/)?.[1];
    expect(photoId).toBeTruthy();

    const imageResponse = await page.request.get(`/api/images/${photoId}`);
    expect(imageResponse.ok()).toBeTruthy();
    const stored = await sharp(await imageResponse.body()).metadata();
    expect(Math.max(stored.width ?? 0, stored.height ?? 0)).toBeLessThanOrEqual(1920);
  });
});
