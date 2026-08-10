import type { Locator, Page } from '@playwright/test';

// Public album index: /albums (requires an access-key session)
export class AlbumsPage {
  readonly heading: Locator;
  readonly secureBadge: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Photo Albums' });
    this.secureBadge = page.getByText('Secure Access - Session Active');
  }

  async goto() {
    await this.page.goto('/albums');
  }

  async gotoWithKey(key: string) {
    await this.page.goto(`/albums?key=${key}`);
  }

  yearButton(year: string): Locator {
    return this.page.getByRole('button', { name: year });
  }

  groupButton(displayName: string): Locator {
    return this.page.getByRole('button', { name: displayName });
  }

  albumLink(name: string): Locator {
    return this.page.getByRole('link', { name: new RegExp(name) });
  }

  async expandYear(year: string) {
    await this.yearButton(year).click();
  }

  async expandGroup(displayName: string) {
    await this.groupButton(displayName).click();
  }

  async openAlbum(name: string) {
    await this.albumLink(name).click();
  }
}
