// Migrates a pre-multi-tenant data directory into a named tenant.
//
//   cd app && node scripts/migrate-single-tenant.mjs <username> <email>
//
// Moves data/events.db (plus WAL/SHM), data/images/, data/thumbnails/, and
// data/branding/ into data/tenants/<username>/ and records the tenant as
// registered + email-verified so <username> can log in with the existing
// admin password. Existing access keys keep working: unprefixed keys are
// resolved by scanning tenants.
import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { join, resolve } from 'path';

const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const [username, email] = process.argv.slice(2);
if (!TENANT_ID_PATTERN.test(username || '')) {
  console.error('Usage: node scripts/migrate-single-tenant.mjs <username> <email>');
  console.error('Username must be 3-32 chars: lowercase letters, digits, hyphens.');
  process.exit(1);
}
if (!EMAIL_PATTERN.test(email || '')) {
  console.error('A valid email for the tenant owner is required as the second argument.');
  process.exit(1);
}

// resolve (not join) so an absolute DATA_DIR like /app/data works as-is
const dataDir = resolve(process.cwd(), process.env.DATA_DIR || 'data');
const oldDb = join(dataDir, 'events.db');
const tenantDir = join(dataDir, 'tenants', username);

if (!existsSync(oldDb)) {
  // Normal on a fresh install or once migration has already run — deploys
  // run this unconditionally, so this is a successful no-op.
  console.log(`No single-tenant database at ${oldDb} - nothing to migrate.`);
  process.exit(0);
}
if (existsSync(tenantDir)) {
  console.error(`Tenant directory ${tenantDir} already exists - refusing to overwrite.`);
  process.exit(1);
}

mkdirSync(tenantDir, { recursive: true });

for (const suffix of ['', '-wal', '-shm']) {
  const src = `${oldDb}${suffix}`;
  if (existsSync(src)) {
    renameSync(src, join(tenantDir, `events.db${suffix}`));
    console.log(`moved events.db${suffix}`);
  }
}

for (const dir of ['images', 'thumbnails', 'branding']) {
  const src = join(dataDir, dir);
  if (existsSync(src)) {
    renameSync(src, join(tenantDir, dir));
    console.log(`moved ${dir}/`);
  }
}

// Record the tenant as registered and verified so login works immediately.
// The token is synthetic - it is never emailed and verification is already
// recorded, so it can't be used.
const db = new Database(join(tenantDir, 'events.db'));
const now = new Date().toISOString();
const insert = db.prepare(
  'INSERT INTO events (event_type, event_version, payload) VALUES (?, ?, ?)'
);
const registered = {
  type: 'tenant_registered',
  version: 1,
  email,
  verificationToken: randomBytes(32).toString('hex'),
  created: now,
};
insert.run(registered.type, registered.version, JSON.stringify(registered));
const verified = { type: 'email_verified', version: 1, verified: now };
insert.run(verified.type, verified.version, JSON.stringify(verified));
db.close();

console.log(`\nMigrated single-tenant data to tenant "${username}" (${email}).`);
console.log(`Log in at /admin/login with username "${username}" and the existing admin password.`);
console.log('Previously shared /albums?key=... links keep working unchanged.');
