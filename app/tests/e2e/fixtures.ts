import { expect, test as base, type Page } from '@playwright/test';
import seed from './seed-data.json';
import {
  AccessDeniedPage,
  AdminAlbumPage,
  AdminDashboardPage,
  AdminGroupsPage,
  AdminLoginPage,
  AlbumDetailPage,
  AlbumsPage,
  HomePage,
  RegisterPage,
} from './pages';

export { expect, seed };

// Log in through the API — page.request shares the browser context's cookie
// jar, so the session cookie applies to subsequent page navigations.
// Defaults to the seeded main tenant.
export async function loginAsAdmin(
  page: Page,
  username: string = seed.mainTenant.username,
  password: string = seed.mainTenant.password
) {
  const response = await page.request.post('/api/auth/login', {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
}

// Unique suffix so tests that create content stay independent under
// parallel workers and repeated runs against a reused server.
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// Valid tenant username with a unique suffix, for registration tests.
export function uniqueUsername(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

type PageObjects = {
  homePage: HomePage;
  adminLoginPage: AdminLoginPage;
  registerPage: RegisterPage;
  adminDashboardPage: AdminDashboardPage;
  adminGroupsPage: AdminGroupsPage;
  adminAlbumPage: AdminAlbumPage;
  albumsPage: AlbumsPage;
  albumDetailPage: AlbumDetailPage;
  accessDeniedPage: AccessDeniedPage;
};

export const test = base.extend<PageObjects>({
  homePage: async ({ page }, use) => use(new HomePage(page)),
  adminLoginPage: async ({ page }, use) => use(new AdminLoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  adminDashboardPage: async ({ page }, use) => use(new AdminDashboardPage(page)),
  adminGroupsPage: async ({ page }, use) => use(new AdminGroupsPage(page)),
  adminAlbumPage: async ({ page }, use) => use(new AdminAlbumPage(page)),
  albumsPage: async ({ page }, use) => use(new AlbumsPage(page)),
  albumDetailPage: async ({ page }, use) => use(new AlbumDetailPage(page)),
  accessDeniedPage: async ({ page }, use) => use(new AccessDeniedPage(page)),
});
