import type { Locator, Page } from '@playwright/test';

export class RegisterPage {
  readonly heading: Locator;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorBanner: Locator;
  readonly checkEmailHeading: Locator;
  readonly signInLink: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Create Your Album Site' });
    this.usernameInput = page.locator('#username');
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.confirmPasswordInput = page.locator('#confirmPassword');
    this.submitButton = page.getByRole('button', { name: 'Register' });
    this.errorBanner = page.locator('.bg-red-900');
    this.checkEmailHeading = page.getByRole('heading', { name: 'Check your email' });
    this.signInLink = page.getByRole('link', { name: /Sign in|Go to sign in/ });
  }

  async goto() {
    await this.page.goto('/register');
  }

  async register(username: string, email: string, password: string) {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.submitButton.click();
  }
}
