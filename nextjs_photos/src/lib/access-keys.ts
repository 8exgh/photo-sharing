import { promises as fs } from 'fs';
import { join } from 'path';
import { AccessKey } from '@/types';
import { log, logError } from '@/lib/logger';

// Use environment variable for data directory, store access keys in data directory
const DATA_DIR = join(process.cwd(), process.env.DATA_DIR || 'data');
const ACCESS_KEYS_FILE = join(DATA_DIR, 'access-keys.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (_error) {
    // Directory might already exist, that's fine
  }
}

export async function getAccessKeys(): Promise<AccessKey[]> {
  try {
    const data = await fs.readFile(ACCESS_KEYS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Don't log ENOENT - file may not exist yet
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logError('lib/access-keys:getAccessKeys', 'Error reading access keys', error);
    }
    return [];
  }
}

export async function saveAccessKeys(keys: AccessKey[]): Promise<void> {
  const TAG = 'lib/access-keys:saveAccessKeys';
  await ensureDataDir();
  await fs.writeFile(ACCESS_KEYS_FILE, JSON.stringify(keys, null, 2));
  log(TAG, 'Access keys saved', { count: keys.length });
}

export async function isValidAccessKey(key: string): Promise<boolean> {
  const TAG = 'lib/access-keys:isValidAccessKey';
  const keys = await getAccessKeys();
  const accessKey = keys.find(k => k.key === key);

  if (!accessKey) {
    log(TAG, 'Access key not found', { keyPrefix: key.substring(0, 6) });
    return false;
  }

  // Check if key has expired
  if (accessKey.expires && new Date(accessKey.expires) < new Date()) {
    log(TAG, 'Access key expired', { keyPrefix: key.substring(0, 6), expires: accessKey.expires });
    return false;
  }

  return true;
}

export async function createAccessKey(expires?: string): Promise<string> {
  const TAG = 'lib/access-keys:createAccessKey';
  const keys = await getAccessKeys();
  const newKey = Math.random().toString(36).substring(2, 15) +
                 Math.random().toString(36).substring(2, 15);

  const accessKey: AccessKey = {
    key: newKey,
    created: new Date().toISOString(),
    expires,
  };

  keys.push(accessKey);
  await saveAccessKeys(keys);

  log(TAG, 'Access key created', { keyPrefix: newKey.substring(0, 6), expires });
  return newKey;
}

export async function deleteAccessKey(keyToDelete: string): Promise<boolean> {
  const TAG = 'lib/access-keys:deleteAccessKey';
  const keys = await getAccessKeys();
  const initialLength = keys.length;
  const filteredKeys = keys.filter(k => k.key !== keyToDelete);

  if (filteredKeys.length === initialLength) {
    // Key not found
    log(TAG, 'Access key not found for deletion', { keyPrefix: keyToDelete.substring(0, 6) });
    return false;
  }

  await saveAccessKeys(filteredKeys);
  log(TAG, 'Access key deleted', { keyPrefix: keyToDelete.substring(0, 6) });
  return true;
}