import { promises as fs } from 'fs';
import { join } from 'path';
import { AccessKey } from '@/types';

// Use environment variable for data directory, store access keys in data directory
const DATA_DIR = join(process.cwd(), process.env.DATA_DIR || 'data');
const ACCESS_KEYS_FILE = join(DATA_DIR, 'access-keys.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, that's fine
  }
}

export async function getAccessKeys(): Promise<AccessKey[]> {
  try {
    const data = await fs.readFile(ACCESS_KEYS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (_error) {
    // File doesn't exist yet, return empty array
    return [];
  }
}

export async function saveAccessKeys(keys: AccessKey[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(ACCESS_KEYS_FILE, JSON.stringify(keys, null, 2));
}

export async function isValidAccessKey(key: string): Promise<boolean> {
  const keys = await getAccessKeys();
  const accessKey = keys.find(k => k.key === key);
  
  if (!accessKey) return false;
  
  // Check if key has expired
  if (accessKey.expires && new Date(accessKey.expires) < new Date()) {
    return false;
  }
  
  return true;
}

export async function createAccessKey(expires?: string): Promise<string> {
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
  
  return newKey;
}

export async function deleteAccessKey(keyToDelete: string): Promise<boolean> {
  const keys = await getAccessKeys();
  const initialLength = keys.length;
  const filteredKeys = keys.filter(k => k.key !== keyToDelete);
  
  if (filteredKeys.length === initialLength) {
    // Key not found
    return false;
  }
  
  await saveAccessKeys(filteredKeys);
  return true;
}