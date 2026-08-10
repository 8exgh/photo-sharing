// Imports albums from the legacy filesystem layout (pre event-store: one
// directory per album with album.json/group.json metadata, photos alongside)
// into a tenant's event store, processing photos through the same
// resize/thumbnail pipeline the app uses.
//
//   node scripts/import-legacy-albums.mjs <username> <email> [legacyAlbumsDir]
//
// - legacyAlbumsDir defaults to <cwd>/public/albums (the old ALBUMS_DIR).
// - If the tenant doesn't exist it is created verified, using the
//   ADMIN_PASSWORD (or IMPORT_ADMIN_PASSWORD) env var as its password —
//   the same secret the legacy deploy authenticated with.
// - Legacy access keys from <data>/access-keys.json are imported unprefixed,
//   so previously shared links keep working.
// - Records legacy_import_completed at the end and exits 0 on later runs,
//   so deploys can run it unconditionally.
import Database from 'better-sqlite3';
import { randomBytes, randomUUID, scryptSync } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import sharp from 'sharp';

const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|heic)$/i;

const [username, email, albumsDirArg] = process.argv.slice(2);
if (!TENANT_ID_PATTERN.test(username || '') || !EMAIL_PATTERN.test(email || '')) {
  console.error('Usage: node scripts/import-legacy-albums.mjs <username> <email> [legacyAlbumsDir]');
  process.exit(1);
}

const dataDir = resolve(process.cwd(), process.env.DATA_DIR || 'data');
const legacyAlbumsDir = resolve(process.cwd(), albumsDirArg || 'public/albums');
const tenantDir = join(dataDir, 'tenants', username);
const imagesDir = join(tenantDir, 'images');
const thumbnailsDir = join(tenantDir, 'thumbnails');

if (!existsSync(legacyAlbumsDir)) {
  console.log(`No legacy albums directory at ${legacyAlbumsDir} - nothing to import.`);
  process.exit(0);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// --- Ensure the tenant exists ---

const now = new Date().toISOString();
let db;

if (!existsSync(join(tenantDir, 'events.db'))) {
  const password = process.env.IMPORT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error(
      `Tenant "${username}" does not exist and no ADMIN_PASSWORD / IMPORT_ADMIN_PASSWORD ` +
      'env var is set to create it with.'
    );
    process.exit(1);
  }
  mkdirSync(tenantDir, { recursive: true });
  db = new Database(join(tenantDir, 'events.db'));
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
  appendEvent({ type: 'admin_password_set', version: 1, hash: hashPassword(password), created: now });
  appendEvent({
    type: 'tenant_registered',
    version: 1,
    email,
    verificationToken: randomBytes(32).toString('hex'),
    created: now,
  });
  appendEvent({ type: 'email_verified', version: 1, verified: now });
  console.log(`Created tenant "${username}" using the legacy admin password.`);
} else {
  db = new Database(join(tenantDir, 'events.db'));
}

function appendEvent(event) {
  db.prepare('INSERT INTO events (event_type, event_version, payload) VALUES (?, ?, ?)')
    .run(event.type, event.version, JSON.stringify(event));
}

const alreadyImported = db
  .prepare("SELECT COUNT(*) AS c FROM events WHERE event_type = 'legacy_import_completed'")
  .get().c;
if (alreadyImported > 0) {
  console.log(`Tenant "${username}" already has a completed legacy import - nothing to do.`);
  process.exit(0);
}

mkdirSync(imagesDir, { recursive: true });
mkdirSync(thumbnailsDir, { recursive: true });

// --- Photo pipeline (mirrors commands.uploadPhoto) ---

async function importPhoto(albumId, filePath, meta) {
  const photoId = randomUUID();
  const originalBuffer = readFileSync(filePath);

  const optimizedBuffer = await sharp(originalBuffer)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toBuffer();
  const imageMetadata = await sharp(optimizedBuffer).metadata();

  writeFileSync(join(imagesDir, `${photoId}.jpg`), optimizedBuffer);
  await sharp(originalBuffer)
    .resize(300, 300, { fit: 'cover', position: 'entropy' })
    .jpeg({ quality: 75, progressive: true, mozjpeg: true })
    .toFile(join(thumbnailsDir, `${photoId}.jpg`));

  appendEvent({
    type: 'photo_uploaded',
    version: 1,
    photoId,
    albumId,
    originalFilename: meta.filename,
    title: meta.title || meta.filename.replace(/\.[^/.]+$/, ''),
    width: imageMetadata.width || 0,
    height: imageMetadata.height || 0,
    fileSize: optimizedBuffer.length,
    uploadDate: meta.uploadDate || now,
  });

  const text = meta.text || meta.description || '';
  if (text) {
    appendEvent({ type: 'photo_text_updated', version: 1, photoId, text });
  }
}

// --- Album / group import ---

const counts = { groups: 0, albums: 0, photos: 0, videos: 0, keys: 0, failedPhotos: 0 };

async function importAlbum(year, albumDir, urlName, groupId, fallbackOrder) {
  const meta = readJson(join(albumDir, 'album.json')) || {};
  const albumId = randomUUID();

  appendEvent({
    type: 'album_created',
    version: 1,
    albumId,
    name: meta.name || urlName,
    urlName,
    year,
    location: meta.location || '',
    description: meta.description || '',
    text: meta.text || '',
    groupId: groupId || null,
    displayOrder: meta.displayOrder ?? fallbackOrder,
    created: meta.created || now,
  });
  counts.albums++;

  // Photos listed in album.json first (preserves curated order), then any
  // image files on disk that the metadata doesn't mention
  const listed = Array.isArray(meta.photos) ? meta.photos : [];
  const listedNames = new Set(listed.map((p) => p.filename));
  const onDisk = readdirSync(albumDir).filter(
    (f) => IMAGE_EXTENSIONS.test(f) && statSync(join(albumDir, f)).isFile()
  );

  const toImport = [
    ...listed.filter((p) => existsSync(join(albumDir, p.filename))),
    ...onDisk.filter((f) => !listedNames.has(f)).map((f) => ({ filename: f })),
  ];

  for (const photo of toImport) {
    try {
      await importPhoto(albumId, join(albumDir, photo.filename), photo);
      counts.photos++;
    } catch (error) {
      counts.failedPhotos++;
      console.error(`  photo failed: ${year}/${urlName}/${photo.filename}: ${error.message}`);
    }
  }

  for (const video of Array.isArray(meta.videos) ? meta.videos : []) {
    if (!video.url) continue;
    const videoId = randomUUID();
    appendEvent({
      type: 'video_added',
      version: 1,
      videoId,
      albumId,
      url: video.url,
      title: video.title || video.url,
      addedDate: video.addedDate || now,
    });
    if (video.text) {
      appendEvent({ type: 'video_metadata_updated', version: 1, videoId, text: video.text });
    }
    counts.videos++;
  }

  console.log(`  album ${year}/${urlName}: ${toImport.length} photos`);
}

async function main() {
  const years = readdirSync(legacyAlbumsDir).filter(
    (y) => /^\d{4}$/.test(y) && statSync(join(legacyAlbumsDir, y)).isDirectory()
  );

  for (const year of years.sort()) {
    const yearDir = join(legacyAlbumsDir, year);
    const items = readdirSync(yearDir)
      .filter((i) => statSync(join(yearDir, i)).isDirectory())
      .sort();

    let order = 0;
    for (const item of items) {
      const itemDir = join(yearDir, item);
      const groupMeta = readJson(join(itemDir, 'group.json'));

      if (groupMeta) {
        appendEvent({
          type: 'group_created',
          version: 1,
          groupId: item,
          year,
          displayName: groupMeta.displayName || item,
          description: groupMeta.description || '',
          displayOrder: groupMeta.displayOrder ?? order++,
          created: groupMeta.created || now,
        });
        counts.groups++;

        const nested = readdirSync(itemDir)
          .filter((a) => statSync(join(itemDir, a)).isDirectory())
          .sort();
        let nestedOrder = 0;
        for (const albumName of nested) {
          await importAlbum(year, join(itemDir, albumName), albumName, item, nestedOrder++);
        }
      } else {
        await importAlbum(year, itemDir, item, null, order++);
      }
    }
  }

  // Legacy access keys, imported unprefixed so shared links keep working
  const legacyKeys = readJson(join(dataDir, 'access-keys.json'));
  for (const ak of Array.isArray(legacyKeys) ? legacyKeys : []) {
    if (!ak.key) continue;
    appendEvent({
      type: 'access_key_created',
      version: 1,
      key: ak.key,
      created: ak.created || now,
      expires: ak.expires,
      label: 'Imported legacy key',
    });
    counts.keys++;
  }

  appendEvent({ type: 'legacy_import_completed', version: 1, ...counts, completed: now });
  db.close();

  console.log(
    `\nImported into tenant "${username}": ${counts.groups} groups, ${counts.albums} albums, ` +
    `${counts.photos} photos (${counts.failedPhotos} failed), ${counts.videos} videos, ` +
    `${counts.keys} access keys.`
  );
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
