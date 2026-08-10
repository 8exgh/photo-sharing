import { expect, loginAsAdmin, seed, test, uniqueName } from '../fixtures';

test.describe('Group administration', () => {
  test('creates a group that appears in the group list', async ({
    page,
    adminGroupsPage,
  }) => {
    await loginAsAdmin(page);
    await adminGroupsPage.goto();
    await expect(adminGroupsPage.heading).toBeVisible();

    const displayName = uniqueName('Trip Group');
    await adminGroupsPage.createGroup({
      groupName: displayName.toLowerCase().replace(/\s+/g, '-'),
      displayName,
      year: seed.year,
      description: 'Created by Playwright',
    });

    await adminGroupsPage.yearSelect.selectOption(seed.year);
    await expect(adminGroupsPage.groupRow(displayName)).toBeVisible();
  });
});
