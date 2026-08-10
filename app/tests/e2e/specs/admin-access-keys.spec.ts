import { expect, loginAsAdmin, test, uniqueName } from '../fixtures';
import { AlbumsPage } from '../pages';
import { AccessDeniedPage } from '../pages';

test.describe('Access key administration', () => {
  test.beforeEach(async ({ page, adminDashboardPage }) => {
    await loginAsAdmin(page);
    await adminDashboardPage.goto();
    await expect(adminDashboardPage.heading).toBeVisible();
  });

  test('generates a key that grants a visitor access', async ({
    adminDashboardPage,
    browser,
  }) => {
    const label = uniqueName('Key for');
    const key = await adminDashboardPage.generateAccessKey(label);

    // A brand-new browser context = an uninvited visitor with the share link
    const visitorContext = await browser.newContext();
    try {
      const visitorPage = await visitorContext.newPage();
      const albumsPage = new AlbumsPage(visitorPage);
      await albumsPage.gotoWithKey(key);
      await expect(albumsPage.heading).toBeVisible();
      await expect(albumsPage.secureBadge).toBeVisible();
    } finally {
      await visitorContext.close();
    }
  });

  test('a revoked key no longer grants access', async ({ adminDashboardPage, browser }) => {
    const label = uniqueName('Revoked key');
    const key = await adminDashboardPage.generateAccessKey(label);
    await adminDashboardPage.deleteAccessKey(label);
    await expect(adminDashboardPage.accessKeyCard(label)).toHaveCount(0);

    const visitorContext = await browser.newContext();
    try {
      const visitorPage = await visitorContext.newPage();
      const albumsPage = new AlbumsPage(visitorPage);
      const accessDeniedPage = new AccessDeniedPage(visitorPage);
      await albumsPage.gotoWithKey(key);
      await expect(visitorPage).toHaveURL(/\/access-denied/);
      await expect(accessDeniedPage.heading).toBeVisible();
    } finally {
      await visitorContext.close();
    }
  });
});
