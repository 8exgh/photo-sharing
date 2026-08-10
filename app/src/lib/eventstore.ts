import Database from 'better-sqlite3';
import { join } from 'path';
import { tenantDir, tenantExists } from './tenants';

// One SQLite event store per tenant, cached per process.
const dbCache = new Map<string, Database.Database>();

function openDb(tenantId: string): Database.Database {
  const db = new Database(join(tenantDir(tenantId), 'events.db'));
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

  dbCache.set(tenantId, db);
  return db;
}

export function getDb(tenantId: string): Database.Database {
  const cached = dbCache.get(tenantId);
  if (cached) return cached;

  if (!tenantExists(tenantId)) {
    throw new Error(`Unknown tenant: ${tenantId}`);
  }
  return openDb(tenantId);
}

// Called during registration, after createTenantDir: creates the events.db
// file that makes the tenant "exist".
export function initTenantDb(tenantId: string): Database.Database {
  return openDb(tenantId);
}

export interface StoredEvent {
  sequence_number: number;
  event_type: string;
  event_version: number;
  payload: string;
  created_at: string;
}

export function appendEvent(tenantId: string, type: string, version: number, payload: object): number {
  const db = getDb(tenantId);
  const stmt = db.prepare(
    'INSERT INTO events (event_type, event_version, payload) VALUES (?, ?, ?)'
  );
  const result = stmt.run(type, version, JSON.stringify(payload));
  return result.lastInsertRowid as number;
}

export function getAllEvents(tenantId: string): StoredEvent[] {
  const db = getDb(tenantId);
  const stmt = db.prepare('SELECT * FROM events ORDER BY sequence_number ASC');
  return stmt.all() as StoredEvent[];
}
