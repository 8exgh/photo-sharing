import { expect, loginAsAdmin, seed, test } from '../fixtures';

test.describe('Access-key gating of /albums', () => {
  test('denies access without a key', async ({ page, accessDeniedPage }) => {
    await page.goto('/albums');
    await expect(page).toHaveURL(/\/access-denied/);
    await expect(accessDeniedPage.heading).toBeVisible();
    await expect(accessDeniedPage.unauthorizedMessage).toBeVisible();
  });

  test('denies access with an invalid key', async ({ page, accessDeniedPage }) => {
    // The middleware accepts any key into the session; the API layer then
    // fails to resolve a tenant and the albums page redirects to /access-denied.
    await page.goto('/albums?key=not-a-real-key');
    await expect(page).toHaveURL(/\/access-denied/);
    await expect(accessDeniedPage.heading).toBeVisible();
  });

  test('grants access with a valid key and strips it from the URL', async ({
    albumsPage,
    page,
  }) => {
    await albumsPage.gotoWithKey(seed.mainTenant.accessKey);
    await expect(albumsPage.heading).toBeVisible();
    await expect(albumsPage.secureBadge).toBeVisible();
    expect(page.url()).not.toContain('key=');
  });

  test('keeps the session across navigation once a key is accepted', async ({
    albumsPage,
    page,
  }) => {
    await albumsPage.gotoWithKey(seed.mainTenant.accessKey);
    await expect(albumsPage.heading).toBeVisible();

    // Navigate again without the key — the session carries access
    await page.goto('/albums');
    await expect(albumsPage.heading).toBeVisible();
    await expect(albumsPage.secureBadge).toBeVisible();
  });

  test('a legacy unprefixed key still resolves to its tenant', async ({ albumsPage }) => {
    // Keys issued before multi-tenancy carry no "<tenant>." prefix and are
    // resolved by scanning tenants — this is what keeps migrated production
    // share links working
    await albumsPage.gotoWithKey(seed.mainTenant.legacyAccessKey);
    await expect(albumsPage.heading).toBeVisible();

    await albumsPage.expandYear(seed.year);
    await expect(albumsPage.albumLink(seed.ungroupedAlbum.name)).toBeVisible();
  });
});

test.describe('Cross-tenant isolation', () => {
  test("main tenant's key sees only main tenant content", async ({ albumsPage, page }) => {
    await albumsPage.gotoWithKey(seed.mainTenant.accessKey);
    await albumsPage.expandYear(seed.year);

    await expect(albumsPage.albumLink(seed.ungroupedAlbum.name)).toBeVisible();
    await expect(page.getByText(seed.otherTenant.album.name)).toHaveCount(0);
  });

  test("other tenant's key sees only its own content", async ({ albumsPage, page }) => {
    await albumsPage.gotoWithKey(seed.otherTenant.accessKey);
    await albumsPage.expandYear(seed.year);

    await expect(albumsPage.albumLink(seed.otherTenant.album.name)).toBeVisible();
    await expect(page.getByText(seed.ungroupedAlbum.name)).toHaveCount(0);
    await expect(page.getByText(seed.group.displayName)).toHaveCount(0);
  });

  test("a visitor session cannot open another tenant's album directly", async ({
    albumsPage,
    albumDetailPage,
    page,
  }) => {
    await albumsPage.gotoWithKey(seed.otherTenant.accessKey);
    await expect(albumsPage.heading).toBeVisible();

    // Main tenant's album URL under the neighbor's session → not found
    await albumDetailPage.goto(seed.year, seed.ungroupedAlbum.urlName);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });

  test("an admin session is scoped to its own tenant's data", async ({ page }) => {
    await loginAsAdmin(page, seed.otherTenant.username, seed.otherTenant.password);

    // Albums API returns only the neighbor's albums
    const albumsResponse = await page.request.get(`/api/albums?year=${seed.year}`);
    expect(albumsResponse.ok()).toBeTruthy();
    const { albums } = await albumsResponse.json();
    const names = albums.map((a: { name: string }) => a.name);
    expect(names).toContain(seed.otherTenant.album.name);
    expect(names).not.toContain(seed.ungroupedAlbum.name);
    expect(names).not.toContain(seed.groupedAlbum.name);

    // Access-keys API returns only the neighbor's keys
    const keysResponse = await page.request.get('/api/access-keys');
    expect(keysResponse.ok()).toBeTruthy();
    const { keys } = await keysResponse.json();
    const keyValues = keys.map((k: { key: string }) => k.key);
    expect(keyValues).toContain(seed.otherTenant.accessKey);
    expect(keyValues).not.toContain(seed.mainTenant.accessKey);
    expect(keyValues).not.toContain(seed.mainTenant.legacyAccessKey);
  });
});
