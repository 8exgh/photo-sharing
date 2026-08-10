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

## Testing

Playwright end-to-end tests run in CI on every push to `main`, before any of the build and deploy steps. They live in `app/tests/e2e` and are decomposed using the page object pattern:

- `tests/e2e/pages/` — one page object per screen (landing page, admin login, admin dashboard, group management, admin album, public album index/detail, access denied)
- `tests/e2e/specs/` — the test scenarios
- `tests/e2e/seed.mjs` — seeds an isolated SQLite event store per test server

Two production servers are started from one build: a **seeded** one (claimed admin password, an access key, sample albums/groups/video) and a **fresh** one that exercises the first-run admin claim flow. Covered features: the private landing page, admin login/logout and route protection, the first-run claim flow, access-key gating of `/albums` (valid, invalid, missing, and revoked keys), public browsing of years/groups/albums and videos, album/group/access-key administration, and photo upload with server-side resizing to display resolution.

Run them locally:

```bash
cd app
npm run test:e2e:build   # next build + playwright test
npm run test:e2e         # reuse an existing build
```
 
