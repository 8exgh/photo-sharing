import type { Locator, Page } from '@playwright/test';

export class AdminLoginPage {
  readonly loginHeading: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorBanner: Locator;
  readonly registerLink: Locator;
  readonly verifiedBanner: Locator;
  readonly invalidLinkBanner: Locator;

  constructor(readonly page: Page) {
    this.loginHeading = page.getByRole('heading', { name: 'Admin Login' });
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorBanner = page.locator('.bg-red-900');
    this.registerLink = page.getByRole('link', { name: 'Register' });
    this.verifiedBanner = page.getByText('Email verified — your account is active');
    this.invalidLinkBanner = page.getByText('verification link is invalid');
  }

  async goto() {
    await this.page.goto('/admin/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
