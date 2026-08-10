import { expect, seed, test } from '../fixtures';

test.describe('Access-key gating of /albums', () => {
  test('denies access without a key', async ({ page, accessDeniedPage }) => {
    await page.goto('/albums');
    await expect(page).toHaveURL(/\/access-denied/);
    await expect(accessDeniedPage.heading).toBeVisible();
    await expect(accessDeniedPage.unauthorizedMessage).toBeVisible();
  });

  test('denies access with an invalid key', async ({ page, accessDeniedPage }) => {
    // The middleware accepts any key into the session; the API layer then
    // rejects it and the albums page redirects to /access-denied.
    await page.goto('/albums?key=not-a-real-key');
    await expect(page).toHaveURL(/\/access-denied/);
    await expect(accessDeniedPage.heading).toBeVisible();
  });

  test('grants access with a valid key and strips it from the URL', async ({
    albumsPage,
    page,
  }) => {
    await albumsPage.gotoWithKey(seed.accessKey);
    await expect(albumsPage.heading).toBeVisible();
    await expect(albumsPage.secureBadge).toBeVisible();
    expect(page.url()).not.toContain('key=');
  });

  test('keeps the session across navigation once a key is accepted', async ({
    albumsPage,
    page,
  }) => {
    await albumsPage.gotoWithKey(seed.accessKey);
    await expect(albumsPage.heading).toBeVisible();

    // Navigate again without the key — the session carries access
    await page.goto('/albums');
    await expect(albumsPage.heading).toBeVisible();
    await expect(albumsPage.secureBadge).toBeVisible();
  });
});
