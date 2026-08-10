import { expect, type Locator, type Page } from '@playwright/test';

export class AdminGroupsPage {
  readonly heading: Locator;
  readonly createGroupToggle: Locator;
  readonly createGroupSubmit: Locator;
  readonly yearSelect: Locator;
  readonly messageBanner: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Group Management' });
    this.createGroupToggle = page.getByRole('button', { name: 'Create New Group' });
    this.createGroupSubmit = page.getByRole('button', { name: 'Create Group', exact: true });
    this.yearSelect = page.locator('select').first();
    // Distinguish the banner from the theme toggle, which is also .fixed.top-0
    this.messageBanner = page.locator('div.fixed.top-0.left-0');
  }

  async goto() {
    await this.page.goto('/admin/groups');
  }

  private formField(label: string): Locator {
    return this.page.locator(`label:text-is("${label}") + input`);
  }

  async createGroup(group: {
    groupName: string;
    displayName: string;
    year: string;
    description?: string;
  }) {
    await this.createGroupToggle.click();
    await this.formField('Group Name (URL-friendly)').fill(group.groupName);
    await this.formField('Year').fill(group.year);
    await this.formField('Display Name').fill(group.displayName);
    if (group.description) await this.formField('Description').fill(group.description);
    await this.createGroupSubmit.click();
    await expect(this.messageBanner).toContainText('Group created successfully');
  }

  groupRow(displayName: string): Locator {
    return this.page.locator('h3', { hasText: displayName });
  }
}
