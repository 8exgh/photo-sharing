import { expect, test } from '../fixtures';

test.describe('Landing page', () => {
  test('shows the private-album landing content', async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.heading).toBeVisible();
    await expect(homePage.invitationText).toBeVisible();
  });

  test('Admin link navigates to the admin login page', async ({ homePage, adminLoginPage, page }) => {
    await homePage.goto();
    await homePage.adminLink.click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(adminLoginPage.loginHeading).toBeVisible();
  });

  test('Register link navigates to the registration page', async ({ homePage, registerPage, page }) => {
    await homePage.goto();
    await homePage.registerLink.click();
    await expect(page).toHaveURL(/\/register/);
    await expect(registerPage.heading).toBeVisible();
  });
});
