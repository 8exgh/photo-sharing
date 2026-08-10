import { expect, type Locator, type Page } from '@playwright/test';

export class AdminDashboardPage {
  readonly heading: Locator;
  readonly logoutButton: Locator;
  readonly manageGroupsLink: Locator;
  readonly serverLogsLink: Locator;
  readonly messageBanner: Locator;
  readonly createAlbumToggle: Locator;
  readonly createAlbumSubmit: Locator;
  readonly yearSelect: Locator;
  readonly accessKeyLabelInput: Locator;
  readonly generateKeyButton: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Admin Dashboard' });
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
    this.manageGroupsLink = page.getByRole('link', { name: 'Manage Groups' });
    this.serverLogsLink = page.getByRole('link', { name: 'Server Logs' });
    // Distinguish the banner from the theme toggle, which is also .fixed.top-0
    this.messageBanner = page.locator('div.fixed.top-0.left-0');
    this.createAlbumToggle = page.getByRole('button', { name: 'Create New Album' });
    this.createAlbumSubmit = page.getByRole('button', { name: 'Create Album', exact: true });
    // First select on the page is the "Select Year" filter
    this.yearSelect = page.locator('select').first();
    this.accessKeyLabelInput = page.getByPlaceholder('Label (who is this for?)').first();
    this.generateKeyButton = page.getByRole('button', { name: 'Generate Key' });
  }

  async goto() {
    await this.page.goto('/admin');
  }

  // Form labels are not associated with inputs via htmlFor, so target the
  // sibling input that directly follows each <label>.
  private formField(label: string): Locator {
    return this.page.locator(`label:text-is("${label}") + input`);
  }

  async createAlbum(album: {
    name: string;
    year: string;
    location?: string;
    description?: string;
  }) {
    await this.createAlbumToggle.click();
    await this.formField('Album Name').fill(album.name);
    await this.formField('Year').fill(album.year);
    if (album.location) await this.formField('Location').fill(album.location);
    if (album.description) await this.formField('Description').fill(album.description);
    await this.createAlbumSubmit.click();
    await expect(this.messageBanner).toContainText('Album created successfully');
  }

  async selectYear(year: string) {
    await this.yearSelect.selectOption(year);
  }

  albumRow(name: string): Locator {
    return this.page.locator('h3', { hasText: name });
  }

  accessKeyCard(label: string): Locator {
    return this.page
      .locator('div.border.border-slate-600.rounded-md')
      .filter({ hasText: label });
  }

  async generateAccessKey(label: string): Promise<string> {
    await this.accessKeyLabelInput.fill(label);
    await this.generateKeyButton.click();
    await expect(this.messageBanner).toContainText('Access key created successfully');
    const card = this.accessKeyCard(label);
    await expect(card).toBeVisible();
    const key = (await card.locator('.font-mono').innerText()).trim();
    expect(key.length).toBeGreaterThan(10);
    return key;
  }

  async deleteAccessKey(label: string) {
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.accessKeyCard(label).getByTitle('Delete access key').click();
    await expect(this.messageBanner).toContainText('Access key deleted successfully');
  }
}
