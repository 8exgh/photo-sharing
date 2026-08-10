import Database from 'better-sqlite3';
import { join } from 'path';

// Direct read access to the fresh server's per-tenant event stores — stands
// in for the email inbox (verification tokens) and lets specs assert on the
// background processor's recorded events.
const FRESH_DATA_DIR = join(__dirname, '..', '..', '.e2e-data', 'fresh', 'data');

export interface StoredEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

export function readEvents(username: string): StoredEvent[] {
  const db = new Database(join(FRESH_DATA_DIR, 'tenants', username, 'events.db'), {
    readonly: true,
  });
  try {
    return (
      db
        .prepare('SELECT event_type, payload FROM events ORDER BY sequence_number ASC')
        .all() as Array<{ event_type: string; payload: string }>
    ).map((row) => ({ event_type: row.event_type, payload: JSON.parse(row.payload) }));
  } finally {
    db.close();
  }
}

export function readVerificationToken(username: string): string {
  const registered = readEvents(username)
    .filter((e) => e.event_type === 'tenant_registered')
    .pop();
  if (!registered) throw new Error(`No tenant_registered event for ${username}`);
  return registered.payload.verificationToken as string;
}

export function countSentEmails(username: string, token: string): number {
  return readEvents(username).filter(
    (e) => e.event_type === 'verification_email_sent' && e.payload.token === token
  ).length;
}
