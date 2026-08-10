// Prepares the data directory for an e2e test server before `next start`.
//
//   node tests/e2e/seed.mjs fresh   — wipe the data dir (no tenants; used by
//                                     the registration specs)
//   node tests/e2e/seed.mjs seeded  — wipe, then seed two verified tenants:
//                                     the main tenant with albums, a group, a
//                                     video and an access key, plus a second
//                                     "neighbor" tenant for isolation tests
//
// Events are inserted in the same shape appendEvent() writes them so the
// projection in src/lib/projection.ts replays them exactly like real data.
import Database from 'better-sqlite3';
import { randomBytes, scryptSync } from 'crypto';
import { copyFileSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(join(here, 'seed-data.json'), 'utf8'));

const mode = process.argv[2];
if (mode !== 'fresh' && mode !== 'seeded') {
  console.error('Usage: node tests/e2e/seed.mjs <fresh|seeded>');
  process.exit(1);
}

// next.config.ts inlines DATA_DIR at build time, so the server always uses
// <cwd>/data. Each test server is started from .e2e-data/<mode> to isolate
// its data; seed into the matching directory here.
const appRoot = join(here, '..', '..');
const serverCwd = resolve(appRoot, `.e2e-data/${mode}`);
const dataDir = join(serverCwd, 'data');

rmSync(serverCwd, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

// The logo/favicon fallbacks also resolve ./public relative to the server cwd
mkdirSync(join(serverCwd, 'public'), { recursive: true });
for (const asset of ['logo.png', 'favicon.png']) {
  copyFileSync(join(appRoot, 'public', asset), join(serverCwd, 'public', asset));
}

if (mode === 'fresh') {
  console.log(`[seed] fresh: cleared ${dataDir}`);
  process.exit(0);
}

// Same format as src/lib/password.ts
function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

const now = new Date().toISOString();

function createTenant(tenant) {
  const tenantDir = join(dataDir, 'tenants', tenant.username);
  mkdirSync(join(tenantDir, 'images'), { recursive: true });
  mkdirSync(join(tenantDir, 'thumbnails'), { recursive: true });

  const db = new Database(join(tenantDir, 'events.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_version INTEGER NOT NULL DEFAULT 1,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insert = db.prepare(
    'INSERT INTO events (event_type, event_version, payload) VALUES (?, ?, ?)'
  );
  const append = (event) => insert.run(event.type, event.version, JSON.stringify(event));

  append({
    type: 'admin_password_set',
    version: 1,
    hash: hashPassword(tenant.password),
    created: now,
  });
  append({
    type: 'tenant_registered',
    version: 1,
    email: tenant.email,
    verificationToken: randomBytes(32).toString('hex'),
    created: now,
  });
  append({ type: 'email_verified', version: 1, verified: now });
  append({
    type: 'access_key_created',
    version: 1,
    key: tenant.accessKey,
    created: now,
    label: 'Seeded e2e key',
  });

  return { db, append };
}

// --- Main tenant: albums, group, video ---
const main = createTenant(seed.mainTenant);

// A pre-multi-tenant key with no "<tenant>." prefix — resolved by scanning
// tenants, exactly like keys migrated from production
main.append({
  type: 'access_key_created',
  version: 1,
  key: seed.mainTenant.legacyAccessKey,
  created: now,
  label: 'Seeded legacy key',
});

main.append({
  type: 'group_created',
  version: 1,
  groupId: seed.group.id,
  year: seed.year,
  displayName: seed.group.displayName,
  description: seed.group.description,
  displayOrder: 1,
  created: now,
});

main.append({
  type: 'album_created',
  version: 1,
  albumId: seed.ungroupedAlbum.id,
  name: seed.ungroupedAlbum.name,
  urlName: seed.ungroupedAlbum.urlName,
  year: seed.year,
  location: seed.ungroupedAlbum.location,
  description: seed.ungroupedAlbum.description,
  text: '',
  groupId: null,
  displayOrder: 0,
  created: now,
});

main.append({
  type: 'album_created',
  version: 1,
  albumId: seed.groupedAlbum.id,
  name: seed.groupedAlbum.name,
  urlName: seed.groupedAlbum.urlName,
  year: seed.year,
  location: seed.groupedAlbum.location,
  description: seed.groupedAlbum.description,
  text: '',
  groupId: seed.group.id,
  displayOrder: 0,
  created: now,
});

main.append({
  type: 'video_added',
  version: 1,
  videoId: seed.video.id,
  albumId: seed.ungroupedAlbum.id,
  url: seed.video.url,
  title: seed.video.title,
  addedDate: now,
});

main.db.close();

// --- Other tenant: one album, used to prove cross-tenant isolation ---
const other = createTenant(seed.otherTenant);

other.append({
  type: 'album_created',
  version: 1,
  albumId: seed.otherTenant.album.id,
  name: seed.otherTenant.album.name,
  urlName: seed.otherTenant.album.urlName,
  year: seed.year,
  location: seed.otherTenant.album.location,
  description: seed.otherTenant.album.description,
  text: '',
  groupId: null,
  displayOrder: 0,
  created: now,
});

other.db.close();

console.log(`[seed] seeded two tenants in ${dataDir}`);
