import { expect, test, uniqueUsername } from '../fixtures';
import { e2eDataDir, readVerificationToken } from '../fresh-db';

// Runs against the "single" server: an empty data dir whose APP_BASE_URL is
// https://tiktastik.ca, one of the single-tenant hosts in src/lib/site-mode.ts.
// The first registration claims the site; everyone after it is turned away.
// The tests share one server's state, so they run in order.
test.describe.configure({ mode: 'serial' });

const SINGLE_DATA_DIR = e2eDataDir('single');
const owner = uniqueUsername('e2e-owner');
const ownerPassword = 'owner-password-1234';

test.describe('Single-tenant site (first registration wins)', () => {
  test('offers registration while nobody has claimed the site', async ({ homePage, registerPage, adminLoginPage }) => {
    await homePage.goto();
    await expect(homePage.registerLink).toBeVisible();

    await adminLoginPage.goto();
    await expect(adminLoginPage.page.getByRole('link', { name: 'Register' })).toBeVisible();

    await registerPage.goto();
    await expect(registerPage.heading).toBeVisible();
  });

  test('the first registration claims the site', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.register(owner, `${owner}@example.com`, ownerPassword);
    await expect(registerPage.checkEmailHeading).toBeVisible();
  });

  test('closes registration for everyone else', async ({ page, homePage, registerPage, adminLoginPage }) => {
    const latecomer = uniqueUsername('e2e-late');
    const response = await page.request.post('/api/auth/register', {
      data: { username: latecomer, email: `${latecomer}@example.com`, password: 'late-password-1234' },
    });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain('already has an owner');

    await registerPage.goto();
    await expect(page.getByRole('heading', { name: 'Registration is closed' })).toBeVisible();
    await expect(registerPage.heading).toBeHidden();

    await homePage.goto();
    await expect(homePage.adminLink).toBeVisible();
    await expect(homePage.registerLink).toBeHidden();

    await adminLoginPage.goto();
    await expect(adminLoginPage.loginHeading).toBeVisible();
    await expect(adminLoginPage.page.getByRole('link', { name: 'Register' })).toBeHidden();
  });

  test('the owner can still re-register while unverified, then verify and sign in', async ({
    page,
    adminLoginPage,
    adminDashboardPage,
  }) => {
    // Re-registering the claiming username is how an unverified owner gets a
    // fresh verification link; it must not count as a second tenant
    const again = await page.request.post('/api/auth/register', {
      data: { username: owner, email: `${owner}@example.com`, password: ownerPassword },
    });
    expect(again.ok()).toBeTruthy();

    // The emailed link redirects to APP_BASE_URL (tiktastik.ca), which this
    // test box cannot reach, so hit the verify endpoint without following
    const token = readVerificationToken(owner, SINGLE_DATA_DIR);
    const verify = await page.request.get(`/api/auth/verify?username=${owner}&token=${token}`, {
      maxRedirects: 0,
    });
    expect(verify.status()).toBe(307);
    expect(verify.headers()['location']).toBe('https://tiktastik.ca/admin/login?verified=1');

    await adminLoginPage.goto();
    await adminLoginPage.login(owner, ownerPassword);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(adminDashboardPage.heading).toBeVisible();
  });

  test('a verified owner cannot be displaced either', async ({ page }) => {
    const latecomer = uniqueUsername('e2e-late2');
    const response = await page.request.post('/api/auth/register', {
      data: { username: latecomer, email: `${latecomer}@example.com`, password: 'late-password-1234' },
    });
    expect(response.status()).toBe(403);
  });
});
