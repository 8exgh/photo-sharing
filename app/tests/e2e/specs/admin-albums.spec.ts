import { expect, loginAsAdmin, test, uniqueName } from '../fixtures';

test.describe('Album administration', () => {
  test.beforeEach(async ({ page, adminDashboardPage }) => {
    await loginAsAdmin(page);
    await adminDashboardPage.goto();
    await expect(adminDashboardPage.heading).toBeVisible();
  });

  test('creates an album that appears in the album list', async ({ adminDashboardPage }) => {
    const name = uniqueName('Test Album');
    await adminDashboardPage.createAlbum({
      name,
      year: '2030',
      location: 'Test Location',
      description: 'Created by Playwright',
    });

    await adminDashboardPage.selectYear('2030');
    await expect(adminDashboardPage.albumRow(name)).toBeVisible();
  });
});
