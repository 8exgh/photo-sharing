import type { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly heading: Locator;
  readonly invitationText: Locator;
  readonly adminLink: Locator;
  readonly registerLink: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Photo Album System' });
    this.invitationText = page.getByText('access is by invitation');
    this.adminLink = page.getByRole('link', { name: 'Admin' });
    this.registerLink = page.getByRole('link', { name: 'Register' });
  }

  async goto() {
    await this.page.goto('/');
  }
}
