import { promises as fs } from 'fs';
import { join } from 'path';
import { AccessKey } from '@/types';

const ACCESS_KEYS_FILE = join(process.cwd(), '.access-keys.json');

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