import { expect, test, uniqueUsername } from '../fixtures';
import { readVerificationToken } from '../fresh-db';

// Runs against the "fresh" server (empty data dir). Registration records the
// tenant; the background processor emails a verification link (EMAIL_DRY_RUN
// in tests); the account only works after the link is used. Tests read the
// verification token straight from the tenant's own events.db.

test.describe('Self-registration with email verification', () => {
  test('registers, verifies via the emailed link, and signs in', async ({
    registerPage,
    adminLoginPage,
    adminDashboardPage,
    page,
  }) => {
    const username = uniqueUsername('e2e-reg');

    await registerPage.goto();
    await registerPage.register(username, `${username}@example.com`, 'a-strong-password-1');
    await expect(registerPage.checkEmailHeading).toBeVisible();

    // Unverified accounts cannot sign in yet
    await adminLoginPage.goto();
    await adminLoginPage.login(username, 'a-strong-password-1');
    await expect(adminLoginPage.errorBanner).toContainText('verify your email');

    // Follow the verification link (token read from the tenant's event store,
    // standing in for the emailed link)
    const token = readVerificationToken(username);
    await page.goto(`/api/auth/verify?username=${username}&token=${token}`);
    await expect(page).toHaveURL(/verified=1/);
    await expect(adminLoginPage.verifiedBanner).toBeVisible();

    await adminLoginPage.login(username, 'a-strong-password-1');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(adminDashboardPage.heading).toBeVisible();
  });

  test('rejects a bogus verification link', async ({ page, adminLoginPage }) => {
    const username = uniqueUsername('e2e-badtoken');

    await page.request.post('/api/auth/register', {
      data: { username, email: `${username}@example.com`, password: 'a-strong-password-1' },
    });

    await page.goto(`/api/auth/verify?username=${username}&token=wrong-token`);
    await expect(page).toHaveURL(/verified=invalid/);
    await expect(adminLoginPage.invalidLinkBanner).toBeVisible();
  });

  test('a verified username cannot be registered again', async ({ registerPage, page }) => {
    const username = uniqueUsername('e2e-dupe');

    // Register + verify the first claim
    await page.request.post('/api/auth/register', {
      data: { username, email: `${username}@example.com`, password: 'a-strong-password-1' },
    });
    const token = readVerificationToken(username);
    await page.goto(`/api/auth/verify?username=${username}&token=${token}`);
    await expect(page).toHaveURL(/verified=1/);

    // Second registration of the same username is refused
    await registerPage.goto();
    await registerPage.register(username, 'someone-else@example.com', 'another-password-1');
    await expect(registerPage.errorBanner).toContainText('already taken');
  });

  test('rejects invalid usernames', async ({ page }) => {
    const response = await page.request.post('/api/auth/register', {
      data: { username: 'Bad User!', email: 'x@example.com', password: 'a-strong-password-1' },
    });
    expect(response.status()).toBe(400);
  });

  test('keeps /admin protected on a server with no tenants registered yet', async ({
    page,
    adminLoginPage,
  }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(adminLoginPage.loginHeading).toBeVisible();
  });

  test('a tenant admin can change their password', async ({
    page,
    adminLoginPage,
    adminDashboardPage,
  }) => {
    const username = uniqueUsername('e2e-passwd');

    // Register + verify + sign in through the API for speed
    await page.request.post('/api/auth/register', {
      data: { username, email: `${username}@example.com`, password: 'old-password-1234' },
    });
    const token = readVerificationToken(username);
    await page.goto(`/api/auth/verify?username=${username}&token=${token}`);
    await expect(page).toHaveURL(/verified=1/);

    await adminLoginPage.login(username, 'old-password-1234');
    await expect(adminDashboardPage.heading).toBeVisible();

    await page.getByPlaceholder('Current password').fill('old-password-1234');
    await page.getByPlaceholder('New password (min 8 characters)').fill('new-password-5678');
    await page.getByPlaceholder('Confirm new password').fill('new-password-5678');
    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(adminDashboardPage.messageBanner).toContainText('Admin password changed successfully');

    await adminDashboardPage.logoutButton.click();
    await expect(page).toHaveURL(/\/admin\/login/);

    await adminLoginPage.login(username, 'old-password-1234');
    await expect(adminLoginPage.errorBanner).toContainText('Invalid username or password');
    await adminLoginPage.login(username, 'new-password-5678');
    await expect(adminDashboardPage.heading).toBeVisible();
  });
});
