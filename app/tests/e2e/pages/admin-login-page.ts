import type { Locator, Page } from '@playwright/test';

// /admin/login renders in two modes: normal login, or first-run "claim" mode
// when no admin password has been set yet.
export class AdminLoginPage {
  readonly loginHeading: Locator;
  readonly setupHeading: Locator;
  readonly defaultPasswordInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorBanner: Locator;

  constructor(readonly page: Page) {
    this.loginHeading = page.getByRole('heading', { name: 'Admin Login' });
    this.setupHeading = page.getByRole('heading', { name: 'Set Admin Password' });
    this.defaultPasswordInput = page.locator('#defaultPassword');
    this.passwordInput = page.locator('#password');
    this.confirmPasswordInput = page.locator('#confirmPassword');
    this.submitButton = page.getByRole('button', { name: /Sign in|Set password/ });
    this.errorBanner = page.locator('.bg-red-900');
  }

  async goto() {
    await this.page.goto('/admin/login');
  }

  async login(password: string) {
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async claim(defaultPassword: string, newPassword: string) {
    await this.defaultPasswordInput.fill(defaultPassword);
    await this.passwordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(newPassword);
    await this.submitButton.click();
  }
}
