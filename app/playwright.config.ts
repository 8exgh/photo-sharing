import { defineConfig, devices } from '@playwright/test';

// Two production servers are started from the same `next build` output:
//  - seeded (3100): claimed admin password, an access key, and sample content
//  - fresh  (3101): empty data dir, exercises the first-run admin claim flow
const SEEDED_PORT = 3100;
const FRESH_PORT = 3101;

export const SEEDED_BASE_URL = `http://127.0.0.1:${SEEDED_PORT}`;
export const FRESH_BASE_URL = `http://127.0.0.1:${FRESH_PORT}`;

// SESSION_SECRET must be >=32 chars in production; COOKIE_SECURE=false so the
// session cookie works over plain http.
const serverEnv = {
  SESSION_SECRET: 'playwright-e2e-only-session-secret-0123456789',
  COOKIE_SECURE: 'false',
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
      testIgnore: /first-run/,
      use: { ...devices['Desktop Chrome'], baseURL: SEEDED_BASE_URL },
    },
    {
      name: 'first-run',
      testMatch: /first-run/,
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
      env: serverEnv,
    },
  ],
});
