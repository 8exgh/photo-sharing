[![Playwright E2E Tests + Build](https://github.com/8exgh/photo-sharing/actions/workflows/build-and-push.yml/badge.svg)](https://github.com/8exgh/photo-sharing/actions/workflows/build-and-push.yml)

**Test results:** the badge above shows the latest CI run. Playwright end-to-end tests are the first job of the workflow — the Docker image is only built and deployed when they pass. If a run fails, the HTML test report is attached to the run as a `playwright-report` artifact.

# Photo Sharing App

- A substitute to sharing on facebook which requires the audience to have facebook accounts

## Starting point of the project

Create a site that stores and organizes photos and video links organized into albums with information displayed for both albums and individual items contained inside

This is an approximate reference as to how it might work: https://www.ehcanadatravel.com/community/392-andrea-horning/albums/13067-winter-visit-to-rogers-pass-discovery-centre-glacier-national-park-british-columbia-canada.html
 
I am still working on what the top-down menu structure might look like, but it will likely have years subbed into albums. A possibility of navigating by geographic location might also be desired.
 
Most importantly, only specific links can be used to access the content. A public user cannot access the content randomly. Perhaps some kind of generated passkey, sesson ID, or similar. However, once inside a user should be able to navigate All of the content while the key/session is active.
 
Software is required to resize large imagines down to display resolution (ie. Max 1920x1080, for example) if necessary. 
 
Storage of the uploaded content would likely be placed somewhere such as AWS or Azure, mostly as cost and capacity considerations.

## Multi-tenancy

The site is multi-tenant: anyone can register their own private album site at `/register`. Each tenant is fully isolated on disk under `data/tenants/<username>/`:

- `events.db` — the tenant's own SQLite event store (one database per user)
- `images/` and `thumbnails/` — the tenant's own photo folders
- `branding/` — optional custom logo/favicon

There is no central database — the filesystem is the tenant registry, and the username doubles as the tenant id. Access keys are issued as `<username>.<random>` so share links identify their tenant; keys from before multi-tenancy still work via a cross-tenant lookup.

**Registration & email verification.** Signing up requires a username, email, and password. The account is inactive until the emailed verification link is clicked. Verification emails are sent by an in-process background processor in the CQRS style (borrowed from the inventory-shopify project): a job loop polls a query for registrations whose email hasn't gone out, sends the email, and records completion with a command — so the pending work disappears from the query. Email goes out through Gmail SMTP using the same app-password setup as the daycare deploy:

- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — SMTP credentials (sends from `GMAIL_USER`)
- `APP_BASE_URL` — public base URL used in verification links
- `EMAIL_DRY_RUN=1` — log emails instead of sending (local dev and e2e tests)
- `POLLING_INTERVAL_MS` — processor cadence (default 5000)

**Migrating a pre-multi-tenant deployment.** Existing single-tenant data must be moved into a named tenant once, after deploying this version:

```bash
cd app && node scripts/migrate-single-tenant.mjs <username> <email>
```

This moves `data/events.db`, `data/images/`, `data/thumbnails/`, and `data/branding/` into `data/tenants/<username>/` and marks the tenant verified. The existing admin password and all previously shared `/albums?key=...` links keep working.

## Testing

Playwright end-to-end tests run in CI on every push to `main`, before any of the build and deploy steps. They live in `app/tests/e2e` and are decomposed using the page object pattern:

- `tests/e2e/pages/` — one page object per screen (landing page, registration, admin login, admin dashboard, group management, admin album, public album index/detail, access denied)
- `tests/e2e/specs/` — the test scenarios
- `tests/e2e/seed.mjs` — seeds isolated per-tenant SQLite event stores per test server

Two production servers are started from one build: a **seeded** one (two verified tenants with albums, groups, a video, and access keys) and a **fresh** one that exercises self-registration end to end (register → verification link → sign in). Covered features: the private landing page, registration with email verification, the background email processor's query→send→command loop (SMTP mocked via `EMAIL_DRY_RUN`, asserted through the event store, including token supersession on re-registration), admin login/logout, password change, and route protection, access-key gating of `/albums` (valid, invalid, missing, revoked, and legacy unprefixed keys), cross-tenant isolation for both visitor keys and admin sessions, public browsing of years/groups/albums and videos, album/group/access-key administration, and photo upload with server-side resizing into the tenant's own folder.

Run them locally:

```bash
cd app
npm run test:e2e:build   # next build + playwright test
npm run test:e2e         # reuse an existing build
```
 
