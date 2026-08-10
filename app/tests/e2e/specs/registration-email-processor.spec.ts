import { expect, test, uniqueUsername } from '../fixtures';
import { countSentEmails, readVerificationToken } from '../fresh-db';

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
