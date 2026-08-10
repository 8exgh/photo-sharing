import { expect, seed, test } from '../fixtures';

test.describe('Admin authentication', () => {
  test('rejects a wrong password', async ({ adminLoginPage }) => {
    await adminLoginPage.goto();
    await adminLoginPage.login(seed.mainTenant.username, 'definitely-not-the-password');
    await expect(adminLoginPage.errorBanner).toContainText('Invalid username or password');
  });

  test('rejects an unknown username', async ({ adminLoginPage }) => {
    await adminLoginPage.goto();
    await adminLoginPage.login('no-such-tenant', seed.mainTenant.password);
    await expect(adminLoginPage.errorBanner).toContainText('Invalid username or password');
  });

  test('logs in with the correct credentials and reaches the dashboard', async ({
    adminLoginPage,
    adminDashboardPage,
    page,
  }) => {
    await adminLoginPage.goto();
    await adminLoginPage.login(seed.mainTenant.username, seed.mainTenant.password);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(adminDashboardPage.heading).toBeVisible();
  });

  test('redirects unauthenticated visitors from /admin to the login page', async ({
    page,
    adminLoginPage,
  }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(adminLoginPage.loginHeading).toBeVisible();
  });

  test('logout ends the admin session', async ({ adminLoginPage, adminDashboardPage, page }) => {
    await adminLoginPage.goto();
    await adminLoginPage.login(seed.mainTenant.username, seed.mainTenant.password);
    await expect(adminDashboardPage.heading).toBeVisible();

    await adminDashboardPage.logoutButton.click();
    await expect(page).toHaveURL(/\/admin\/login/);

    // The session cookie is gone: /admin bounces back to the login page
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
