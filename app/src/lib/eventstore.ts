import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync } from 'fs';

const DATA_DIR = join(process.cwd(), process.env.DATA_DIR || 'data');
const DB_PATH = join(DATA_DIR, 'events.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
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

  return db;
}

export interface StoredEvent {
  sequence_number: number;
  event_type: string;
  event_version: number;
  payload: string;
  created_at: string;
}

export function appendEvent(type: string, version: number, payload: object): number {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO events (event_type, event_version, payload) VALUES (?, ?, ?)'
  );
  const result = stmt.run(type, version, JSON.stringify(payload));
  return result.lastInsertRowid as number;
}

export function getAllEvents(): StoredEvent[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM events ORDER BY sequence_number ASC');
  return stmt.all() as StoredEvent[];
}
