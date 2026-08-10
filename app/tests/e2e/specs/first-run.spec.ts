import { expect, test } from '../fixtures';

// Runs against the "fresh" server (empty data dir): no admin password has
// been claimed yet, so /admin/login switches to the claim form.
test.describe('First-run admin claim', () => {
  test('shows the claim form when no admin password is set', async ({ adminLoginPage }) => {
    await adminLoginPage.goto();
    await expect(adminLoginPage.setupHeading).toBeVisible();
    await expect(adminLoginPage.defaultPasswordInput).toBeVisible();
    await expect(adminLoginPage.confirmPasswordInput).toBeVisible();
  });

  test('rejects a claim with the wrong default password', async ({ adminLoginPage }) => {
    await adminLoginPage.goto();
    await expect(adminLoginPage.setupHeading).toBeVisible();
    await adminLoginPage.claim('wrong-default-password', 'my-new-admin-password');
    await expect(adminLoginPage.errorBanner).toContainText('Default password is incorrect');
    // Still unclaimed — the setup form remains
    await expect(adminLoginPage.setupHeading).toBeVisible();
  });

  test('keeps /admin protected while unclaimed', async ({ page, adminLoginPage }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(adminLoginPage.setupHeading).toBeVisible();
  });
});
