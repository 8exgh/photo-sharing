import type { Locator, Page } from '@playwright/test';

// Admin view of a single album: /admin/albums/[year]/[album]
export class AdminAlbumPage {
  readonly uploadPhotosButton: Locator;
  readonly photoThumbnails: Locator;

  constructor(readonly page: Page) {
    this.uploadPhotosButton = page.getByRole('button', { name: 'Upload Photos' }).first();
    this.photoThumbnails = page.locator('img[src*="/api/thumbnails/"]');
  }

  async goto(year: string, urlName: string) {
    await this.page.goto(`/admin/albums/${year}/${urlName}`);
  }

  // The upload button creates a detached <input type=file> and clicks it, so
  // uploads go through the file chooser event.
  async uploadPhoto(file: { name: string; mimeType: string; buffer: Buffer }) {
    const chooserPromise = this.page.waitForEvent('filechooser');
    await this.uploadPhotosButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles([file]);
  }
}
