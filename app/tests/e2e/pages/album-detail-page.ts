import type { Locator, Page } from '@playwright/test';

// Public album detail: /albums/[year]/[album]
export class AlbumDetailPage {
  readonly backLink: Locator;
  readonly noPhotosMessage: Locator;
  readonly videosHeading: Locator;
  readonly photoThumbnails: Locator;

  constructor(readonly page: Page) {
    this.backLink = page.getByRole('link', { name: 'Back to Albums' });
    this.noPhotosMessage = page.getByText('No photos in this album yet');
    this.videosHeading = page.getByRole('heading', { name: 'Videos' });
    this.photoThumbnails = page.locator('img[src*="/api/thumbnails/"]');
  }

  async goto(year: string, urlName: string) {
    await this.page.goto(`/albums/${year}/${urlName}`);
  }

  heading(name: string): Locator {
    return this.page.getByRole('heading', { name });
  }
}
