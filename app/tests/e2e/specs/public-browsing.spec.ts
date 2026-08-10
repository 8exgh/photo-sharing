import { expect, seed, test } from '../fixtures';

test.describe('Public album browsing', () => {
  test.beforeEach(async ({ albumsPage }) => {
    await albumsPage.gotoWithKey(seed.mainTenant.accessKey);
    await expect(albumsPage.heading).toBeVisible();
  });

  test('lists years and reveals albums and groups on expand', async ({ albumsPage }) => {
    await expect(albumsPage.yearButton(seed.year)).toBeVisible();
    await albumsPage.expandYear(seed.year);

    await expect(albumsPage.albumLink(seed.ungroupedAlbum.name)).toBeVisible();
    await expect(albumsPage.groupButton(seed.group.displayName)).toBeVisible();
  });

  test('expands a group to reveal its albums', async ({ albumsPage }) => {
    await albumsPage.expandYear(seed.year);
    await albumsPage.expandGroup(seed.group.displayName);
    await expect(albumsPage.albumLink(seed.groupedAlbum.name)).toBeVisible();
  });

  test('opens an album and shows its details and videos', async ({
    albumsPage,
    albumDetailPage,
    page,
  }) => {
    await albumsPage.expandYear(seed.year);
    await albumsPage.openAlbum(seed.ungroupedAlbum.name);

    await expect(page).toHaveURL(
      new RegExp(`/albums/${seed.year}/${seed.ungroupedAlbum.urlName}`)
    );
    await expect(albumDetailPage.heading(seed.ungroupedAlbum.name)).toBeVisible();
    await expect(page.getByText(seed.ungroupedAlbum.description)).toBeVisible();
    await expect(albumDetailPage.videosHeading).toBeVisible();
    await expect(page.getByText(seed.video.title)).toBeVisible();
  });

  test('navigates back from an album to the album list', async ({
    albumsPage,
    albumDetailPage,
  }) => {
    await albumDetailPage.goto(seed.year, seed.groupedAlbum.urlName);
    await expect(albumDetailPage.heading(seed.groupedAlbum.name)).toBeVisible();

    await albumDetailPage.backLink.click();
    await expect(albumsPage.heading).toBeVisible();
  });
});
