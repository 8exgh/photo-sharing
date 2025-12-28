import { promises as fs } from 'fs';
import path from 'path';

// The current app schema version - increment when adding new migrations
export const APP_SCHEMA_VERSION = 2;

const DATA_DIR = process.env.DATA_DIR || './data';
const SCHEMA_VERSION_FILE = '.schema-version';

/**
 * Get the current schema version from the data directory
 * Returns 0 if no version file exists (fresh install)
 */
export async function getCurrentSchemaVersion(): Promise<number> {
  const versionPath = path.join(DATA_DIR, SCHEMA_VERSION_FILE);

  try {
    const content = await fs.readFile(versionPath, 'utf-8');
    const version = parseInt(content.trim(), 10);

    if (isNaN(version) || version < 0) {
      throw new Error(`Invalid schema version in ${versionPath}: ${content}`);
    }

    return version;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // No version file = fresh install, assume version 0
      return 0;
    }
    throw error;
  }
}

/**
 * Get the schema version built into this app
 */
export function getAppSchemaVersion(): number {
  return APP_SCHEMA_VERSION;
}

/**
 * Check if migrations are needed
 */
export async function needsMigration(): Promise<boolean> {
  const currentVersion = await getCurrentSchemaVersion();
  return currentVersion < APP_SCHEMA_VERSION;
}

/**
 * Update the schema version file after successful migration
 */
export async function setSchemaVersion(version: number): Promise<void> {
  const versionPath = path.join(DATA_DIR, SCHEMA_VERSION_FILE);
  await fs.writeFile(versionPath, String(version), 'utf-8');
}

/**
 * Get schema status for system info
 */
export async function getSchemaStatus(): Promise<{
  currentVersion: number;
  appVersion: number;
  needsMigration: boolean;
}> {
  const currentVersion = await getCurrentSchemaVersion();
  const appVersion = APP_SCHEMA_VERSION;

  return {
    currentVersion,
    appVersion,
    needsMigration: currentVersion < appVersion,
  };
}
