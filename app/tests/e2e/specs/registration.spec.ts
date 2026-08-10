import Database from 'better-sqlite3';
import { join } from 'path';
import { expect, test, uniqueUsername } from '../fixtures';

// Runs against the "fresh" server (empty data dir). Registration records the
// tenant; the background processor emails a verification link (EMAIL_DRY_RUN
// in tests); the account only works after the link is used. Tests read the
// verification token straight from the tenant's own events.db.
const FRESH_DATA_DIR = join(__dirname, '..', '..', '..', '.e2e-data', 'fresh', 'data');

function readVerificationToken(username: string): string {
  const db = new Database(join(FRESH_DATA_DIR, 'tenants', username, 'events.db'), {
    readonly: true,
  });
  try {
    const row = db
      .prepare(
        "SELECT payload FROM events WHERE event_type = 'tenant_registered' ORDER BY sequence_number DESC LIMIT 1"
      )
      .get() as { payload: string } | undefined;
    if (!row) throw new Error(`No tenant_registered event for ${username}`);
    return JSON.parse(row.payload).verificationToken;
  } finally {
    db.close();
  }
}

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
});
