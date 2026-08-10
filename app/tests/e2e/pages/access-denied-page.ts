import type { Locator, Page } from '@playwright/test';

export class AccessDeniedPage {
  readonly heading: Locator;
  readonly unauthorizedMessage: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Access Denied' });
    this.unauthorizedMessage = page.getByText('Unauthorized Access');
  }
}
