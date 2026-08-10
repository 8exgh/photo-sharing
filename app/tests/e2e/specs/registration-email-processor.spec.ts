import { expect, test, uniqueUsername } from '../fixtures';
import { countSentEmails, readMockedEmails, readVerificationToken } from '../fresh-db';

// The fresh server's public base URL — deliberately a different host string
// than the browser's 127.0.0.1 baseURL (see playwright.config.ts).
const PUBLIC_BASE_URL = 'http://localhost:3101';

// The email flow in mocked form: EMAIL_DRY_RUN replaces the SMTP transport,
// and the background processor's CQRS loop is asserted through the event
// store — a registration appears in queryPendingVerificationEmails, the
// processor "sends" (dry-run) and records verification_email_sent, after
// which the work item is gone (no duplicate sends on later cycles).
// The test server polls every 1s (POLLING_INTERVAL_MS).
test.describe('Verification email background processor', () => {
  test('sends the pending email exactly once', async ({ page }) => {
    const username = uniqueUsername('e2e-mail');
    await page.request.post('/api/auth/register', {
      data: { username, email: `${username}@example.com`, password: 'a-strong-password-1' },
    });
    const token = readVerificationToken(username);

    // The processor picks the registration up and records the send
    await expect.poll(() => countSentEmails(username, token), { timeout: 15_000 }).toBe(1);

    // Completed work does not reappear: still exactly one send after
    // several more processor cycles
    await page.waitForTimeout(3_000);
    expect(countSentEmails(username, token)).toBe(1);
  });

  test('the emailed link uses the public base URL and completes verification', async ({
    page,
    adminLoginPage,
    adminDashboardPage,
  }) => {
    const username = uniqueUsername('e2e-inbox');
    await page.request.post('/api/auth/register', {
      data: { username, email: `${username}@example.com`, password: 'inbox-password-1' },
    });

    // The processor "sends" the email into the outbox file (EMAIL_DRY_RUN) —
    // that file is the mocked inbox this test reads
    await expect
      .poll(() => readMockedEmails().find((m) => m.username === username), { timeout: 15_000 })
      .toBeTruthy();
    const email = readMockedEmails().find((m) => m.username === username)!;
    const verifyUrl = email.verifyUrl;

    // The email went to the right address and its link is built on the
    // configured public base URL, not the request host
    expect(email.to).toBe(`${username}@example.com`);
    expect(verifyUrl).toContain(`${PUBLIC_BASE_URL}/api/auth/verify`);
    expect(verifyUrl).toContain(`username=${username}`);

    // Open the link through the *other* host string — the server-side view
    // behind a reverse proxy, where the request host is not the public one.
    // The redirect must still land on APP_BASE_URL (this is the regression
    // that sent production users to localhost:3000).
    await page.goto(verifyUrl.replace('localhost', '127.0.0.1'));
    await expect(page).toHaveURL(`${PUBLIC_BASE_URL}/admin/login?verified=1`);
    await expect(adminLoginPage.verifiedBanner).toBeVisible();

    await adminLoginPage.login(username, 'inbox-password-1');
    await expect(adminDashboardPage.heading).toBeVisible();
  });

  test('re-registration supersedes the old token and triggers a fresh email', async ({
    page,
    adminLoginPage,
    adminDashboardPage,
  }) => {
    const username = uniqueUsername('e2e-rereg');

    await page.request.post('/api/auth/register', {
      data: { username, email: `${username}@example.com`, password: 'first-password-111' },
    });
    const firstToken = readVerificationToken(username);
    await expect.poll(() => countSentEmails(username, firstToken), { timeout: 15_000 }).toBe(1);

    // Unverified username re-registered with a new password and email
    await page.request.post('/api/auth/register', {
      data: { username, email: `${username}-b@example.com`, password: 'second-password-222' },
    });
    const secondToken = readVerificationToken(username);
    expect(secondToken).not.toBe(firstToken);

    // The superseded token no longer verifies
    await page.goto(`/api/auth/verify?username=${username}&token=${firstToken}`);
    await expect(page).toHaveURL(/verified=invalid/);

    // The new registration is fresh pending work — a second email goes out
    await expect.poll(() => countSentEmails(username, secondToken), { timeout: 15_000 }).toBe(1);

    // The new token verifies, and only the new password signs in
    await page.goto(`/api/auth/verify?username=${username}&token=${secondToken}`);
    await expect(page).toHaveURL(/verified=1/);

    await adminLoginPage.login(username, 'first-password-111');
    await expect(adminLoginPage.errorBanner).toContainText('Invalid username or password');
    await adminLoginPage.login(username, 'second-password-222');
    await expect(adminDashboardPage.heading).toBeVisible();
  });
});
