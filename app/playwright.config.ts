import { defineConfig, devices } from '@playwright/test';

// Two production servers are started from the same `next build` output:
//  - seeded (3100): two verified tenants with albums and access keys
//  - fresh  (3101): empty data dir, exercises self-registration + verification
const SEEDED_PORT = 3100;
const FRESH_PORT = 3101;

export const SEEDED_BASE_URL = `http://127.0.0.1:${SEEDED_PORT}`;
export const FRESH_BASE_URL = `http://127.0.0.1:${FRESH_PORT}`;

// SESSION_SECRET must be >=32 chars in production; COOKIE_SECURE=false so the
// session cookie works over plain http. EMAIL_DRY_RUN logs verification
// emails instead of sending them — tests read the token from the tenant DB.
const serverEnv = {
  SESSION_SECRET: 'playwright-e2e-only-session-secret-0123456789',
  COOKIE_SECURE: 'false',
  EMAIL_DRY_RUN: '1',
  // Fast background-processor cycles so the email-processor specs don't wait
  POLLING_INTERVAL_MS: '1000',
};

export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'main',
      testIgnore: /registration/,
      use: { ...devices['Desktop Chrome'], baseURL: SEEDED_BASE_URL },
    },
    {
      name: 'registration',
      testMatch: /registration/,
      use: { ...devices['Desktop Chrome'], baseURL: FRESH_BASE_URL },
    },
  ],
  // DATA_DIR is inlined at build time by next.config.ts, so the server always
  // stores data in <cwd>/data. Each server gets its own cwd under .e2e-data/
  // to keep test data isolated from the real data/ directory.
  webServer: [
    {
      command: `node tests/e2e/seed.mjs seeded && cd .e2e-data/seeded && npx next start ../.. -p ${SEEDED_PORT}`,
      url: SEEDED_BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: serverEnv,
    },
    {
      command: `node tests/e2e/seed.mjs fresh && cd .e2e-data/fresh && npx next start ../.. -p ${FRESH_PORT}`,
      url: FRESH_BASE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
      // APP_BASE_URL uses a *different host string* (localhost vs 127.0.0.1)
      // than the browser's baseURL, emulating a reverse proxy where the
      // request's own URL is not the public one — emailed links and verify
      // redirects must land on APP_BASE_URL, not the request host.
      env: { ...serverEnv, APP_BASE_URL: `http://localhost:${FRESH_PORT}` },
    },
  ],
});
